import {
  IPresenceUseCase,
  IPresenceRepository,
  UserPresenceState,
} from "../interface";
import Logger from "@share/utils/logger";

const SOCKET_TTL_SECONDS = 90;

export class PresenceUseCase implements IPresenceUseCase {
  constructor(private readonly presenceRepo: IPresenceRepository) {}

  async markUserOnline(userId: string): Promise<void> {
    try {
      const now = Date.now();
      await this.presenceRepo.setOnline(userId, 60); // TTL 60s
      await this.presenceRepo.updateLastSeen(userId, now);
    } catch (error) {
      Logger.error(`markUserOnline error: ${(error as Error).message}`);
    }
  }

  async markUserOffline(userId: string): Promise<void> {
    try {
      const now = Date.now();
      await this.presenceRepo.setOffline(userId);
      await this.presenceRepo.updateLastSeen(userId, now);
    } catch (error) {
      Logger.error(`markUserOffline error: ${(error as Error).message}`);
    }
  }

  async registerSocket(userId: string, socketId: string): Promise<{ becameOnline: boolean; connectionCount: number }> {
    try {
      const connectionCount = await this.presenceRepo.registerSocket(userId, socketId, SOCKET_TTL_SECONDS);
      await this.presenceRepo.updateLastSeen(userId, Date.now());
      return { becameOnline: connectionCount === 1, connectionCount };
    } catch (error) {
      Logger.error(`registerSocket error: ${(error as Error).message}`);
      return { becameOnline: false, connectionCount: 0 };
    }
  }

  async touchSocket(userId: string, socketId: string): Promise<{ isOnline: boolean; connectionCount: number }> {
    try {
      const connectionCount = await this.presenceRepo.touchSocket(userId, socketId, SOCKET_TTL_SECONDS);
      await this.presenceRepo.updateLastSeen(userId, Date.now());
      return { isOnline: connectionCount > 0, connectionCount };
    } catch (error) {
      Logger.error(`touchSocket error: ${(error as Error).message}`);
      return { isOnline: false, connectionCount: 0 };
    }
  }

  async unregisterSocket(userId: string, socketId: string): Promise<{ becameOffline: boolean; connectionCount: number }> {
    try {
      const connectionCount = await this.presenceRepo.unregisterSocket(userId, socketId);
      if (connectionCount === 0) {
        await this.presenceRepo.updateLastSeen(userId, Date.now());
      }
      return { becameOffline: connectionCount === 0, connectionCount };
    } catch (error) {
      Logger.error(`unregisterSocket error: ${(error as Error).message}`);
      return { becameOffline: false, connectionCount: 0 };
    }
  }

  async getUserPresence(userId: string): Promise<UserPresenceState> {
    try {
      const [isOnline, lastSeen] = await Promise.all([
        this.presenceRepo.isOnline(userId),
        this.presenceRepo.getLastSeen(userId),
      ]);

      return {
        isOnline,
        lastSeen,
      };
    } catch (error) {
      Logger.error(`getUserPresence error: ${(error as Error).message}`);
      return {
        isOnline: false,
        lastSeen: null,
      };
    }
  }
}
