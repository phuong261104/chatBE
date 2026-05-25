import { IRefreshTokenStore } from "../token/refresh-token";
import { AuthRedisClient, RefreshTokenRecord } from "../../interface";

const REFRESH_PREFIX = "refresh:";
const USED_REFRESH_PREFIX = "refresh:used:";

export class RedisRefreshTokenStore implements IRefreshTokenStore {
  private redisClient: AuthRedisClient;

  constructor(redisClient: AuthRedisClient) {
    this.redisClient = redisClient;
  }

  async store(jti: string, userId: string, deviceId: string, tokenVersion: number, expiresInSeconds: number): Promise<void> {
    const key = `${REFRESH_PREFIX}${jti}`;
    const value = JSON.stringify({ userId, deviceId, tokenVersion });
    await this.redisClient.setEx(key, expiresInSeconds, value);
  }

  async get(jti: string): Promise<RefreshTokenRecord | null> {
    const key = `${REFRESH_PREFIX}${jti}`;
    const result = await this.redisClient.get(key);
    if (!result) return null;
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }

  async revoke(jti: string): Promise<void> {
    const key = `${REFRESH_PREFIX}${jti}`;
    await this.redisClient.del(key);
  }

  async consume(jti: string, usedTtlSeconds: number): Promise<void> {
    const current = await this.get(jti);
    await this.revoke(jti);
    if (!current || usedTtlSeconds <= 0) return;

    await this.redisClient.setEx(
      `${USED_REFRESH_PREFIX}${jti}`,
      usedTtlSeconds,
      JSON.stringify(current),
    );
  }

  async getUsed(jti: string): Promise<RefreshTokenRecord | null> {
    const result = await this.redisClient.get(`${USED_REFRESH_PREFIX}${jti}`);
    if (!result) return null;
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }
}
