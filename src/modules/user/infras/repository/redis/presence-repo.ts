import { IPresenceRepository } from "@modules/user/interface";
import { RedisClient } from "@share/component/redis-pubsub/redis";
import Logger from "@share/utils/logger";

const onlineKey = (userId: string) => `online:${userId}`;
const lastSeenKey = (userId: string) => `last_seen:${userId}`;
const userSocketsKey = (userId: string) => `presence:user:${userId}:sockets`;
const socketKey = (socketId: string) => `presence:socket:${socketId}`;

export class RedisPresenceRepository implements IPresenceRepository {
  async setOnline(userId: string, ttlSeconds: number): Promise<void> {
    try {
      const redisClient = RedisClient.getInstance().redisClient;
      await redisClient.setEx(onlineKey(userId), ttlSeconds, "1");
    } catch (error) {
      Logger.error(`Redis setOnline error: ${(error as Error).message}`);
    }
  }

  async setOffline(userId: string): Promise<void> {
    try {
      const redisClient = RedisClient.getInstance().redisClient;
      await redisClient.del(onlineKey(userId));
    } catch (error) {
      Logger.error(`Redis setOffline error: ${(error as Error).message}`);
    }
  }

  async registerSocket(userId: string, socketId: string, ttlSeconds: number): Promise<number> {
    try {
      const redisClient = RedisClient.getInstance().redisClient as any;
      await this.pruneUserSockets(userId);
      await redisClient.setEx(socketKey(socketId), ttlSeconds, userId);
      await redisClient.sAdd(userSocketsKey(userId), socketId);
      await redisClient.expire(userSocketsKey(userId), ttlSeconds * 2);
      await redisClient.setEx(onlineKey(userId), ttlSeconds, "1");
      return Number(await redisClient.sCard(userSocketsKey(userId)));
    } catch (error) {
      Logger.error(`Redis registerSocket error: ${(error as Error).message}`);
      return 0;
    }
  }

  async touchSocket(userId: string, socketId: string, ttlSeconds: number): Promise<number> {
    try {
      const redisClient = RedisClient.getInstance().redisClient as any;
      await redisClient.setEx(socketKey(socketId), ttlSeconds, userId);
      await redisClient.sAdd(userSocketsKey(userId), socketId);
      await redisClient.expire(userSocketsKey(userId), ttlSeconds * 2);
      await redisClient.setEx(onlineKey(userId), ttlSeconds, "1");
      return Number(await redisClient.sCard(userSocketsKey(userId)));
    } catch (error) {
      Logger.error(`Redis touchSocket error: ${(error as Error).message}`);
      return 0;
    }
  }

  async unregisterSocket(userId: string, socketId: string): Promise<number> {
    try {
      const redisClient = RedisClient.getInstance().redisClient as any;
      await redisClient.del(socketKey(socketId));
      await redisClient.sRem(userSocketsKey(userId), socketId);
      const count = await this.pruneUserSockets(userId);
      if (count <= 0) {
        await redisClient.del(onlineKey(userId));
        await redisClient.del(userSocketsKey(userId));
      } else {
        await redisClient.setEx(onlineKey(userId), 60, "1");
      }
      return count;
    } catch (error) {
      Logger.error(`Redis unregisterSocket error: ${(error as Error).message}`);
      return 0;
    }
  }

  async updateLastSeen(userId: string, timestamp: number): Promise<void> {
    try {
      const redisClient = RedisClient.getInstance().redisClient;
      await redisClient.set(lastSeenKey(userId), timestamp.toString());
    } catch (error) {
      Logger.error(`Redis updateLastSeen error: ${(error as Error).message}`);
    }
  }

  async isOnline(userId: string): Promise<boolean> {
    try {
      const redisClient = RedisClient.getInstance().redisClient;
      const socketCount = await this.pruneUserSockets(userId);
      if (socketCount > 0) return true;
      const status = await redisClient.get(onlineKey(userId));
      return status === "1";
    } catch (error) {
      Logger.error(`Redis isOnline error: ${(error as Error).message}`);
      return false;
    }
  }

  async getLastSeen(userId: string): Promise<number | null> {
    try {
      const redisClient = RedisClient.getInstance().redisClient;
      const lastSeen = await redisClient.get(lastSeenKey(userId));

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

  private async pruneUserSockets(userId: string): Promise<number> {
    const redisClient = RedisClient.getInstance().redisClient as any;
    const key = userSocketsKey(userId);
    const socketIds: string[] = await redisClient.sMembers(key);
    if (!socketIds || socketIds.length === 0) return 0;

    let liveCount = 0;
    for (const socketId of socketIds) {
      const socketUserId = await redisClient.get(socketKey(socketId));
      if (socketUserId === userId) {
        liveCount += 1;
      } else {
        await redisClient.sRem(key, socketId);
      }
    }
    return liveCount;
  }
}
