import express, { NextFunction, Request, Response } from "express";
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";
import { io as createSocketClient, Socket as ClientSocket } from "socket.io-client";
import { v7 } from "uuid";
import { responseErr } from "@share/app-error";
import { config } from "@share/component/config";
import { RedisClient } from "@share/component/redis-pubsub/redis";
import { createSocketIOServer } from "@share/component/socket-io";
import { responseFormatMiddleware, setupMiddlewares } from "@share/middleware";
import {
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageType,
} from "@modules/chat/model";
import {
  DynamoConversationMemberRepository,
  DynamoConversationRepository,
  DynamoMessageReactionCommandRepository,
  DynamoMessageRepository,
  DynamoPollCommandRepository,
  setupMessagingHexagon,
} from "@modules/chat";
import { DynamoGroupNoteRepository, DynamoGroupReminderRepository } from "@modules/chat/infras";
import { DynamoMessageClassificationRepository } from "@modules/chat/infras/repository/dynamodb/message-classification-repo";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";
import { FriendshipStatus } from "@modules/friendships/model/model";
import { DynamoUserRepository } from "@modules/user/infras/repository/dynamodb/dynamodb-repo";
import { UserStatus as UserAccountStatus } from "@modules/user/model/model";

type ApiResponse<T = any> = { status: number; data: T };

export type LiveUser = {
  id: string;
  displayName: string;
};

export type LiveChatE2EHarness = {
  baseURL: string;
  repos: {
    conversation: DynamoConversationRepository;
    member: DynamoConversationMemberRepository;
    message: DynamoMessageRepository;
    reactionCommand: DynamoMessageReactionCommandRepository;
    classification: DynamoMessageClassificationRepository;
    pollCommand: DynamoPollCommandRepository;
    reminder: DynamoGroupReminderRepository;
    note: DynamoGroupNoteRepository;
    friendship: DynamoFriendshipRepository;
    user: DynamoUserRepository;
  };
  api: {
    get: (path: string, userId: string) => Promise<ApiResponse>;
    post: (path: string, body: any, userId: string) => Promise<ApiResponse>;
    put: (path: string, body: any, userId: string) => Promise<ApiResponse>;
    patch: (path: string, body: any, userId: string) => Promise<ApiResponse>;
    delete: (path: string, userId: string, body?: any) => Promise<ApiResponse>;
  };
  authHeader: (userId: string) => Record<string, string>;
  tokenFor: (userId: string) => string;
  connectMessagesSocket: (userId: string) => Promise<ClientSocket>;
  trackConversation: (id: string) => void;
  trackUser: (id: string) => void;
  trackFriendship: (userA: string, userB: string) => void;
  close: () => Promise<void>;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let redisInitPromise: Promise<void> | null = null;

async function ensureRedisInitialized() {
  const redisUrl = config.redis.url || config.redis.host;
  if (!redisUrl) return;
  if (!redisInitPromise) {
    redisInitPromise = RedisClient.init(redisUrl).catch(() => undefined);
  }
  await redisInitPromise;
}

export async function eventually(
  assertion: () => Promise<void> | void,
  timeoutMs = 8_000,
  intervalMs = 150,
) {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await delay(intervalMs);
    }
  }

  throw lastError;
}

export function waitForSocketEvent<T = any>(
  socket: ClientSocket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 8_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    };

    socket.on(event, onEvent);
  });
}

