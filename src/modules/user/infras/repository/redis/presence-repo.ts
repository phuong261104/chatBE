import { IPresenceRepository } from "@modules/user/interface";
import { RedisClient } from "@share/component/redis-pubsub/redis";
import Logger from "@share/utils/logger";

export class RedisPresenceRepository implements IPresenceRepository {
  async setOnline(userId: string, ttlSeconds: number): Promise<void> {
    try {
      const redisClient = RedisClient.getInstance().redisClient;
      await redisClient.setEx(`online:${userId}`, ttlSeconds, "1");
    } catch (error) {
      Logger.error(`Redis setOnline error: ${(error as Error).message}`);
    }
  }

  async setOffline(userId: string): Promise<void> {
    try {
      const redisClient = RedisClient.getInstance().redisClient;
      await redisClient.del(`online:${userId}`);
    } catch (error) {
      Logger.error(`Redis setOffline error: ${(error as Error).message}`);
    }
  }

  async updateLastSeen(userId: string, timestamp: number): Promise<void> {
    try {
      const redisClient = RedisClient.getInstance().redisClient;
      await redisClient.set(`last_seen:${userId}`, timestamp.toString());
    } catch (error) {
      Logger.error(`Redis updateLastSeen error: ${(error as Error).message}`);
    }
  }

  async isOnline(userId: string): Promise<boolean> {
    try {
      const redisClient = RedisClient.getInstance().redisClient;
      const status = await redisClient.get(`online:${userId}`);
      return status === "1";
    } catch (error) {
      Logger.error(`Redis isOnline error: ${(error as Error).message}`);
      return false;
    }
  }

  async getLastSeen(userId: string): Promise<number | null> {
    try {
      const redisClient = RedisClient.getInstance().redisClient;
      const lastSeen = await redisClient.get(`last_seen:${userId}`);

      if (!lastSeen) {
        return null;
      }

      const parsedTimestamp = Number(lastSeen);
      if (Number.isNaN(parsedTimestamp)) {
        return null;
      }

      return parsedTimestamp;
    } catch (error) {
      Logger.error(`Redis getLastSeen error: ${(error as Error).message}`);
      return null;
    }
  }
}
