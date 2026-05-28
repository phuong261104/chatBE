import { Request, Response, NextFunction } from "express";
import { RedisClient } from "@share/component/redis-pubsub/redis";

const AI_RATE_LIMITS: Record<string, { max: number; windowSec: number }> = {
  summarize: { max: 10, windowSec: 60 },
  "smart-reply": { max: 20, windowSec: 60 },
  "tone-adjust": { max: 10, windowSec: 60 },
  translate: { max: 20, windowSec: 60 },
  "detect-language": { max: 10, windowSec: 60 },
  "smart-search": { max: 10, windowSec: 60 },
  "extract-tasks": { max: 10, windowSec: 60 },
  moderate: { max: 10, windowSec: 60 },
};

const REDIS_KEY_PREFIX = "ai:ratelimit:";

function getAiEndpoint(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

export function aiRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const endpoint = getAiEndpoint(req.path);
  const limitConfig = AI_RATE_LIMITS[endpoint];

  if (!limitConfig) {
    return next();
  }

  const userId = (req as any).user?.sub as string | undefined;
  if (!userId) {
    return next();
  }

  const key = `${REDIS_KEY_PREFIX}${endpoint}:${userId}`;
  const { max, windowSec } = limitConfig;

  checkAndIncrement(key, max, windowSec)
    .then(({ allowed, remaining, resetIn }) => {
      res.set("X-RateLimit-Limit", max.toString());
      res.set("X-RateLimit-Remaining", remaining.toString());
      res.set("X-RateLimit-Reset", Math.ceil(Date.now() / 1000 + resetIn).toString());

      if (!allowed) {
        res.set("Retry-After", Math.ceil(resetIn).toString());
        return res.status(429).json({
          error: {
            code: "AI_RATE_LIMIT",
            message: "Bạn đã sử dụng quá nhiều yêu cầu AI. Vui lòng chờ một lát rồi thử lại.",
          },
          retryAfter: Math.ceil(resetIn),
        });
      }

      next();
    })
    .catch(() => {
      next();
    });
}

async function checkAndIncrement(
  key: string,
  max: number,
  windowSec: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const redis = RedisClient.getClient();
  const fullKey = `ratelimit:${key}`;

  const current = await redis.incr(fullKey);

  if (current === 1) {
    await redis.expire(fullKey, windowSec);
  }

  const ttl = await redis.ttl(fullKey);
  const resetIn = ttl > 0 ? ttl : windowSec;

  if (current > max) {
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining: max - current, resetIn };
}