export function emitWithAck<T = any>(
  socket: ClientSocket,
  event: string,
  payload: any,
  timeoutMs = 8_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ack: ${event}`)), timeoutMs);
    socket.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

export async function createLiveChatE2EHarness(): Promise<LiveChatE2EHarness> {
  await ensureRedisInitialized();

  const userRepo = new DynamoUserRepository();
  const conversationRepo = new DynamoConversationRepository();
  const memberRepo = new DynamoConversationMemberRepository();
  const messageRepo = new DynamoMessageRepository();
  const reactionCommandRepo = new DynamoMessageReactionCommandRepository();
  const classificationRepo = new DynamoMessageClassificationRepository();
  const pollCommandRepo = new DynamoPollCommandRepository();
  const reminderRepo = new DynamoGroupReminderRepository();
  const noteRepo = new DynamoGroupNoteRepository();
  const friendshipRepo = new DynamoFriendshipRepository();

  const clients: ClientSocket[] = [];
  const trackedConversationIds = new Set<string>();
  const trackedUserIds = new Set<string>();
  const trackedFriendshipKeys = new Set<string>();
  const tokenCache = new Map<string, string>();

  const tokenFor = (userId: string) => {
    const cached = tokenCache.get(userId);
    if (cached) return cached;

    const token = jwt.sign(
      {
        sub: userId,
        role: "user",
        type: "access",
        jti: v7(),
        tokenVersion: 1,
      },
      config.accessToken.secretKey,
      { expiresIn: config.accessToken.expiresIn as any },
    );
    tokenCache.set(userId, token);
    return token;
  };

  const authIntrospector = {
    async introspect(token: string) {
      try {
        const payload = jwt.verify(token, config.accessToken.secretKey) as any;
        const user = payload?.sub ? await userRepo.get(payload.sub) : null;
        if (!user || (user as any).tokenVersion !== payload.tokenVersion) {
          return { payload: null, isOk: false };
        }
        return { payload, isOk: true };
      } catch {
        return { payload: null, isOk: false };
      }
    },
  };

  const app = express();
  const httpServer = createServer(app);
  const io = createSocketIOServer(httpServer);
  const sctx = { mdlFactory: setupMiddlewares(authIntrospector) };
  const { router, v2Router } = setupMessagingHexagon(io, sctx);

  app.use(express.json());
  app.use("/v1", responseFormatMiddleware);
  app.use("/v2", responseFormatMiddleware);
  app.use("/v1", router);
  app.use("/v2", v2Router);
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => responseErr(err, res));

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  const baseURL = `http://127.0.0.1:${port}`;

  const request = async (method: string, path: string, body: any, userId: string) => {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenFor(userId)}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const raw = await response.text();
    let data: any = raw;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }
    return { status: response.status, data };
  };

  const cleanup = async () => {
    for (const conversationId of Array.from(trackedConversationIds).reverse()) {
      await noteRepo.deleteByConversationId(conversationId).catch(() => undefined);
      await reminderRepo.deleteByConversationId(conversationId).catch(() => undefined);
      await pollCommandRepo.deleteByConversationId(conversationId).catch(() => undefined);
      await reactionCommandRepo.deleteByConversationId(conversationId).catch(() => undefined);
      await classificationRepo.deleteByConversationId(conversationId).catch(() => undefined);
      await messageRepo.deleteByConversationId(conversationId).catch(() => undefined);
      await memberRepo.deleteByConversationId(conversationId).catch(() => undefined);
      await conversationRepo.delete(conversationId, true).catch(() => undefined);
    }

    for (const key of Array.from(trackedFriendshipKeys).reverse()) {
      const [userA, userB] = key.split("#");
      await friendshipRepo.softDeleteFriendship(userA, userB).catch(() => undefined);
    }

    for (const userId of Array.from(trackedUserIds).reverse()) {
      await userRepo.delete(userId, true).catch(() => undefined);
    }
  };

  return {
    baseURL,
    repos: {
      conversation: conversationRepo,
      member: memberRepo,
      message: messageRepo,
      reactionCommand: reactionCommandRepo,
      classification: classificationRepo,
      pollCommand: pollCommandRepo,
      reminder: reminderRepo,
      note: noteRepo,
      friendship: friendshipRepo,
      user: userRepo,
    },
    api: {
      get: (path, userId) => request("GET", path, undefined, userId),
      post: (path, body, userId) => request("POST", path, body, userId),
      put: (path, body, userId) => request("PUT", path, body, userId),
      patch: (path, body, userId) => request("PATCH", path, body, userId),
      delete: (path, userId, body) => request("DELETE", path, body, userId),
    },
    authHeader: (userId) => ({ Authorization: `Bearer ${tokenFor(userId)}` }),
    tokenFor,
    connectMessagesSocket: async (userId: string) => {
      const socket = createSocketClient(`${baseURL}/messages`, {
        auth: { token: tokenFor(userId), deviceId: `live-e2e-${userId}` },
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
      });
      clients.push(socket);

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out connecting messages socket")), 8_000);
        socket.once("connect", () => {
          clearTimeout(timer);
          resolve();
        });
        socket.once("connect_error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      await delay(250);

      return socket;
    },
    trackConversation: (id) => trackedConversationIds.add(id),
    trackUser: (id) => trackedUserIds.add(id),
    trackFriendship: (userA, userB) => trackedFriendshipKeys.add([userA, userB].sort().join("#")),
    close: async () => {
      for (const client of clients) {
        client.disconnect();
      }
      await cleanup();
      await new Promise<void>((resolve) => (io as SocketIOServer).close(() => resolve()));
      await new Promise<void>((resolve) => (httpServer as HttpServer).close(() => resolve()));
    },
  };
}

