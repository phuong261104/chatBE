import "module-alias/register";

import axios, { AxiosInstance } from "axios";
import express, { NextFunction, Request, Response } from "express";
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { Server as SocketIOServer } from "socket.io";
import { io as createSocketClient, Socket as ClientSocket } from "socket.io-client";
import { v7 } from "uuid";

import { BlockHTTPService, BlockNotificationSocketService } from "@modules/blocks/infras";
import { BlockUseCase } from "@modules/blocks/usecase";
import { ChatV2Controller } from "@modules/chat/infras/transport/http/v2-chat-controller";
import { setupChatV2Routes } from "@modules/chat/infras/transport/http/v2-chat.routes";
import { MessagingHttpService, MessagingSocketService, MessagingHttpServiceDeps } from "@modules/chat/infras";
import { GroupInviteController } from "@modules/chat/infras/transport/http/group-invite-controller";
import { GroupBlockController } from "@modules/chat/infras/transport/http/group-block-controller";
import {
  GetGroupInviteLinkHandler,
  RegenerateGroupInviteLinkHandler,
  RevokeGroupInviteLinkHandler,
  PreviewInviteHandler,
} from "@modules/chat/usecase/get-group-invite-link";
import { JoinGroupByInviteHandler } from "@modules/chat/usecase/join-group-by-invite";
import {
  GetGroupBlocksHandler,
  BlockGroupMemberHandler,
  UnblockGroupMemberHandler,
} from "@modules/chat/usecase/group-block";
import { UserRepositoryAdapter } from "@modules/chat/infras/repository/local/user-adapter";
import { ConversationMemberRole, ConversationType, MessageType } from "@modules/chat/model";
import { FriendRequestHTTPService, FriendNotificationSocketService } from "@modules/friend-requests/infras";
import { FriendRequestStatus } from "@modules/friend-requests/model";
import { FriendRequestUseCase } from "@modules/friend-requests/usecase";
import { FriendshipHTTPService } from "@modules/friendships/infras";
import { FriendshipUseCase } from "@modules/friendships/usecase";
import { UserV2HTTPService } from "@modules/user/infras/transport/user-v2-http-service";
import { UserGender, UserInfoVisibility, UserStatus } from "@modules/user/model/model";
import { RelationshipPrivacyPolicyV2 } from "@modules/user/usecase/relationship-privacy-policy-v2";
import { UserUseCase } from "@modules/user/usecase";
import { jwtProvider } from "@share/component/jwt";
import { responseFormatMiddleware } from "@share/middleware";

import {
  ChatE2EStore,
  InMemoryBlockRepository,
  InMemoryConversationMemberRepository,
  InMemoryConversationRepository,
  InMemoryMessageRepository,
  buildUseCase,
} from "./helpers/chat-e2e-harness";
import { bearer, socketToken, waitForSocketEvent } from "./helpers/chat-e2e-socket";

class RecordingMessagingSocketService extends MessagingSocketService {
  readonly emitted: Array<{ userId: string; event: string; data: any }> = [];

  public emitToUser(userId: string, event: string, data: any) {
    this.emitted.push({ userId, event, data });
    super.emitToUser(userId, event, data);
  }
}

class InMemoryFriendRequestRepository {
  readonly requests = new Map<string, any>();

  async get(id: string) {
    return this.requests.get(id) || null;
  }

  async findByCond(cond: Record<string, any>) {
    return Array.from(this.requests.values()).find((request) =>
      Object.entries(cond).every(([key, value]) => value === undefined || request[key] === value),
    ) || null;
  }

  async insert(request: any) {
    this.requests.set(request.id, { ...request });
    return true;
  }

  async update(id: string, data: Record<string, any>) {
    const request = this.requests.get(id);
    if (!request) return false;
    Object.assign(request, data);
    return true;
  }

  async delete(id: string) {
    return this.requests.delete(id);
  }

  async list(cond: Record<string, any>) {
    return Array.from(this.requests.values()).filter((request) =>
      Object.entries(cond).every(([key, value]) => value === undefined || request[key] === value),
    );
  }

