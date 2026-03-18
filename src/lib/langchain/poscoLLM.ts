/**
 * POSCO 사내 GPT API를 LangChain BaseChatModel로 래핑
 *
 * - _generate(): 비스트리밍 호출 (tool calling 지원)
 * - _stream():   스트리밍 호출 (SSE 청크 → ChatGenerationChunk)
 */
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { ChatResult, ChatGenerationChunk } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { withRetry } from "@/lib/apiRetry";

const POSCO_GPT_URL = "http://aigpt.posco.net/gpgpta01-gpt/gptApi/personalApi";
const POSCO_GPT_MODEL = "gpt-5.2";

type PoscoApiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

/** LangChain 메시지 → POSCO API 메시지 변환 */
function toApiMessages(messages: BaseMessage[]): PoscoApiMessage[] {
  return messages.map((msg) => {
    if (msg instanceof SystemMessage) {
      return { role: "system", content: String(msg.content) };
    }
    if (msg instanceof HumanMessage) {
      return { role: "user", content: String(msg.content) };
    }
    if (msg instanceof ToolMessage) {
      return {
        role: "tool",
        tool_call_id: msg.tool_call_id,
        content: String(msg.content),
      };
    }
    if (msg instanceof AIMessage) {
      const base: PoscoApiMessage = {
        role: "assistant",
        content: String(msg.content ?? ""),
      };
      // LangChain tool_calls → POSCO format
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        base.tool_calls = msg.tool_calls.map((tc) => ({
          id: tc.id ?? crypto.randomUUID(),
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args ?? {}),
          },
        }));
      }
      return base;
    }
    // fallback
    return { role: "user", content: String(msg.content) };
  });
}

function getApiKey(): string {
  let key = process.env.POSCO_GPT_KEY ?? "";
  if (!key) throw new Error("[Error] 환경변수 POSCO_GPT_KEY가 설정되지 않았습니다.");
  if (!key.startsWith("Bearer ")) key = `Bearer ${key}`;
  return key;
}

export interface PoscoChatModelFields {
  temperature?: number;
}

export class PoscoChatModel extends BaseChatModel {
  temperature: number;

  constructor(fields: PoscoChatModelFields = {}) {
    super({});
    this.temperature = fields.temperature ?? 0.7;
  }

  _llmType(): string {
    return "posco-gpt";
  }

  /** 비스트리밍 호출 */
  async _generate(
    messages: BaseMessage[],
    options: BaseChatModelCallOptions,
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const apiMessages = toApiMessages(messages);
    const payload: Record<string, unknown> = {
      model: POSCO_GPT_MODEL,
      messages: apiMessages,
      temperature: this.temperature,
      need_origin: true,
    };

    // Tool definitions (bindTools로 설정)
    const tools = (options as any).tools;
    const toolChoice = (options as any).tool_choice;
    if (tools?.length) payload.tools = tools;
    if (toolChoice) payload.tool_choice = toolChoice;

    const rawResponse = await withRetry(async () => {
      const res = await fetch(POSCO_GPT_URL, {
        method: "POST",
        headers: {
          Authorization: getApiKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[API Error] ${res.status}: ${errText.slice(0, 200)}`);
      }
      return res;
    });

    const json = await rawResponse.json();
    const msg = json?.choices?.[0]?.message;
    const content: string = (msg?.content ?? json?.response ?? "").trim();

    // tool_calls 처리 (POSCO format → LangChain format)
    const rawToolCalls: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }> = msg?.tool_calls ?? [];

    const toolCalls = rawToolCalls.map((tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }
      return { id: tc.id, name: tc.function.name, args, type: "tool_call" as const };
    });

    const aiMsg =
      toolCalls.length > 0
        ? new AIMessage({ content, tool_calls: toolCalls })
        : new AIMessage(content);

    return {
      generations: [{ message: aiMsg, text: content }],
      llmOutput: {},
    };
  }

  /** 스트리밍 호출 */
  async *_stream(
    messages: BaseMessage[],
    _options: BaseChatModelCallOptions,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const apiMessages = toApiMessages(messages);
    const payload = {
      model: POSCO_GPT_MODEL,
      messages: apiMessages,
      temperature: this.temperature,
      stream: true,
      need_origin: true,
    };

    const res = await withRetry(async () => {
      const r = await fetch(POSCO_GPT_URL, {
        method: "POST",
        headers: {
          Authorization: getApiKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!r.ok || !r.body) {
        const errText = await r.text().catch(() => "");
        throw new Error(`[API Error] ${r.status}: ${errText.slice(0, 200)}`);
      }
      return r;
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const delta: string =
            parsed?.choices?.[0]?.delta?.content ??
            parsed?.response ??
            "";
          if (!delta) continue;

          await runManager?.handleLLMNewToken(delta);
          yield {
            text: delta,
            message: new AIMessageChunk(delta),
            generationInfo: {},
          } as ChatGenerationChunk;
        } catch {
          // skip non-JSON SSE chunks
        }
      }
    }
  }
}
