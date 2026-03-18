import type { SearchResult, SourceReference, PoscoToolCall } from "@/types";
import { withRetry } from "@/lib/apiRetry";

// ==============================================================================
// [POSCO Future M] 사내 AI API 연동 설정
// ==============================================================================
const POSCO_GPT_URL = "http://aigpt.posco.net/gpgpta01-gpt/gptApi/personalApi";
const POSCO_GPT_MODEL = "gpt-5.2";
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
 * 검색 결과에서 컨텍스트 구성
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

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

type ApiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_call_id?: string;
  tool_calls?: PoscoToolCall[];
};

type CallPoscoGptInternalParams = {
  messages: ApiMessage[];
  tools?: any[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  temperature?: number;
};

type ParsedAssistantMessage = {
  role: "assistant";
  content: string;
  tool_calls?: PoscoToolCall[];
};

/**
 * 공통 내부 호출: tool 지원 포함
 */
async function callPoscoGptRaw({
  messages,
  tools,
  toolChoice,
  temperature = 0.7,
}: CallPoscoGptInternalParams): Promise<ParsedAssistantMessage> {
  let apiKey = process.env.POSCO_GPT_KEY;
  if (!apiKey) {
    throw new Error("[Error] 환경변수 POSCO_GPT_KEY가 설정되지 않았습니다.");
  }
  if (!apiKey.startsWith("Bearer ")) {
    apiKey = `Bearer ${apiKey}`;
  }

  const payload: any = {
    model: POSCO_GPT_MODEL,
    messages,
    temperature,
    need_origin: true,
  };

  if (tools?.length) payload.tools = tools;
  if (toolChoice) payload.tool_choice = toolChoice;

  const response = await withRetry(() =>
    fetch(POSCO_GPT_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }).then(async (res) => {
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `[API Error] Code: ${res.status}, Msg: ${errorText.slice(0, 200)}`
        );
      }
      return res;
    })
  );

  const rawText = await response.text();

  try {
    const json = JSON.parse(rawText);
    const msg = json?.choices?.[0]?.message;

    if (msg) {
      return {
        role: "assistant",
        content: (msg.content ?? "").trim(),
        tool_calls: msg.tool_calls ?? undefined,
      };
    }

    if (json?.response) {
      return {
        role: "assistant",
        content: String(json.response),
      };
    }

    return {
      role: "assistant",
      content: JSON.stringify(json),
    };
  } catch {
    return {
      role: "assistant",
      content: rawText.trim(),
    };
  }
}

// ===== 기존 호환용 반환 타입 =====
export interface GptCallResult {
  answer: string;
  sources: SourceReference[];
}

// ===== 신규(Agent용) 반환 타입 =====
export interface GptAgentResult {
  answer: string;
  sources: SourceReference[];
  assistantMessage: ParsedAssistantMessage; // tool_calls 포함 가능
}

/**
 * 기존 함수와 100% 호환 + tool 파라미터 확장
 * - 기존 호출부는 그대로 사용 가능
 * - 신규 Agent 호출부는 tools/toolChoice 사용 가능
 */
export async function callPoscoGpt(
  question: string,
  results: SearchResult[],
  conversationHistory?: ConversationMessage[],
  options?: {
    tools?: any[];
    toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
    temperature?: number;
  }
): Promise<GptAgentResult> {
  const { context, sources } = buildContextFromResults(results);
  const userPrompt = buildUserPrompt(context, question);

  const messages: ApiMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (conversationHistory?.length) {
    const recent = conversationHistory.slice(-6);
    for (const msg of recent) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userPrompt });

  try {
    const assistantMessage = await callPoscoGptRaw({
      messages,
      tools: options?.tools,
      toolChoice: options?.toolChoice,
      temperature: options?.temperature ?? 0.7,
    });

    return {
      answer: assistantMessage.content,
      sources,
      assistantMessage,
    };
  } catch (error: any) {
    throw new Error(`[System Error] ${error.message || String(error)}`);
  }
}

/**
 * Agent 루프에서 "메시지 배열 직접 제어"가 필요할 때 사용
 */
export async function callPoscoGptWithMessages(params: {
  messages: ApiMessage[];
  tools?: any[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  temperature?: number;
}): Promise<ParsedAssistantMessage> {
  try {
    return await callPoscoGptRaw(params);
  } catch (error: any) {
    throw new Error(`[System Error] ${error.message || String(error)}`);
  }
}

/**
 * 스트리밍 응답: ReadableStream<string> 반환
 * 청크마다 텍스트 delta를 emit
 */
export async function callPoscoGptStream(params: {
  messages: ApiMessage[];
  temperature?: number;
}): Promise<ReadableStream<string>> {
  let apiKey = process.env.POSCO_GPT_KEY;
  if (!apiKey) {
    throw new Error("[Error] 환경변수 POSCO_GPT_KEY가 설정되지 않았습니다.");
  }
  if (!apiKey.startsWith("Bearer ")) {
    apiKey = `Bearer ${apiKey}`;
  }

  const payload = {
    model: POSCO_GPT_MODEL,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    stream: true,
    need_origin: true,
  };

  const response = await fetch(POSCO_GPT_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`[API Error] Code: ${response.status}, Msg: ${errorText.slice(0, 200)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            const delta =
              json?.choices?.[0]?.delta?.content ??
              json?.response ??
              "";
            if (delta) controller.enqueue(delta);
          } catch {
            // non-JSON SSE chunk – skip
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

/**
 * 청크에 문맥 prefix 추가 (Contextual Retrieval)
 * CONTEXTUAL_RETRIEVAL=true 환경변수 설정 시 활성화
 */
export async function summarizeChunkContext(
  chunkText: string,
  filename: string
): Promise<string> {
  const systemMsg: ApiMessage = {
    role: "system",
    content: "문서 청크에 대한 간결한 한 줄 문맥 설명을 생성하세요. 반드시 한국어로만 답변하세요.",
  };
  const userMsg: ApiMessage = {
    role: "user",
    content: `파일명: ${filename}\n\n다음 청크가 문서에서 어떤 내용을 다루는지 한 문장으로 설명하세요:\n\n${chunkText.slice(0, 500)}`,
  };

  try {
    const result = await callPoscoGptRaw({
      messages: [systemMsg, userMsg],
      temperature: 0.1,
    });
    return result.content.trim();
  } catch {
    return "";
  }
}
