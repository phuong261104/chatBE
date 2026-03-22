import {
  IPresenceUseCase,
  IPresenceRepository,
  UserPresenceState,
} from "../interface";
import Logger from "@share/utils/logger";

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
