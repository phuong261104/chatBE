import { Request, Response, NextFunction } from "express";
import { RedisClient } from "@share/component/redis-pubsub/redis";
import { AppError, responseErr } from "@share/app-error";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export interface RateLimitConfig {
  max: number;
  windowSec: number;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (process.env.NODE_ENV !== "production") {
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

export function createRateLimitMiddleware(config: RateLimitConfig) {
  const {
    max,
    windowSec,
    keyPrefix = "global",
    keyGenerator = (req: Request) => req.ip || "unknown",
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `ratelimit:${keyPrefix}:${keyGenerator(req)}`;

    const { allowed, remaining, resetIn } = await checkRateLimit(
      key,
      max,
      windowSec,
    );

    res.setHeader("X-RateLimit-Limit", max.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(Date.now() / 1000 + resetIn).toString(),
    );

    if (!allowed) {
      res.setHeader("Retry-After", Math.ceil(resetIn).toString());
      const err = AppError.from(
        new Error("Too many requests, please try again later."),
        429,
      );
      return responseErr(err, res);
    }

    next();
  };
}
