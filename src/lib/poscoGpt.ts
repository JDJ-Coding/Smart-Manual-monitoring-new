import type { SearchResult, SourceReference } from "@/types";

// ==============================================================================
// [POSCO Future M] 사내 AI API 연동 설정 (Updated based on Reference)
// ==============================================================================
const POSCO_GPT_URL = "http://aigpt.posco.net/gpgpta01-gpt/gptApi/personalApi";
const POSCO_GPT_MODEL = "gpt-5.2"; // 사내 표준 모델명 적용
const SYSTEM_PROMPT = "당신은 산업 설비 유지보수 전문가입니다."; // 기존 역할 유지

/**
 * 사용자 프롬프트 생성 함수 (기존 로직 유지)
 */
function buildUserPrompt(context: string, question: string): string {
  return `사용자는 설비의 알람 코드나 고장 증상에 대해 묻고 있습니다.

아래 [매뉴얼 내용]을 분석하여 답변하세요.
- 내용이 표(Table) 형태로 되어 있다면 행/열을 주의 깊게 연결하여 해석하세요.
- '알람 코드', '원인', '조치 방법'을 명확히 구분해서 설명하세요.
- 내용에 없는 사실은 지어내지 마세요.
- 답변은 한국어로 작성하세요.

[매뉴얼 내용]
${context}

[질문]
${question}

[답변 형식]
1. 증상/알람 의미: (간략 설명)
2. 원인 및 조치 방법: (번호 매겨서 상세 설명)
3. 참고 문서: (파일명, 페이지)`;
}

/**
 * 검색 결과에서 컨텍스트 구성 함수 (기존 로직 유지)
 */
function buildContextFromResults(results: SearchResult[]): {
  context: string;
  sources: SourceReference[];
} {
  const seen = new Set<string>();
  const sources: SourceReference[] = [];

  const contextParts = results.map((r) => {
    const { filename, page } = r.chunk.metadata;
    const key = `${filename}::${page}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({ filename, page, excerpt: r.chunk.text.slice(0, 150) });
    }
    return `[파일: ${filename} | p.${page}]\n${r.chunk.text}`;
  });

  return { context: contextParts.join("\n\n---\n\n"), sources };
}

export interface GptCallResult {
  answer: string;
  sources: SourceReference[];
}

/**
 * 포스코 GPT API 호출 함수 (참조 코드 규격 적용)
 */
interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function callPoscoGpt(
  question: string,
  results: SearchResult[],
  conversationHistory?: ConversationMessage[]
): Promise<GptCallResult> {
  // 1. 환경변수 로드
  let apiKey = process.env.POSCO_GPT_KEY;
  if (!apiKey) {
    throw new Error("[Error] 환경변수 POSCO_GPT_KEY가 설정되지 않았습니다.");
  }

  // 2. Bearer 토큰 처리 (참조 코드 로직 적용)
  if (!apiKey.startsWith("Bearer ")) {
    apiKey = `Bearer ${apiKey}`;
  }

  // 컨텍스트 구성
  const { context, sources } = buildContextFromResults(results);
  const userPrompt = buildUserPrompt(context, question);

  // 3. 페이로드 구성: 시스템 → 이전 대화 이력 → 현재 질문
  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // 최근 대화 이력 포함 (최대 6개 메시지, 즉 3회 왕복)
  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-6);
    for (const msg of recent) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userPrompt });

  const payload = {
    model: POSCO_GPT_MODEL,
    messages,
    temperature: 0.7,
  };

  try {
    // 4. 요청 전송
    const response = await fetch(POSCO_GPT_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // 참조 코드의 에러 처리 로직 반영
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `[API Error] Code: ${response.status}, Msg: ${errorText.slice(0, 100)}`
      );
    }

    // 5. 응답 처리 (JSON 및 일반 텍스트 모두 대응)
    const rawText = await response.text();
    let answer: string;

    try {
      // JSON 파싱 시도
      const json = JSON.parse(rawText);

      // 참조 코드의 파싱 우선순위 적용
      if (
        json.choices &&
        Array.isArray(json.choices) &&
        json.choices.length > 0 &&
        json.choices[0].message?.content
      ) {
        answer = json.choices[0].message.content.trim();
      } else if (json.response) {
        // 일부 내부 모델 응답 필드 대응
        answer = json.response;
      } else {
        // 구조가 다를 경우 JSON 문자열 전체 반환
        answer = JSON.stringify(json);
      }
    } catch (e) {
      // JSON이 아닌 경우(Raw Text) 텍스트 그대로 반환
      answer = rawText.trim();
    }

    return { answer, sources };
  } catch (error: any) {
    // API 호출 실패 시 에러 전파
    throw new Error(`[System Error] ${error.message || String(error)}`);
  }
}
