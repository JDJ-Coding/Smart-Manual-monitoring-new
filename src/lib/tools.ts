// src/lib/tools.ts
import fs from "fs";
import path from "path";
import type { ToolLog } from "@/types";

// ==============================================================================
// OpenAI 함수 형식 도구 정의 (POSCO GPT API + LangChain 공용)
// ==============================================================================
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
  {
    type: "function",
    function: {
      name: "unit_converter",
      description:
        "산업 설비에서 자주 사용하는 단위를 변환합니다. 압력(bar/psi/MPa/kPa), 온도(°C/°F/K), 유량(L/min/m3h/GPM), 회전수(rpm/rads) 변환을 지원합니다.",
      parameters: {
        type: "object",
        properties: {
          value: {
            type: "number",
            description: "변환할 수치",
          },
          from_unit: {
            type: "string",
            description:
              "원본 단위. 압력: bar, psi, MPa, kPa / 온도: C, F, K / 유량: Lmin, m3h, GPM / 회전: rpm, rads",
          },
          to_unit: {
            type: "string",
            description: "변환 대상 단위 (from_unit과 동일한 카테고리)",
          },
        },
        required: ["value", "from_unit", "to_unit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "alarm_lookup",
      description:
        "알람 코드로 설비 알람 정보를 조회합니다. 알람 의미, 원인, 조치 방법을 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          alarm_code: {
            type: "string",
            description: "조회할 알람 코드 (예: E001, W001)",
          },
        },
        required: ["alarm_code"],
      },
    },
  },
] as const;

// ==============================================================================
// Calculator
// ==============================================================================
function safeCalculator(expression: string): string {
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

// ==============================================================================
// Unit Converter
// ==============================================================================
type UnitCategory = "pressure" | "temperature" | "flow" | "rotation";

const UNIT_CATEGORY: Record<string, UnitCategory> = {
  bar: "pressure", psi: "pressure", MPa: "pressure", kPa: "pressure",
  C: "temperature", F: "temperature", K: "temperature",
  Lmin: "flow", m3h: "flow", GPM: "flow",
  rpm: "rotation", rads: "rotation",
};

function convertUnit(value: number, from: string, to: string): string {
  const cat = UNIT_CATEGORY[from];
  if (!cat) return `지원하지 않는 단위입니다: ${from}`;
  if (UNIT_CATEGORY[to] !== cat) return `단위 카테고리가 다릅니다 (${from} ↔ ${to})`;
  if (from === to) return `${value} ${to}`;

  let result: number;

  if (cat === "pressure") {
    // 기준: Pa
    const toPA: Record<string, number> = { bar: 1e5, psi: 6894.757, MPa: 1e6, kPa: 1e3 };
    const inPa = value * toPA[from];
    result = inPa / toPA[to];
  } else if (cat === "temperature") {
    // 기준: K
    let kelvin: number;
    if (from === "C") kelvin = value + 273.15;
    else if (from === "F") kelvin = (value - 32) * (5 / 9) + 273.15;
    else kelvin = value;

    if (to === "C") result = kelvin - 273.15;
    else if (to === "F") result = (kelvin - 273.15) * (9 / 5) + 32;
    else result = kelvin;
  } else if (cat === "flow") {
    // 기준: L/min
    const toLmin: Record<string, number> = { Lmin: 1, m3h: 1000 / 60, GPM: 3.78541 };
    const inLmin = value * toLmin[from];
    result = inLmin / toLmin[to];
  } else {
    // rotation: 기준 rpm
    if (from === "rpm" && to === "rads") result = value * (2 * Math.PI / 60);
    else result = value / (2 * Math.PI / 60);
  }

  const rounded = Math.round(result * 10000) / 10000;
  const unitLabels: Record<string, string> = {
    bar: "bar", psi: "psi", MPa: "MPa", kPa: "kPa",
    C: "°C", F: "°F", K: "K",
    Lmin: "L/min", m3h: "m³/h", GPM: "GPM",
    rpm: "rpm", rads: "rad/s",
  };
  return `${value} ${unitLabels[from]} = ${rounded} ${unitLabels[to]}`;
}

// ==============================================================================
// Alarm Lookup
// ==============================================================================
function lookupAlarm(alarmCode: string): string {
  const dbPath = path.join(process.cwd(), "data", "alarm-codes.json");

  if (!fs.existsSync(dbPath)) {
    return `알람 코드 DB가 없습니다. data/alarm-codes.json 파일을 생성해 주세요.`;
  }

  try {
    const raw = fs.readFileSync(dbPath, "utf-8");
    const db: Record<string, any> = JSON.parse(raw);
    const code = alarmCode.toUpperCase().trim();

    // 1) Exact match
    let entry = db[code];
    let matchedCode = code;

    // 2) Partial match: 점/하이픈/언더스코어 구분자 포함 다양한 형식 지원
    // 예: "OC1" → "E.OC1", "001" → "AL-001", "F0001" → "F0001"
    if (!entry) {
      const keys = Object.keys(db);
      const cUp = code;
      const cStripped = cUp.replace(/[.\-_]/g, "");
      const partialKey = keys.find((k) => {
        const kUp = k.toUpperCase();
        const kStripped = kUp.replace(/[.\-_]/g, "");
        return (
          kUp === cUp ||
          kUp.endsWith(`.${cUp}`) ||
          kUp.endsWith(`-${cUp}`) ||
          kUp.endsWith(`_${cUp}`) ||
          kStripped === cStripped
        );
      });
      if (partialKey) {
        entry = db[partialKey];
        matchedCode = partialKey;
      }
    }

    if (!entry) {
      return `알람 코드 '${code}'를 DB에서 찾을 수 없습니다. 매뉴얼을 직접 확인하세요.`;
    }

    const causes = (entry.causes as string[]).map((c, i) => `  ${i + 1}. ${c}`).join("\n");
    const actions = (entry.actions as string[]).map((a, i) => `  ${i + 1}. ${a}`).join("\n");

    return `[${matchedCode}] ${entry.name}
의미: ${entry.meaning}
원인:
${causes}
조치:
${actions}`;
  } catch {
    return `알람 코드 DB 읽기 오류. data/alarm-codes.json 파일 형식을 확인하세요.`;
  }
}

// ==============================================================================
// 통합 실행 함수
// ==============================================================================
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
    result = safeCalculator(String(args.expression ?? ""));
  } else if (toolName === "unit_converter") {
    result = convertUnit(
      Number(args.value ?? 0),
      String(args.from_unit ?? ""),
      String(args.to_unit ?? "")
    );
  } else if (toolName === "alarm_lookup") {
    result = lookupAlarm(String(args.alarm_code ?? ""));
  }

  return {
    content: result,
    log: { toolName, args, result },
  };
}

