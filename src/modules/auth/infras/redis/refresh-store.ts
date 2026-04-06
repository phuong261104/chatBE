import { IRefreshTokenStore } from "../token/refresh-token";

const REFRESH_PREFIX = "refresh:";

export class RedisRefreshTokenStore implements IRefreshTokenStore {
  private redisClient: any;

  constructor(redisClient: any) {
    this.redisClient = redisClient;
  }

  async store(jti: string, userId: string, deviceId: string): Promise<void> {
    const key = `${REFRESH_PREFIX}${jti}`;
    const value = JSON.stringify({ userId, deviceId });
    await this.redisClient.setEx(key, 7 * 24 * 60 * 60, value);
  }

  async get(jti: string): Promise<{ userId: string; deviceId: string } | null> {
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
}
