import { callPoscoGptWithMessages } from "@/lib/poscoGpt";
import { TOOL_DEFINITIONS, executeToolByName } from "@/lib/tools";
import type { PoscoToolCall, ToolLog } from "@/types";

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentInput = {
  systemPrompt: string;
  contextPrompt: string;
  historyMessages: HistoryMessage[];
  userMessage: string;
};

type AgentOutput = {
  answer: string;
  toolUsed: boolean;
  toolLogs: ToolLog[];
};

export async function runChatAgent(input: AgentInput): Promise<AgentOutput> {
  const baseMessages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content?: string;
    tool_call_id?: string;
    tool_calls?: PoscoToolCall[];
  }> = [
    { role: "system", content: input.systemPrompt },
    { role: "system", content: input.contextPrompt },
    ...input.historyMessages,
    { role: "user", content: input.userMessage },
  ];

  // 1차 호출: tool 사용 허용
  const first = await callPoscoGptWithMessages({
    messages: baseMessages as any,
    tools: [...TOOL_DEFINITIONS] as any,
    toolChoice: "auto",
    temperature: 0.7,
  });

  const toolCalls = first.tool_calls ?? [];

  if (toolCalls.length === 0) {
    return {
      answer: first.content || "답변을 생성하지 못했습니다.",
      toolUsed: false,
      toolLogs: [],
    };
  }

  const toolLogs: ToolLog[] = [];
  const toolMessages: Array<{
    role: "tool";
    tool_call_id: string;
    content: string;
  }> = [];

  for (const tc of toolCalls) {
    const toolName = tc.function.name;
    const rawArgs = tc.function.arguments;
    const { content, log } = executeToolByName(toolName, rawArgs);

    toolLogs.push(log);
    toolMessages.push({
      role: "tool",
      tool_call_id: tc.id,
      content,
    });
  }

  // 2차 호출: tool 결과 반영
  const second = await callPoscoGptWithMessages({
    messages: [
      ...baseMessages,
      {
        role: "assistant",
        content: first.content ?? "",
        tool_calls: toolCalls,
      },
      ...toolMessages,
    ] as any,
    temperature: 0.7,
  });

  return {
    answer: second.content || "답변을 생성하지 못했습니다.",
    toolUsed: true,
    toolLogs,
  };
}
