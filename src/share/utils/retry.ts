export interface RetryOptions {
  retries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  retryOn?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 3,
    delayMs = 3000,
    backoffMultiplier = 1,
    retryOn = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries - 1 || !retryOn(error)) {
        throw error;
      }
      const delay = delayMs * Math.pow(backoffMultiplier, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
