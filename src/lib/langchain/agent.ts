/**
 * LangChain 기반 채팅 에이전트 (v1 호환)
 *
 * - PoscoChatModel (BaseChatModel 상속) 으로 POSCO GPT API 래핑
 * - DynamicStructuredTool 로 calculator / unit_converter / alarm_lookup 정의
 * - 1차 호출(도구 탐지) → 도구 실행 → 2차 호출(스트리밍) 패턴
 */
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { PoscoChatModel } from "./poscoLLM";
import { getLangChainTools } from "@/lib/tools";
import { TOOL_DEFINITIONS } from "@/lib/tools";
import type { ToolLog } from "@/types";

export type AgentStreamEvent =
  | { type: "tool_start"; toolName: string; toolInput: Record<string, unknown> }
  | { type: "tool_end"; toolName: string; result: string; log: ToolLog }
  | { type: "delta"; content: string }
  | { type: "done"; toolUsed: boolean; toolLogs: ToolLog[] };

type HistoryMessage = { role: "user" | "assistant"; content: string };

export interface LangChainAgentInput {
  systemPrompt: string;
  contextPrompt: string;
  historyMessages: HistoryMessage[];
  userMessage: string;
}

const CHUNK_SIZE = 6;

/**
 * LangChain 에이전트 스트리밍 실행
 *
 * 흐름:
 *  1. 1차 LLM 호출 (비스트리밍, tool_calls 탐지)
 *  2. tool_calls 있으면 → DynamicStructuredTool.invoke() → tool_start/tool_end 이벤트
 *  3. 2차 LLM 호출 (스트리밍) → delta 이벤트
 *  4. tool_calls 없으면 → 1차 응답을 청크 단위 스트리밍
 */
export async function* runLangChainAgent(
  input: LangChainAgentInput
): AsyncGenerator<AgentStreamEvent> {
  const model = new PoscoChatModel({ temperature: 0.7 });
  const langChainTools = getLangChainTools();

  const combinedSystemContent = `${input.systemPrompt}\n\n${input.contextPrompt}`;

  // 대화 히스토리 변환 (LangChain 메시지 형식)
  const historyMsgs = input.historyMessages.map((m) =>
    m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
  );

  const baseMessages = [
    new SystemMessage(combinedSystemContent),
    ...historyMsgs,
    new HumanMessage(input.userMessage),
  ];

  // ── 1차 호출: 도구 탐지 (비스트리밍) ────────────────────────────────────
  let firstResult;
  try {
    firstResult = await model._generate(baseMessages, {
      // OpenAI 형식 tool 정의 전달 (PoscoChatModel._generate에서 options.tools 참조)
      tools: [...TOOL_DEFINITIONS] as any,
      tool_choice: "auto",
    } as any);
  } catch (err: any) {
    // 도구 없이 재시도
    firstResult = await model._generate(baseMessages, {});
  }

  const firstMsg = firstResult.generations?.[0]?.message as AIMessage | undefined;
  const toolCalls = firstMsg?.tool_calls ?? [];
  const toolLogs: ToolLog[] = [];

  if (toolCalls.length === 0) {
    // 도구 불필요 → 1차 응답 청크 스트리밍
    const answer = String(firstMsg?.content ?? "답변을 생성하지 못했습니다.");
    for (let i = 0; i < answer.length; i += CHUNK_SIZE) {
      yield { type: "delta", content: answer.slice(i, i + CHUNK_SIZE) };
    }
    yield { type: "done", toolUsed: false, toolLogs: [] };
    return;
  }

  // ── 도구 실행 ─────────────────────────────────────────────────────────────
  const toolMessages: ToolMessage[] = [];

  for (const tc of toolCalls) {
    const toolName = tc.name;
    const toolInput = tc.args as Record<string, unknown>;

    yield { type: "tool_start", toolName, toolInput };

    let toolResult = "도구 실행 오류";
    try {
      const lcTool = langChainTools.find((t) => t.name === toolName);
      if (lcTool) {
        toolResult = await lcTool.invoke(toolInput);
      } else {
        toolResult = `알 수 없는 도구: ${toolName}`;
      }
    } catch (e: any) {
      toolResult = `도구 오류: ${e?.message ?? String(e)}`;
    }

    const log: ToolLog = {
      toolName,
      args: toolInput as Record<string, any>,
      result: toolResult,
    };
    toolLogs.push(log);

    yield { type: "tool_end", toolName, result: toolResult, log };

    toolMessages.push(
      new ToolMessage({
        content: toolResult,
        tool_call_id: tc.id ?? toolName,
        name: toolName,
      })
    );
  }

  // ── 2차 호출: 도구 결과 반영 + 스트리밍 ─────────────────────────────────
  const secondMessages = [
    ...baseMessages,
    new AIMessage({ content: String(firstMsg?.content ?? ""), tool_calls: toolCalls }),
    ...toolMessages,
  ];

  try {
    for await (const chunk of model._stream(secondMessages, {})) {
      if (chunk.text) {
        yield { type: "delta", content: chunk.text };
      }
    }
  } catch (err: any) {
    // 스트리밍 실패 시 비스트리밍 폴백
    const fallback = await model._generate(secondMessages, {});
    const fallbackAnswer = String(fallback.generations?.[0]?.text ?? "답변을 생성하지 못했습니다.");
    for (let i = 0; i < fallbackAnswer.length; i += CHUNK_SIZE) {
      yield { type: "delta", content: fallbackAnswer.slice(i, i + CHUNK_SIZE) };
    }
  }

  yield { type: "done", toolUsed: true, toolLogs };
}
