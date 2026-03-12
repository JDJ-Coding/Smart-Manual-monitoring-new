// src/lib/tools.ts
import type { ToolLog } from "@/types";

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "calculator",
      description:
        "수학 계산을 수행합니다. 예: '1200 * 0.15 + 300', 'round(10.234, 2)', 'sqrt(144)', 'log10(1000)'",
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
  // round(value, decimals) — Math.round은 소수점 자리수 미지원이므로 커스텀 구현
  const roundWithDecimals = (value: number, decimals = 0): number => {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  };

  const allowed = {
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    round: roundWithDecimals,
    max: Math.max,
    min: Math.min,
    pow: Math.pow,
    sqrt: Math.sqrt,
    log: Math.log,
    log2: Math.log2,
    log10: Math.log10,
    PI: Math.PI,
    E: Math.E,
  };

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      ...Object.keys(allowed),
      `"use strict"; return (${expression});`
    );
    const result = fn(...Object.values(allowed));
    if (typeof result !== "number" && typeof result !== "bigint") {
      return `계산 오류: 숫자 결과가 아닙니다 (${typeof result})`;
    }
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
