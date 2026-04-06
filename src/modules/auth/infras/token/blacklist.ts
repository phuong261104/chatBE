import { ITokenBlacklist } from "@share/interface";

const BLACKLIST_PREFIX = "blacklist:";

export class TokenBlacklistService implements ITokenBlacklist {
  private redisClient: any;

  constructor(redisClient: any) {
    this.redisClient = redisClient;
  }

  async add(tokenJti: string, expiresInSeconds: number): Promise<void> {
    const key = `${BLACKLIST_PREFIX}${tokenJti}`;
    await this.redisClient.setEx(key, expiresInSeconds, "1");
  }

  async isBlacklisted(tokenJti: string): Promise<boolean> {
    const key = `${BLACKLIST_PREFIX}${tokenJti}`;
    const result = await this.redisClient.get(key);
    return result === "1";
  }
}
