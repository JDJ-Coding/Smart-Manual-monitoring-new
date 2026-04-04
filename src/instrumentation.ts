/**
 * Next.js Instrumentation Hook
 *
 * 서버 부팅 시점에 HuggingFace ONNX 임베딩 모델을 사전 로드(warm-up)한다.
 * 이 파일이 없으면 첫 번째 사용자 질의에서 10~20초 Cold Start 지연이 발생한다.
 *
 * 참고: next.config.mjs 의 serverComponentsExternalPackages 에
 *       @huggingface/transformers 가 이미 등록되어 있어 별도 설정 불필요.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Edge Runtime 에서는 ONNX 모델을 로드할 수 없으므로 Node.js 런타임만 처리
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      console.log("[instrumentation] 임베딩 모델 사전 로드 시작...");
      const { embedText } = await import("@/lib/embeddings");
      // 빈 문자열로 파이프라인 초기화만 트리거 (결과는 무시)
      await embedText("warm-up");
      console.log("[instrumentation] 임베딩 모델 사전 로드 완료 ✓");
    } catch (err) {
      // 모델 로드 실패 시 서버 시작 자체를 막지 않는다 (non-blocking)
      console.warn("[instrumentation] 임베딩 모델 사전 로드 실패 (첫 요청에서 재시도):", err);
    }
  }
}