  async listBySenderId(fromUserId: string) {
    return this.list({ fromUserId });
  }

  async listByReceiverId(toUserId: string) {
    return this.list({ toUserId });
  }
}

class InMemoryAvatarHistoryRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async insert(item: any) {
    this.store.avatarHistory.push(item);
    return true;
  }

  async listByUserId(userId: string, limit: number) {
    return this.store.avatarHistory
      .filter((item) => item.userId === userId)
      .slice(0, limit);
  }
}

class TestPresenceUseCase {
  readonly states = new Map<string, { isOnline: boolean; lastSeen: number | null }>();

  async registerSocket() {
    return { becameOnline: false, connectionCount: 1 };
  }

  async unregisterSocket() {
    return { becameOffline: false, connectionCount: 0 };
  }

  async touchSocket() {
    return { isOnline: true, connectionCount: 1 };
  }

  async getUserPresence(userId: string) {
    return this.states.get(userId) || { isOnline: false, lastSeen: null };
  }
}

type Harness = {
  api: AxiosInstance;
  store: ChatE2EStore;
  friendRequests: InMemoryFriendRequestRepository;
  messagingSocket: RecordingMessagingSocketService;
  connectFriendsSocket: (userId: string) => Promise<ClientSocket>;
  connectMessagesSocket: (userId: string) => Promise<ClientSocket>;
  close: () => Promise<void>;
};

function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token?.startsWith("user:")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.requester = { sub: token.slice("user:".length) };
  next();
}

function authHeader(userId: string) {
  return { Authorization: bearer(userId) };
}

