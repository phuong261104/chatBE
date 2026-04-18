import { RedisClient } from "@share/component/redis-pubsub/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (process.env.NODE_ENV !== 'production') {
    return { allowed: true, remaining: maxRequests, resetIn: windowSeconds };
  }

  const redis = RedisClient.getClient();
  const fullKey = `ratelimit:${key}`;

  const current = await redis.incr(fullKey);

  if (current === 1) {
    await redis.expire(fullKey, windowSeconds);
  }

  const ttl = await redis.ttl(fullKey);
  const resetIn = ttl > 0 ? ttl : windowSeconds;

  if (current > maxRequests) {
    return { allowed: false, remaining: 0, resetIn };
  }

  return {
    allowed: true,
    remaining: maxRequests - current,
    resetIn,
  };
}