// ==============================================================================
// LangChain DynamicTool 형식 export (langchain/agent.ts에서 사용)
// ==============================================================================
export async function getLangChainToolsAsync() {
  const { DynamicStructuredTool } = await import("@langchain/core/tools");
  const { z } = await import("zod");

  return [
    new DynamicStructuredTool({
      name: "calculator",
      description: "수학 계산 수행. 예: '1200 * 0.15 + 300', 'round(10.234, 2)', 'sqrt(144)'",
      schema: z.object({ expression: z.string().describe("계산할 수식 문자열") }),
      func: async ({ expression }: { expression: string }) =>
        safeCalculator(expression),
    }),
    new DynamicStructuredTool({
      name: "unit_converter",
      description:
        "산업 단위 변환 (압력: bar/psi/MPa/kPa, 온도: C/F/K, 유량: Lmin/m3h/GPM, 회전: rpm/rads)",
      schema: z.object({
        value: z.number().describe("변환할 수치"),
        from_unit: z.string().describe("원본 단위"),
        to_unit: z.string().describe("변환 대상 단위"),
      }),
      func: async ({ value, from_unit, to_unit }: { value: number; from_unit: string; to_unit: string }) =>
        convertUnit(value, from_unit, to_unit),
    }),
    new DynamicStructuredTool({
      name: "alarm_lookup",
      description: "알람 코드로 설비 알람 정보(의미/원인/조치) 조회",
      schema: z.object({ alarm_code: z.string().describe("조회할 알람 코드") }),
      func: async ({ alarm_code }: { alarm_code: string }) =>
        lookupAlarm(alarm_code),
    }),
  ];
}

/** Synchronous shim kept for backward-compat (agent.ts calls this) */
export function getLangChainTools() {
  // Return a promise-based wrapper; callers must await
  return getLangChainToolsAsync();
}
