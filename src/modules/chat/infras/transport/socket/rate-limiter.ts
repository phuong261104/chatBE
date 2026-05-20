const RATE_LIMIT_WINDOW = 60_000;

const RATE_LIMITS: Record<string, number> = {
  sendMessage: 60,
  typing: 30,
  addReaction: 60,
  editMessage: 30,
  deleteMessage: 30,
  forwardMessages: 30,
  quoteMessage: 60,
};

export class SocketRateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  check(userId: string, eventType: string): boolean {
    const key = userId + ":" + eventType;
    const now = Date.now();
    const limit = RATE_LIMITS[eventType] || 30;
    const entry = this.entries.get(key);

    if (!entry || now > entry.resetAt) {
      this.entries.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  }
}