export async function seedUser(
  harness: LiveChatE2EHarness,
  displayName: string,
): Promise<LiveUser> {
  const suffix = v7().replace(/-/g, "").slice(-16);
  const user: any = {
    id: v7(),
    email: `live-e2e-${suffix}@chatbe.test`,
    phone: `849${suffix.replace(/\D/g, "").padEnd(9, "0").slice(0, 9)}`,
    username: `live_${suffix}`,
    password: "hashed-by-live-e2e",
    salt: "live-e2e",
    status: UserAccountStatus.ACTIVE,
    tokenVersion: 1,
    verified: { email: true, phone: true },
    displayName,
    privacy: {
      searchableByEmail: true,
      searchableByPhone: true,
      searchableByUsername: true,
      birthdayVisibility: "friends",
      phoneVisibility: "friends",
      avatarVisibility: "everyone",
      showOnline: true,
      showLastSeen: true,
      blockMessagesFromStrangers: false,
    },
    settings: { notifications: { push: false, inApp: false } },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await harness.repos.user.insert(user);
  harness.trackUser(user.id);
  return { id: user.id, displayName };
}

export async function seedFriendship(
  harness: LiveChatE2EHarness,
  userA: string,
  userB: string,
) {
  const [a, b] = [userA, userB].sort();
  const friendship = {
    id: v7(),
    userA: a,
    userB: b,
    status: FriendshipStatus.ACTIVE,
    createdAt: new Date(),
  };

  await harness.repos.friendship.insert(friendship as any);
  harness.trackFriendship(a, b);
  await eventually(async () => {
    const saved = await harness.repos.friendship.findByCond({ userA: a, userB: b });
    expect(saved?.status).toBe(FriendshipStatus.ACTIVE);
  });
  return friendship;
}

export async function seedConversation(
  harness: LiveChatE2EHarness,
  overrides: Partial<{
    type: ConversationType;
    name: string;
    pairKey: string;
    createdBy: string;
    ownerId: string;
    admins: string[];
    membersCount: number;
  }>,
) {
  const now = new Date();
  const conversation = {
    id: v7(),
    type: overrides.type || ConversationType.PRIVATE,
    pairKey: overrides.pairKey,
    name: overrides.name,
    createdBy: overrides.createdBy,
    ownerId: overrides.ownerId,
    admins: overrides.admins || [],
    membersCount: overrides.membersCount || 0,
    createdAt: now,
    updatedAt: now,
  } as any;

  await harness.repos.conversation.insert(conversation);
  harness.trackConversation(conversation.id);
  return conversation;
}

export async function seedMember(
  harness: LiveChatE2EHarness,
  data: {
    conversationId: string;
    userId: string;
    role?: ConversationMemberRole;
    status?: ConversationMemberStatus;
    joinedAt?: Date;
  },
) {
  const now = new Date();
  const member = {
    id: v7(),
    conversationId: data.conversationId,
    userId: data.userId,
    role: data.role || ConversationMemberRole.MEMBER,
    status: data.status || ConversationMemberStatus.ACTIVE,
    joinedAt: data.joinedAt || now,
    unreadCount: 0,
    lastReadAt: null,
    lastSeenAt: null,
    lastDeliveredAt: null,
    muteUntil: null,
    pinned: false,
    archived: false,
    hiddenUserIds: [],
    hidden: false,
    lastActivityAt: now,
    updatedAt: now,
  } as any;

  await harness.repos.member.insert(member);
  await eventually(async () => {
    const saved = await harness.repos.member.findByCond({
      conversationId: data.conversationId,
      userId: data.userId,
    });
    expect(saved?.id).toBe(member.id);
  });
  return member;
}

export async function seedPrivateConversation(
  harness: LiveChatE2EHarness,
  userA?: LiveUser,
  userB?: LiveUser,
) {
  const a = userA || (await seedUser(harness, "Live Alice"));
  const b = userB || (await seedUser(harness, "Live Bob"));
  const conversation = await seedConversation(harness, {
    type: ConversationType.PRIVATE,
    pairKey: [a.id, b.id].sort().join("_"),
    membersCount: 2,
  });
  await seedMember(harness, { conversationId: conversation.id, userId: a.id });
  await seedMember(harness, { conversationId: conversation.id, userId: b.id });
  return { userA: a, userB: b, conversation };
}

export async function seedGroupConversation(
  harness: LiveChatE2EHarness,
  memberCount = 3,
) {
  const labels = ["Live Owner", "Live Admin", "Live Member", "Live Extra"];
  const users = await Promise.all(
    Array.from({ length: memberCount }, (_, index) => seedUser(harness, labels[index] || `Live User ${index + 1}`)),
  );
  const conversation = await seedConversation(harness, {
    type: ConversationType.GROUP,
    name: "Live Team",
    createdBy: users[0].id,
    ownerId: users[0].id,
    admins: [users[1]?.id].filter(Boolean),
    membersCount: users.length,
  });

  await Promise.all(
    users.map((user, index) =>
      seedMember(harness, {
        conversationId: conversation.id,
        userId: user.id,
        role:
          index === 0
            ? ConversationMemberRole.OWNER
            : index === 1
              ? ConversationMemberRole.ADMIN
              : ConversationMemberRole.MEMBER,
        joinedAt: new Date(Date.UTC(2026, 0, index + 1)),
      }),
    ),
  );

  return {
    owner: users[0],
    admin: users[1],
    member: users[2],
    users,
    conversation,
  };
}

export async function seedMessage(
  harness: LiveChatE2EHarness,
  data: {
    conversationId: string;
    senderId: string;
    text?: string;
    type?: MessageType;
    createdAt?: Date;
    media?: any[];
    links?: string[];
  },
): Promise<Message> {
  const message = {
    id: v7(),
    conversationId: data.conversationId,
    senderId: data.senderId,
    type: data.type || MessageType.TEXT,
    text: data.text,
    media: data.media,
    links: data.links || [],
    createdAt: data.createdAt || new Date(),
    pinned: false,
  } as Message;

  await harness.repos.message.insert(message);
  await eventually(async () => {
    const saved = await harness.repos.message.get(message.id);
    expect(saved?.id).toBe(message.id);
  });
  return message;
}
