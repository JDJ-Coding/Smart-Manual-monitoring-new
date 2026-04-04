import path from "path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineInstance: any = null;

async function getEmbeddingPipeline() {
  if (pipelineInstance) return pipelineInstance;

  const { pipeline, env } = await import("@huggingface/transformers");

  // Point to local model directory - prevents any network requests
  env.localModelPath = path.join(process.cwd(), "model");
  env.allowRemoteModels = false;
  env.useBrowserCache = false;

  pipelineInstance = await pipeline(
    "feature-extraction",
    "Xenova/bge-m3",
    { dtype: "q8" }
  );

  return pipelineInstance;
}

export async function embedText(text: string): Promise<number[]> {
  if (!text || !text.trim()) return [];
  const pipe = await getEmbeddingPipeline();
  // BGE-M3 does not use instruction prefixes
  const output = await pipe(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}

// BGE-M3는 query/passage prefix 불필요 — embedText와 동일
export const embedPassage = embedText;
