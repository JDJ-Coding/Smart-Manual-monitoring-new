// src/lib/tools.ts
import type { ToolLog } from "@/types";

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "calculator",
      description:
        "수학 계산을 수행합니다. 예: '1200 * 0.15 + 300', 'round(10.234, 2)'",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "계산할 수식 문자열",
          },
        },
        required: ["expression"],
      },
    },
  },
] as const;

function safeCalculator(expression: string): string {
  // 최소 안전 네임스페이스
  const allowed = {
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    max: Math.max,
    min: Math.min,
    pow: Math.pow,
    sqrt: Math.sqrt,
  };

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      ...Object.keys(allowed),
      `"use strict"; return (${expression});`
    );
    const result = fn(...Object.values(allowed));
    return String(result);
  } catch (e: any) {
    return `계산 오류: ${e?.message ?? "invalid expression"}`;
  }
}

export function executeToolByName(
  toolName: string,
  rawArgs: string
): { content: string; log: ToolLog } {
  let args: Record<string, any> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    args = {};
  }

  let result = "지원하지 않는 도구입니다.";

  if (toolName === "calculator") {
    const expression = String(args.expression ?? "");
    result = safeCalculator(expression);
  }

  return {
    content: result,
    log: {
      toolName,
      args,
      result,
    },
  };
}
