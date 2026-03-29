/**
 * PDF 번역 모듈 — DB 빌드 시에만 호출됨 (PDF_TRANSLATE=true 시 활성화)
 * 사용자 채팅 시에는 절대 호출되지 않음
 */

// 간단한 인메모리 캐시 (동일 텍스트 재번역 방지)
const translationCache = new Map<string, string>();

/**
 * 텍스트가 주로 영어인지 감지
 * ASCII 알파벳 비율 >60% → true (영어)
 */
export function detectLanguage(text: string): boolean {
  const cleaned = text.replace(/\s/g, "");
  if (cleaned.length === 0) return false;
  const asciiAlpha = (text.match(/[A-Za-z]/g) ?? []).length;
  return asciiAlpha / cleaned.length > 0.6;
}

/**
 * 영어 매뉴얼 텍스트를 한국어로 번역
 * POSCO GPT API 사용, 산업 설비 매뉴얼 전문 번역
 */
export async function translateToKorean(text: string, filename: string): Promise<string> {
  const cacheKey = `${filename}::${text.slice(0, 64)}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  const prompt = `당신은 산업 설비 매뉴얼 전문 번역가입니다.
다음 영어 매뉴얼 텍스트를 한국어로 번역하세요.
번역 규칙:
- 제품 모델명, 파라미터 번호, 알람/에러 코드는 원문 그대로 유지
- 기술 용어(IGBT, PWM, MODBUS, RS-485 등)는 원문 유지
- 수치와 단위는 원문 유지
- 표(Table) 구조는 텍스트 형태로 최대한 보존
- 자연스러운 한국어 기술 문서 문체 사용
- 번역문만 출력하고 설명이나 주석은 절대 추가하지 말 것
원문: ${text}
한국어 번역:`;

  try {
    const apiKey = (() => {
      let key = process.env.POSCO_GPT_KEY ?? "";
      if (!key) throw new Error("POSCO_GPT_KEY 미설정");
      if (!key.startsWith("Bearer ")) key = `Bearer ${key}`;
      return key;
    })();

    const response = await fetch(
      "http://aigpt.posco.net/gpgpta01-gpt/gptApi/personalApi",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.2",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          need_origin: true,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(`[pdfTranslator] API 오류 ${response.status} — 원문 유지`);
      return text;
    }

    const json = await response.json();
    const translated: string = (
      json?.choices?.[0]?.message?.content ??
      json?.response ??
      ""
    ).trim();

    if (!translated) return text;

    translationCache.set(cacheKey, translated);
    return translated;
  } catch (e) {
    console.error("[pdfTranslator] 번역 오류 — 원문 유지:", e);
    return text;
  }
}
