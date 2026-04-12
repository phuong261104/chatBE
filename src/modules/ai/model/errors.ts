export class AiError extends Error {
  constructor(
    public code: "AI_PROVIDER_ERROR" | "AI_RATE_LIMIT" | "AI_TIMEOUT" | "AI_INVALID_RESPONSE",
    message: string,
    public statusCode = 500
  ) {
    super(message);
    this.name = "AiError";
  }
}