async function createHarness(): Promise<Harness> {
  const store = new ChatE2EStore();
  const { repos, useCase } = buildUseCase(store);
  const friendRequestRepo = new InMemoryFriendRequestRepository();
  const app = express();
  const httpServer: HttpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: "*" } });
  const presenceUseCase = new TestPresenceUseCase();
  const messagingSocket = new RecordingMessagingSocketService(io, useCase as any, presenceUseCase as any);

  const userAdapter = new UserRepositoryAdapter(useCase as any);
  const groupInviteController = new GroupInviteController(
    new GetGroupInviteLinkHandler(
      repos.conversationRepo as any,
      repos.groupInviteLinkRepo as any,
      repos.groupInviteLinkRepo as any,
      repos.memberRepo as any,
    ),
    new RegenerateGroupInviteLinkHandler(
      repos.conversationRepo as any,
      repos.groupInviteLinkRepo as any,
      repos.groupInviteLinkRepo as any,
      repos.memberRepo as any,
    ),
    new RevokeGroupInviteLinkHandler(
      repos.conversationRepo as any,
      repos.groupInviteLinkRepo as any,
      repos.groupInviteLinkRepo as any,
      repos.memberRepo as any,
    ),
    new PreviewInviteHandler(
      repos.groupInviteLinkRepo as any,
      repos.conversationRepo as any,
      userAdapter,
    ),
    new JoinGroupByInviteHandler(
      repos.conversationRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.memberRepo as any,
      repos.groupInviteLinkRepo as any,
      repos.groupInviteLinkRepo as any,
      repos.groupBlockRepo as any,
      repos.messageRepo as any,
      userAdapter,
    ),
  );
  const groupBlockController = new GroupBlockController(
    new GetGroupBlocksHandler(
      repos.conversationRepo as any,
      repos.groupBlockRepo as any,
      repos.memberRepo as any,
      userAdapter,
    ),
    new BlockGroupMemberHandler(
      repos.conversationRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.memberRepo as any,
      repos.groupBlockRepo as any,
      repos.groupBlockRepo as any,
      repos.messageRepo as any,
      userAdapter,
    ),
    new UnblockGroupMemberHandler(
      repos.conversationRepo as any,
      repos.groupBlockRepo as any,
      repos.groupBlockRepo as any,
      repos.memberRepo as any,
      userAdapter,
    ),
  );
  const messagingHttp = new MessagingHttpService(useCase as any, {
    groupInviteController,
    groupBlockController,
  });
  messagingHttp.setSocketService(messagingSocket);

  const friendSocket = new FriendNotificationSocketService(io);
  const friendRequestUseCase = new FriendRequestUseCase(
    friendRequestRepo as any,
    repos.blockRepo as any,
    repos.friendshipRepo as any,
    repos.userRepo as any,
    repos.conversationRepo as any,
    repos.memberRepo as any,
    repos.messageRepo as any,
  );
  const friendRequestHttp = new FriendRequestHTTPService(friendRequestUseCase as any);
  friendRequestHttp.setSocketService(friendSocket);
  const friendshipHttp = new FriendshipHTTPService(
    new FriendshipUseCase(repos.friendshipRepo as any, repos.userRepo as any, friendRequestRepo as any) as any,
  );
  friendshipHttp.setSocketService(friendSocket);

  const blockSocket = new BlockNotificationSocketService(io);
  const blockHttp = new BlockHTTPService(
    new BlockUseCase(repos.blockRepo as any, repos.userRepo as any, repos.friendshipRepo as any, friendRequestRepo as any) as any,
  );
  blockHttp.setSocketService(blockSocket);

  const privacyPolicy = new RelationshipPrivacyPolicyV2(
    repos.userRepo as any,
    repos.friendshipRepo as any,
    repos.blockRepo as any,
  );
  const userV2 = new UserV2HTTPService(
    new UserUseCase(repos.userRepo as any),
    presenceUseCase as any,
    repos.userRepo as any,
    new InMemoryAvatarHistoryRepository(store) as any,
    privacyPolicy,
    repos.friendshipRepo as any,
    friendRequestRepo as any,
    repos.blockRepo as any,
    repos.conversationRepo as any,
    repos.memberRepo as any,
  );
  const chatV2 = new ChatV2Controller(
    useCase as any,
    repos.conversationRepo as any,
    repos.memberRepo as any,
    repos.messageRepo as any,
    repos.friendshipRepo as any,
    repos.blockRepo as any,
    repos.userRepo as any,
    messagingSocket,
    presenceUseCase as any,
  );

  const mdlFactory = { auth };
  app.use(express.json());
  app.use("/v1", responseFormatMiddleware);

  const canonical = express.Router();
  canonical.get("/users/me/profile", auth, userV2.getMyProfileAPI);
  canonical.patch("/users/me/profile", auth, userV2.updateMyProfileAPI);
  canonical.patch("/users/me/privacy", auth, userV2.updateMyPrivacyAPI);
  canonical.get("/users/me/avatar-history", auth, userV2.getAvatarHistoryAPI);
  canonical.get("/users/search-by-phone", auth, userV2.searchByPhoneAPI);
  canonical.get("/users/:id/public", auth, userV2.getPublicProfileAPI);
  canonical.get("/users/:id/presence", auth, userV2.getPresenceAPI);
  canonical.get("/friends/suggestions", auth, userV2.getFriendSuggestionsAPI);
  app.use("/v1", canonical);
  app.use("/v1", setupChatV2Routes(chatV2, mdlFactory as any, messagingHttp));

  const v1 = express.Router();
  v1.post("/friend-requests/:receiverId", auth, friendRequestHttp.sendFriendRequestAPI.bind(friendRequestHttp));
  v1.patch("/friend-requests/:requestId", auth, friendRequestHttp.updateFriendRequestStatusAPI.bind(friendRequestHttp));
  v1.delete("/friend-requests/:requestId", auth, friendRequestHttp.cancelFriendRequestAPI.bind(friendRequestHttp));
  v1.get("/friendships", auth, friendshipHttp.getFriendsListAPI.bind(friendshipHttp));
  v1.get("/blocks/cursor", auth, blockHttp.getBlockedUsersCursorAPI.bind(blockHttp));
  v1.get("/blocks", auth, blockHttp.getBlockedUsersAPI.bind(blockHttp));
  v1.post("/blocks/:blockedUserId", auth, blockHttp.blockUserAPI.bind(blockHttp));
  v1.get("/blocks/:blockedUserId/check", auth, blockHttp.checkBlockStatusAPI.bind(blockHttp));
  v1.get("/conversations/:conversationId/messages", auth, messagingHttp.loadMessagesAPI.bind(messagingHttp));
  app.use("/v1", v1);

  const jwtSpy = jest.spyOn(jwtProvider, "verifyToken").mockImplementation(async (token: string) => {
    const normalized = token.replace(/^Bearer\s+/i, "");
    if (!normalized.startsWith("user:")) return null;
    return { sub: normalized.slice("user:".length) } as any;
  });

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const port = (httpServer.address() as AddressInfo).port;
  const baseURL = `http://127.0.0.1:${port}`;
  const clients: ClientSocket[] = [];

  const connectNamespace = async (namespace: string, userId: string) => {
    const socket = createSocketClient(`${baseURL}${namespace}`, {
      auth: { token: socketToken(userId), deviceId: `social-${userId}` },
      transports: ["websocket"],
      forceNew: true,
    });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out connecting ${namespace}`)), 1000);
      socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("connect_error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    return socket;
  };

  return {
    api: axios.create({ baseURL, validateStatus: () => true, proxy: false }),
    store,
    friendRequests: friendRequestRepo,
    messagingSocket,
    connectFriendsSocket: (userId: string) => connectNamespace("/friends", userId),
    connectMessagesSocket: (userId: string) => connectNamespace("/messages", userId),
    close: async () => {
      for (const client of clients) client.disconnect();
      jwtSpy.mockRestore();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

function seedUser(store: ChatE2EStore, data: Record<string, any> = {}) {
  return store.addUser({
    phone: `+849${String(store.users.size + 1).padStart(8, "0")}`,
    username: `user${store.users.size + 1}`,
    status: UserStatus.ACTIVE,
    verified: { email: true, phone: true },
    privacy: {
      searchableByEmail: true,
      searchableByPhone: true,
      searchableByUsername: true,
      birthdayVisibility: UserInfoVisibility.FRIENDS,
      phoneVisibility: UserInfoVisibility.FRIENDS,
      avatarVisibility: UserInfoVisibility.EVERYONE,
      showOnline: true,
      showLastSeen: true,
      blockMessagesFromStrangers: false,
    },
    settings: { notifications: { push: true, inApp: true } },
    password: "x",
    salt: "x",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
  }) as any;
}

describe("social, privacy, profile E2E", () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("covers friend request lifecycle and friend suggestions from mutual friends and shared groups", async () => {
    const alice = seedUser(harness.store, { displayName: "Alice" });
    const bob = seedUser(harness.store, { displayName: "Bob" });
    const mutual = seedUser(harness.store, { displayName: "Mutual" });
    const sharedOnly = seedUser(harness.store, { displayName: "Shared Group" });

    const bobFriendsSocket = await harness.connectFriendsSocket(bob.id);
    const received = waitForSocketEvent<any>(bobFriendsSocket, "friend_request:received");
    const send = await harness.api.post(`/v1/friend-requests/${bob.id}`, {}, { headers: authHeader(alice.id) });
    expect(send.status).toBe(201);
    expect(send.data.data.status).toBe(FriendRequestStatus.PENDING);
    await expect(received).resolves.toEqual(expect.objectContaining({ type: "FRIEND_REQUEST_RECEIVED" }));

    const accepted = waitForSocketEvent<any>(await harness.connectFriendsSocket(alice.id), "friend_request:accepted");
    const accept = await harness.api.patch(
      `/v1/friend-requests/${send.data.data.id}`,
      { status: FriendRequestStatus.ACCEPTED },
      { headers: authHeader(bob.id) },
    );
    expect(accept.status).toBe(200);
    await expect(accepted).resolves.toEqual(expect.objectContaining({ type: "FRIEND_REQUEST_ACCEPTED" }));

    const rejectedReq = await harness.api.post(`/v1/friend-requests/${mutual.id}`, {}, { headers: authHeader(alice.id) });
    const reject = await harness.api.patch(
      `/v1/friend-requests/${rejectedReq.data.data.id}`,
      { status: FriendRequestStatus.REJECTED },
      { headers: authHeader(mutual.id) },
    );
    expect(reject.status).toBe(200);

    const canceledReq = await harness.api.post(`/v1/friend-requests/${sharedOnly.id}`, {}, { headers: authHeader(alice.id) });
    const cancel = await harness.api.delete(`/v1/friend-requests/${canceledReq.data.data.id}`, {
      headers: authHeader(alice.id),
    });
    expect(cancel.status).toBe(204);
    expect((await harness.friendRequests.get(rejectedReq.data.data.id)).status).toBe(FriendRequestStatus.REJECTED);
    expect((await harness.friendRequests.get(canceledReq.data.data.id)).status).toBe(FriendRequestStatus.CANCELED);

    harness.store.addFriendship(alice.id, bob.id);
    harness.store.addFriendship(bob.id, mutual.id);
    const group = harness.store.addConversation({
      type: ConversationType.GROUP,
      name: "Shared Team",
      createdBy: alice.id,
      ownerId: alice.id,
      membersCount: 3,
    });
    harness.store.addMember({ conversationId: group.id, userId: alice.id, role: ConversationMemberRole.OWNER });
    harness.store.addMember({ conversationId: group.id, userId: sharedOnly.id });

    const suggestions = await harness.api.get("/v1/friends/suggestions", { headers: authHeader(alice.id) });
    expect(suggestions.status).toBe(200);
    expect(suggestions.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: mutual.id, reasons: expect.arrayContaining(["mutual_friends"]) }),
        expect.objectContaining({ id: sharedOnly.id, reasons: expect.arrayContaining(["shared_groups"]) }),
      ]),
    );
  });

  it("enforces block, stranger-message policy, profile privacy, avatar history, and profile-card realtime", async () => {
    const blocker = seedUser(harness.store, { displayName: "Blocker", phone: "+84911111111" });
    const blocked = seedUser(harness.store, { displayName: "Blocked", phone: "+84922222222" });
    const stranger = seedUser(harness.store, { displayName: "Stranger", phone: "+84933333333" });
    const contact = seedUser(harness.store, {
      displayName: "Contact",
      email: "contact@example.test",
      phone: "+84944444444",
      avatarUrl: "https://cdn.test/contact-old.png",
      birthday: new Date("2000-01-01T00:00:00.000Z"),
      gender: UserGender.OTHER,
      bio: "hello",
    });
    const profileViewer = seedUser(harness.store, { displayName: "Profile Viewer" });
    const profileFriend = seedUser(harness.store, {
      displayName: "Profile Friend",
      email: "profile.friend@example.test",
      coverUrl: "https://cdn.test/profile-cover.png",
      gender: UserGender.FEMALE,
    });
    harness.store.addFriendship(profileViewer.id, profileFriend.id);

    const selfProfile = await harness.api.get(`/v1/users/${profileFriend.id}/public`, {
      headers: authHeader(profileFriend.id),
    });
    expect(selfProfile.status).toBe(200);
    expect(selfProfile.data.data).toEqual(
      expect.objectContaining({
        id: profileFriend.id,
        username: profileFriend.username,
        coverUrl: "https://cdn.test/profile-cover.png",
        gender: UserGender.FEMALE,
        email: "profile.friend@example.test",
        relationship: expect.objectContaining({
          status: "self",
          isSelf: true,
          isFriend: true,
          isBlockedByMe: false,
          isBlockingMe: false,
        }),
        fieldVisibility: expect.objectContaining({
          avatarUrl: "visible",
          coverUrl: "visible",
          birthday: "visible",
          phone: "visible",
          email: "visible",
        }),
        canSendMessage: false,
      }),
    );

    const friendVisibleProfile = await harness.api.get(`/v1/users/${profileFriend.id}/public`, {
      headers: authHeader(profileViewer.id),
    });
    expect(friendVisibleProfile.status).toBe(200);
    expect(friendVisibleProfile.data.data).toEqual(
      expect.objectContaining({
        email: "profile.friend@example.test",
        relationship: expect.objectContaining({
          status: "friend",
          isSelf: false,
          isFriend: true,
        }),
        fieldVisibility: expect.objectContaining({
          email: "visible",
        }),
        canSendMessage: true,
      }),
    );

    const friendPhoneSearch = await harness.api.get(
      `/v1/users/search-by-phone?phone=${encodeURIComponent(profileFriend.phone)}`,
      { headers: authHeader(profileViewer.id) },
    );
    expect(friendPhoneSearch.status).toBe(200);
    expect(friendPhoneSearch.data.data).toEqual(
      expect.objectContaining({
        id: profileFriend.id,
        phone: profileFriend.phone,
      }),
    );

    const strangerPhoneSearch = await harness.api.get(
      `/v1/users/search-by-phone?phone=${encodeURIComponent(profileFriend.phone)}`,
      { headers: authHeader(stranger.id) },
    );
    expect(strangerPhoneSearch.status).toBe(200);
    expect(strangerPhoneSearch.data.data).toEqual(expect.objectContaining({ id: profileFriend.id }));
    expect(strangerPhoneSearch.data.data.phone).toBeUndefined();

    const strangerEmailHiddenProfile = await harness.api.get(`/v1/users/${profileFriend.id}/public`, {
      headers: authHeader(stranger.id),
    });
    expect(strangerEmailHiddenProfile.status).toBe(200);
    expect(strangerEmailHiddenProfile.data.data.email).toBeUndefined();
    expect(strangerEmailHiddenProfile.data.data).toEqual(
      expect.objectContaining({
        relationship: expect.objectContaining({
          status: "none",
          isSelf: false,
          isFriend: false,
        }),
        fieldVisibility: expect.objectContaining({
          email: "hidden",
        }),
      }),
    );

    harness.store.addFriendship(blocker.id, blocked.id);
    const existing = harness.store.addConversation({
      type: ConversationType.PRIVATE,
      pairKey: [blocker.id, blocked.id].sort().join("_"),
      membersCount: 2,
    });
    harness.store.addMember({ conversationId: existing.id, userId: blocker.id });
    harness.store.addMember({ conversationId: existing.id, userId: blocked.id });
    const oldMessage = harness.store.addMessage({
      conversationId: existing.id,
      senderId: blocked.id,
      text: "old history remains",
      type: MessageType.TEXT,
    });

    const block = await harness.api.post(`/v1/blocks/${blocked.id}`, {}, { headers: authHeader(blocker.id) });
    expect(block.status).toBe(200);

    const blockedMessage = await harness.api.post(
      "/v1/messages/private",
      { targetUserId: blocker.id, text: "can I send?" },
      { headers: authHeader(blocked.id) },
    );
    expect(blockedMessage.status).toBe(403);

    const hiddenProfile = await harness.api.get(`/v1/users/${blocker.id}/public`, { headers: authHeader(blocked.id) });
    expect(hiddenProfile.status).toBe(403);
    const hiddenPresence = await harness.api.get(`/v1/users/${blocker.id}/presence`, { headers: authHeader(blocked.id) });
    expect(hiddenPresence.status).toBe(200);
    expect(hiddenPresence.data.data).toEqual(expect.objectContaining({ visibility: "hidden", isOnline: false }));

    const history = await harness.api.get(`/v1/conversations/${existing.id}/messages`, {
      headers: authHeader(blocker.id),
    });
    expect(history.status).toBe(200);
    expect(history.data.data.messages).toEqual(expect.arrayContaining([expect.objectContaining({ id: oldMessage.id })]));

    const privacy = await harness.api.patch(
      "/v1/users/me/privacy",
      {
        blockMessagesFromStrangers: true,
        phoneVisibility: UserInfoVisibility.ONLY_ME,
        birthdayVisibility: UserInfoVisibility.ONLY_ME,
        avatarVisibility: UserInfoVisibility.ONLY_ME,
        searchableByPhone: false,
        showOnline: false,
        showLastSeen: false,
      },
      { headers: authHeader(contact.id) },
    );
    expect(privacy.status).toBe(200);

    const strangerBlocked = await harness.api.post(
      "/v1/messages/private",
      { targetUserId: contact.id, text: "hello from stranger" },
      { headers: authHeader(stranger.id) },
    );
    expect(strangerBlocked.status).toBe(403);

    const searchHidden = await harness.api.get(`/v1/users/search-by-phone?phone=${encodeURIComponent(contact.phone)}`, {
      headers: authHeader(stranger.id),
    });
    expect(searchHidden.status).toBe(404);

    const publicProfile = await harness.api.get(`/v1/users/${contact.id}/public`, { headers: authHeader(stranger.id) });
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.data.data.phone).toBeUndefined();
    expect(publicProfile.data.data.email).toBeUndefined();
    expect(publicProfile.data.data.birthday).toBeUndefined();
    expect(publicProfile.data.data.avatarUrl).toBeUndefined();
    expect(publicProfile.data.data).toEqual(
      expect.objectContaining({
        username: contact.username,
        gender: UserGender.OTHER,
        relationship: expect.objectContaining({
          status: "none",
          isSelf: false,
          isFriend: false,
          isBlockedByMe: false,
          isBlockingMe: false,
        }),
        fieldVisibility: expect.objectContaining({
          avatarUrl: "hidden",
          coverUrl: "hidden",
          birthday: "hidden",
          phone: "hidden",
          email: "hidden",
        }),
        canSendMessage: false,
      }),
    );

    const updateProfile = await harness.api.patch(
      "/v1/users/me/profile",
      { avatarUrl: "https://cdn.test/contact-new.png", coverUrl: "https://cdn.test/cover.png", bio: "updated" },
      { headers: authHeader(contact.id) },
    );
    expect(updateProfile.status).toBe(200);
    const avatarHistory = await harness.api.get("/v1/users/me/avatar-history", { headers: authHeader(contact.id) });
    expect(avatarHistory.data.data).toEqual([
      expect.objectContaining({ userId: contact.id, avatarUrl: "https://cdn.test/contact-old.png" }),
    ]);

    const sender = seedUser(harness.store, { displayName: "Sender" });
    const receiver = seedUser(harness.store, { displayName: "Receiver" });
    const messageRequestEvent = waitForSocketEvent<any>(await harness.connectMessagesSocket(receiver.id), "message-request:incoming");
    const requestMessage = await harness.api.post(
      "/v1/messages/private",
      { targetUserId: receiver.id, text: "message request" },
      { headers: authHeader(sender.id) },
    );
    expect(requestMessage.status).toBe(201);
    expect(requestMessage.data.data.messageRequestStatus).toBe("pending");
    await expect(messageRequestEvent).resolves.toEqual(expect.objectContaining({ fromUserId: sender.id }));

    const strangers = await harness.api.get("/v1/conversations/strangers", { headers: authHeader(receiver.id) });
    expect(strangers.status).toBe(200);
    expect(strangers.data.data).toEqual([
      expect.objectContaining({ messageRequestStatus: "pending" }),
    ]);

    const conversationId = requestMessage.data.data.conversation.id;
    const profileCardEvent = waitForSocketEvent<any>(await harness.connectMessagesSocket(sender.id), "receiveMessage");
    const profileCard = await harness.api.post(
      `/v1/conversations/${conversationId}/profile-cards`,
      { userId: contact.id },
      { headers: authHeader(receiver.id) },
    );
    expect(profileCard.status).toBe(201);
    expect(profileCard.data.data).toEqual(
      expect.objectContaining({ type: MessageType.PROFILE_CARD, profileCardUserId: contact.id }),
    );
    await expect(profileCardEvent).resolves.toEqual(
      expect.objectContaining({
        conversationId,
        message: expect.objectContaining({
          type: MessageType.PROFILE_CARD,
          profileCard: expect.objectContaining({ id: contact.id }),
        }),
      }),
    );
  });

  it("lists blocked users with cursor pagination", async () => {
    const blocker = seedUser(harness.store, { displayName: "Cursor Blocker" });
    const blocked1 = seedUser(harness.store, {
      displayName: "Blocked 1",
      email: "blocked1@example.test",
      avatarUrl: "https://cdn.test/blocked-1.png",
      coverUrl: "https://cdn.test/blocked-1-cover.png",
      bio: "blocked one",
      privacy: { phoneVisibility: UserInfoVisibility.EVERYONE },
    });
    const blocked2 = seedUser(harness.store, {
      displayName: "Blocked 2",
      email: "blocked2@example.test",
      privacy: { phoneVisibility: UserInfoVisibility.ONLY_ME },
    });
    const blocked3 = seedUser(harness.store, { displayName: "Blocked 3" });

    for (const blocked of [blocked1, blocked2, blocked3]) {
      const response = await harness.api.post(`/v1/blocks/${blocked.id}`, {}, { headers: authHeader(blocker.id) });
      expect(response.status).toBe(200);
    }

    const list = await harness.api.get("/v1/blocks?page=1&limit=2", {
      headers: authHeader(blocker.id),
    });
    expect(list.status).toBe(200);
    expect(list.data.data.items).toHaveLength(2);
    expect(list.data.data.total).toBe(3);
    expect(list.data.data.page).toBe(1);
    expect(list.data.data.limit).toBe(2);
    expect(list.data.data.hasMore).toBe(true);
    expect(list.data.data.items[0]).toEqual(
      expect.objectContaining({
        blockerId: blocker.id,
        blockedUserId: blocked1.id,
        blockedUserUnavailable: false,
        blockedUser: expect.objectContaining({
          id: blocked1.id,
          displayName: "Blocked 1",
          username: blocked1.username,
          avatarUrl: "https://cdn.test/blocked-1.png",
          coverUrl: "https://cdn.test/blocked-1-cover.png",
          bio: "blocked one",
          verified: blocked1.verified,
          status: blocked1.status,
          phone: blocked1.phone,
        }),
      }),
    );
    expect(list.data.data.items[0].blockedUser.email).toBeUndefined();
    expect(list.data.data.items[0].blockedUser.phone).toBe(blocked1.phone);
    expect(list.data.data.items[1].blockedUser.phone).toBeUndefined();

    const firstPage = await harness.api.get("/v1/blocks/cursor?limit=2", {
      headers: authHeader(blocker.id),
    });
    expect(firstPage.status).toBe(200);
    expect(firstPage.data.data.items).toHaveLength(2);
    expect(firstPage.data.data.hasMore).toBe(true);
    expect(firstPage.data.data.limit).toBe(2);
    expect(firstPage.data.data.nextCursor).toBe("2");
    expect(firstPage.data.data.items[0]).toEqual(
      expect.objectContaining({
        blockerId: blocker.id,
        blockedUserId: blocked1.id,
        blockedUserUnavailable: false,
        blockedUser: expect.objectContaining({
          id: blocked1.id,
          displayName: "Blocked 1",
          username: blocked1.username,
          phone: blocked1.phone,
        }),
      }),
    );
    expect(firstPage.data.data.items[0].blockedUser.email).toBeUndefined();
    expect(firstPage.data.data.items[0].blockedUser.phone).toBe(blocked1.phone);
    expect(firstPage.data.data.items[1].blockedUser.phone).toBeUndefined();

    const secondPage = await harness.api.get(
      `/v1/blocks/cursor?limit=2&cursor=${encodeURIComponent(firstPage.data.data.nextCursor)}`,
      { headers: authHeader(blocker.id) },
    );
    expect(secondPage.status).toBe(200);
    expect(secondPage.data.data.items).toHaveLength(1);
    expect(secondPage.data.data.items[0]).toEqual(
      expect.objectContaining({
        blockerId: blocker.id,
        blockedUserId: blocked3.id,
        blockedUser: expect.objectContaining({
          id: blocked3.id,
          displayName: "Blocked 3",
        }),
      }),
    );
    expect(secondPage.data.data.hasMore).toBe(false);
    expect(secondPage.data.data.nextCursor).toBe("");
    expect(secondPage.data.data.items[0].blockedUser.phone).toBeUndefined();
  });
});
