import type { SearchResult, SourceReference } from "@/types";

// ==============================================================================
// [POSCO Future M] 사내 AI API 연동 설정 (Updated based on Reference)
// ==============================================================================
const POSCO_GPT_URL = "http://aigpt.posco.net/gpgpta01-gpt/gptApi/personalApi";
const POSCO_GPT_MODEL = "gpt-5.2"; // 사내 표준 모델명 적용
const SYSTEM_PROMPT = `당신은 스마트 매뉴얼 도우미입니다. 산업 설비 유지보수 분야의 전문 지식을 보유하고 있습니다.

답변 원칙:
- [매뉴얼 내용]이 제공되고 질문과 관련이 있으면, 해당 내용을 우선 활용하여 정확하게 답변하세요.
- [매뉴얼 내용]이 질문과 관련이 없거나 제공되지 않은 경우, 보유한 전문 지식으로 성실히 답변하세요.
- 알람 코드·고장 증상 질문에는 알람 의미·원인·조치 방법을 구체적으로 설명하세요.
- 일반적인 질문(사양, 절차, 개념, 기타)에는 질문 유형에 맞게 자연스럽게 답변하세요.
- 매뉴얼에 없는 내용을 창작하거나 추측하지 마세요.
- 모든 답변은 한국어로 작성하세요.`;

/**
 * 질문 유형에 따라 유연하게 프롬프트를 생성한다.
 * - 관련 매뉴얼 내용이 있으면: 내용 기반으로 답변 유도
 * - 관련 내용이 없으면: 전문 지식 기반 답변 유도
 */
function buildUserPrompt(context: string, question: string): string {
  if (context.trim().length === 0) {
    return `[질문]
${question}

매뉴얼에서 관련 내용을 찾지 못했습니다. 보유한 전문 지식을 바탕으로 최선을 다해 답변해 주세요.`;
  }

  return `아래 [매뉴얼 내용]을 참고하여 [질문]에 답변하세요.

지침:
- 표(Table) 형태의 내용은 행/열을 주의 깊게 연결하여 해석하세요.
- 알람 코드·고장 증상 질문이라면: 알람 의미, 원인, 조치 방법 순으로 구분하여 설명하세요.
- 사양·절차·개념 등 일반 질문이라면: 매뉴얼 내용을 바탕으로 자연스럽게 답변하세요.
- 매뉴얼 내용이 질문과 직접 관련이 없다면, 전문 지식으로 답변하되 매뉴얼에서 해당 내용을 찾지 못했음을 간략히 언급하세요.

[매뉴얼 내용]
${context}

[질문]
${question}`;
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
