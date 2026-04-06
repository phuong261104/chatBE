import { ISessionStore, DeviceInfo, Session } from "@share/interface";

const SESSION_PREFIX = "session:";
const USER_SESSIONS_PREFIX = "user:sessions:";
const SESSION_TTL = 30 * 24 * 60 * 60;

export class RedisSessionStore implements ISessionStore {
  private redisClient: any;

  constructor(redisClient: any) {
    this.redisClient = redisClient;
  }

  async create(userId: string, deviceInfo: DeviceInfo, refreshTokenJti: string): Promise<Session> {
    const session: Session = {
      userId,
      deviceId: deviceInfo.deviceId,
      deviceInfo,
      refreshTokenJti,
      createdAt: new Date(),
      lastActive: new Date(),
    };

    const sessionKey = `${SESSION_PREFIX}${deviceInfo.deviceId}`;
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

    await this.redisClient.setEx(sessionKey, SESSION_TTL, JSON.stringify(session));
    await this.redisClient.sAdd(userSessionsKey, deviceInfo.deviceId);
    await this.redisClient.expire(userSessionsKey, SESSION_TTL);

    return session;
  }

  async get(deviceId: string): Promise<Session | null> {
    const sessionKey = `${SESSION_PREFIX}${deviceId}`;
    const result = await this.redisClient.get(sessionKey);
    if (!result) return null;
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }

  async update(deviceId: string, data: Partial<Session>): Promise<void> {
    const sessionKey = `${SESSION_PREFIX}${deviceId}`;
    const existing = await this.get(deviceId);
    if (!existing) return;

    const updated: Session = {
      ...existing,
      ...data,
      lastActive: new Date(),
    };

    await this.redisClient.setEx(sessionKey, SESSION_TTL, JSON.stringify(updated));
  }

  async delete(deviceId: string): Promise<void> {
    const sessionKey = `${SESSION_PREFIX}${deviceId}`;
    const session = await this.get(deviceId);

    await this.redisClient.del(sessionKey);

    if (session) {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${session.userId}`;
      await this.redisClient.sRem(userSessionsKey, deviceId);
    }
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    const deviceIds = await this.redisClient.sMembers(userSessionsKey);

    for (const deviceId of deviceIds) {
      const sessionKey = `${SESSION_PREFIX}${deviceId}`;
      await this.redisClient.del(sessionKey);
    }

    await this.redisClient.del(userSessionsKey);
  }

  async listByUser(userId: string): Promise<Session[]> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    const deviceIds = await this.redisClient.sMembers(userSessionsKey);

    const sessions: Session[] = [];
    for (const deviceId of deviceIds) {
      const session = await this.get(deviceId);
      if (session) {
        sessions.push(session);
      } else {
        await this.redisClient.sRem(userSessionsKey, deviceId);
      }
    }

    return sessions;
  }
}
