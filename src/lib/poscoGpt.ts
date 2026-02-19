import type { SearchResult, SourceReference } from "@/types";

const POSCO_GPT_URL = "http://aigpt.posco.net/gpgpta01-gpt/gptApi/personalApi";
const POSCO_GPT_MODEL = "gpt-4o";
const SYSTEM_PROMPT = "당신은 산업 설비 유지보수 전문가입니다.";

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

export async function callPoscoGpt(
  question: string,
  results: SearchResult[]
): Promise<GptCallResult> {
  const apiKey = process.env.POSCO_GPT_KEY;
  if (!apiKey) {
    throw new Error("POSCO_GPT_KEY 환경변수가 설정되지 않았습니다.");
  }

  const { context, sources } = buildContextFromResults(results);
  const userPrompt = buildUserPrompt(context, question);

  const payload = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    model: POSCO_GPT_MODEL,
  };

  const response = await fetch(POSCO_GPT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`POSCO GPT API 오류: HTTP ${response.status}`);
  }

  const rawText = await response.text();

  let answer: string;
  try {
    const json = JSON.parse(rawText);
    if (json.choices?.[0]?.message?.content) {
      answer = json.choices[0].message.content;
    } else if (json.content) {
      answer = json.content;
    } else {
      answer = rawText;
    }
  } catch {
    answer = rawText;
  }

  return { answer, sources };
}
