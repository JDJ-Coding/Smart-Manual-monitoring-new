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
    "Xenova/multilingual-e5-small",
    { dtype: "q8" }
  );

  return pipelineInstance;
}

export async function embedText(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  // e5 model requires "query: " prefix for questions
  const output = await pipe(`query: ${text}`, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}

export async function embedPassage(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  // e5 model requires "passage: " prefix for documents
  const output = await pipe(`passage: ${text}`, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}
