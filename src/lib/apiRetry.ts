/**
 * API 호출 재시도 헬퍼 — 지수 백오프 적용
 *
 * @param fn        재시도할 비동기 함수
 * @param retries   최대 재시도 횟수 (기본 3)
 * @param backoffMs 초기 대기 시간 ms (기본 500 → 1000 → 2000)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  backoffMs = 500
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, backoffMs * Math.pow(2, attempt))
        );
      }
    }
  }

  throw lastError;
}
