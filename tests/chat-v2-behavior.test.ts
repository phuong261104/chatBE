import { v7 } from "uuid";
import { EditMessageHandler } from "@modules/chat/usecase/edit-message";
import { AddReactionHandler } from "@modules/chat/usecase/add-reaction";
import { AddMembersToGroupHandler } from "@modules/chat/usecase/add-members-to-group";
import { DeleteConversationForMeHandler } from "@modules/chat/usecase/delete-conversation-for-me";
import { ForwardMessagesHandler } from "@modules/chat/usecase/forward-messages";
import { GetConversationsCursorQueryHandler } from "@modules/chat/usecase/get-conversations-cursor";
import { GetConversationsQueryHandler } from "@modules/chat/usecase/get-conversations";
import { GetConversationMediaQueryHandler } from "@modules/chat/usecase/get-conversation-media";
import { LeaveGroupHandler } from "@modules/chat/usecase/leave-group";
import { LoadMessagesQueryHandler } from "@modules/chat/usecase/load-messages";
import { QuoteMessageHandler } from "@modules/chat/usecase/quote-message";
import { SaveMessagesToMyDocumentHandler } from "@modules/chat/usecase/save-to-my-document";
import { SearchMessagesHandler } from "@modules/chat/usecase/search-messages";
import {
  ClassificationType,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  MediaType,
  MessageStatus,
  MessageType,
} from "@modules/chat/model";
import { ChatE2EStore } from "./helpers/chat-e2e-store";
import {
  InMemoryClassificationRepository,
  InMemoryConversationMemberRepository,
  InMemoryConversationRepository,
  InMemoryMessageRepository,
  InMemoryUserRepository,
} from "./helpers/chat-e2e-repositories";

describe("canonical chat business behavior", () => {
  function createConversationListRepos(store: ChatE2EStore) {
    return {
      conversationRepo: new InMemoryConversationRepository(store),
      memberRepo: new InMemoryConversationMemberRepository(store),
      messageRepo: new InMemoryMessageRepository(store),
      userRepo: new InMemoryUserRepository(store),
      classificationRepo: new InMemoryClassificationRepository(store),
    };
  }

  function seedListConversation(
    store: ChatE2EStore,
    userId: string,
    data: {
      name: string;
      activityAt: Date;
      pinned?: boolean;
      pinnedAt?: Date;
    },
  ) {
    const conversation = store.addConversation({
      type: ConversationType.GROUP,
      name: data.name,
      updatedAt: data.activityAt,
      createdAt: data.activityAt,
    });
    store.addMember({
      conversationId: conversation.id,
      userId,
      pinned: data.pinned,
      pinnedAt: data.pinnedAt,
      lastActivityAt: data.activityAt,
      updatedAt: data.activityAt,
    });
    return conversation;
  }

  it("orders pinned conversations first and sorts unpinned Saved Messages by activity", async () => {
    const store = new ChatE2EStore();
    const user = store.addUser({ displayName: "Owner" });
    const repos = createConversationListRepos(store);

    const normalNew = seedListConversation(store, user.id, {
      name: "Normal new",
      activityAt: new Date("2026-01-04T00:00:00Z"),
    });
    const pinnedOld = seedListConversation(store, user.id, {
      name: "Pinned old",
      activityAt: new Date("2026-01-05T00:00:00Z"),
      pinned: true,
      pinnedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const normalOld = seedListConversation(store, user.id, {
      name: "Normal old",
      activityAt: new Date("2026-01-03T00:00:00Z"),
    });
    const selfConversation = store.addConversation({
      type: ConversationType.PRIVATE,
      pairKey: `self_${user.id}`,
      name: "Old self name",
      membersCount: 2,
      updatedAt: new Date("2026-01-03T12:00:00Z"),
      createdAt: new Date("2026-01-03T12:00:00Z"),
    });
    store.addMember({
      conversationId: selfConversation.id,
      userId: user.id,
      lastActivityAt: new Date("2026-01-03T12:00:00Z"),
      updatedAt: new Date("2026-01-03T12:00:00Z"),
    });
    const pinnedNew = seedListConversation(store, user.id, {
      name: "Pinned new",
      activityAt: new Date("2026-01-02T00:00:00Z"),
      pinned: true,
      pinnedAt: new Date("2026-01-06T00:00:00Z"),
    });

    const handler = new GetConversationsQueryHandler(
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.userRepo as any,
      repos.messageRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
    );

    const result = await handler.query({ userId: user.id, page: 1, limit: 10 });
    const savedMessages = result.find((conversation: any) => conversation.isSelfChat);

    expect(result.map((conversation) => conversation.id)).toEqual([
      pinnedNew.id,
      pinnedOld.id,
      normalNew.id,
      selfConversation.id,
      normalOld.id,
    ]);
    expect(savedMessages).toEqual(
      expect.objectContaining({
        name: "Saved Messages",
        type: "saved_messages",
        pairKey: `self_${user.id}`,
        membersCount: 1,
        isSelfChat: true,
        isSavedMessages: true,
      }),
    );
  });

  it("sorts pinned Saved Messages by pinnedAt with other pinned conversations", async () => {
    const store = new ChatE2EStore();
    const user = store.addUser({ displayName: "Owner" });
    const repos = createConversationListRepos(store);

    const pinnedNewest = seedListConversation(store, user.id, {
      name: "Pinned newest",
      activityAt: new Date("2026-01-02T00:00:00Z"),
      pinned: true,
      pinnedAt: new Date("2026-01-06T00:00:00Z"),
    });
    const selfConversation = store.addConversation({
      type: ConversationType.PRIVATE,
      pairKey: `self_${user.id}`,
      name: "Old self name",
      membersCount: 2,
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    store.addMember({
      conversationId: selfConversation.id,
      userId: user.id,
      pinned: true,
      pinnedAt: new Date("2026-01-04T00:00:00Z"),
      lastActivityAt: new Date("2026-01-01T00:00:00Z"),
    });
    const pinnedOldest = seedListConversation(store, user.id, {
      name: "Pinned oldest",
      activityAt: new Date("2026-01-05T00:00:00Z"),
      pinned: true,
      pinnedAt: new Date("2026-01-02T00:00:00Z"),
    });
    const normal = seedListConversation(store, user.id, {
      name: "Normal",
      activityAt: new Date("2026-01-07T00:00:00Z"),
    });

    const handler = new GetConversationsQueryHandler(
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.userRepo as any,
      repos.messageRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
    );

    const result = await handler.query({ userId: user.id, page: 1, limit: 10 });

    expect(result.map((conversation) => conversation.id)).toEqual([
      pinnedNewest.id,
      selfConversation.id,
      pinnedOldest.id,
      normal.id,
    ]);
    expect(result.find((conversation) => conversation.id === selfConversation.id)).toEqual(
      expect.objectContaining({
        name: "Saved Messages",
        type: "saved_messages",
        membersCount: 1,
        isSelfChat: true,
        isSavedMessages: true,
        pinned: true,
      }),
    );
  });

  it("paginates cursor conversations after sorting pinned and Saved Messages by activity", async () => {
    const store = new ChatE2EStore();
    const user = store.addUser({ displayName: "Owner" });
    const repos = createConversationListRepos(store);

    const normalNew = seedListConversation(store, user.id, {
      name: "Normal new",
      activityAt: new Date("2026-01-04T00:00:00Z"),
    });
    const normalOld = seedListConversation(store, user.id, {
      name: "Normal old",
      activityAt: new Date("2026-01-03T00:00:00Z"),
    });
    const selfConversation = store.addConversation({
      type: ConversationType.PRIVATE,
      pairKey: `self_${user.id}`,
      name: "Old self name",
      membersCount: 2,
      updatedAt: new Date("2026-01-03T12:00:00Z"),
      createdAt: new Date("2026-01-03T12:00:00Z"),
    });
    store.addMember({
      conversationId: selfConversation.id,
      userId: user.id,
      lastActivityAt: new Date("2026-01-03T12:00:00Z"),
      updatedAt: new Date("2026-01-03T12:00:00Z"),
    });
    const pinnedOld = seedListConversation(store, user.id, {
      name: "Pinned old",
      activityAt: new Date("2026-01-05T00:00:00Z"),
      pinned: true,
      pinnedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const pinnedNew = seedListConversation(store, user.id, {
      name: "Pinned new",
      activityAt: new Date("2026-01-02T00:00:00Z"),
      pinned: true,
      pinnedAt: new Date("2026-01-06T00:00:00Z"),
    });

    const handler = new GetConversationsCursorQueryHandler(
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.userRepo as any,
      repos.messageRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
    );

    const first = await handler.query({ userId: user.id, limit: 2 });
    const savedMessages = first.data.find((conversation: any) => conversation.isSelfChat);

    expect(first.pinned?.map((conversation) => conversation.id)).toEqual([pinnedNew.id, pinnedOld.id]);
    expect(first.data.map((conversation) => conversation.id)).toEqual([normalNew.id, selfConversation.id]);
    expect(savedMessages).toEqual(expect.objectContaining({ type: "saved_messages", isSavedMessages: true }));
    expect(first.nextCursor).toBe(selfConversation.id);
    expect(first.hasMore).toBe(true);

    const second = await handler.query({ userId: user.id, cursor: first.nextCursor, limit: 2 });
    expect(second.pinned).toBeNull();
    expect(second.data.map((conversation) => conversation.id)).toEqual([normalOld.id]);
    expect(second.hasMore).toBe(false);
  });

  it("saves selected messages to Saved Messages with searchable text and media classification", async () => {
    const store = new ChatE2EStore();
    const user = store.addUser({ displayName: "Owner" });
    const repos = createConversationListRepos(store);
    const sourceConversation = store.addConversation({
      type: ConversationType.GROUP,
      name: "Source",
    });
    store.addMember({ conversationId: sourceConversation.id, userId: user.id });
    const sourceMessage = store.addMessage({
      conversationId: sourceConversation.id,
      senderId: user.id,
      type: MessageType.FILE,
      text: "annual document needle",
      media: [{
        url: "https://example.com/annual.pdf",
        mediaType: MediaType.FILE,
        name: "annual.pdf",
        size: 123,
      }],
    });

    const forwardHandler = new ForwardMessagesHandler(
      repos.conversationRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.memberRepo as any,
      repos.messageRepo as any,
      repos.messageRepo as any,
      repos.classificationRepo as any,
    );
    const saveHandler = new SaveMessagesToMyDocumentHandler(
      repos.conversationRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.memberRepo as any,
      forwardHandler,
    );

    const result = await saveHandler.execute({
      userId: user.id,
      messageIds: [sourceMessage.id],
    });

    expect(result.conversation).toEqual(
      expect.objectContaining({
        pairKey: `self_${user.id}`,
        name: "Saved Messages",
        type: "saved_messages",
        isSelfChat: true,
        isSavedMessages: true,
      }),
    );
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual(
      expect.objectContaining({
        conversationId: result.conversation.id,
        text: "annual document needle",
        forwardedFrom: sourceConversation.id,
        forwardedFromMessageId: sourceMessage.id,
      }),
    );
    expect(store.classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversationId: result.conversation.id,
          type: ClassificationType.FILE,
          messageId: result.messages[0].id,
        }),
      ]),
    );

    const searchHandler = new SearchMessagesHandler(repos.memberRepo as any, repos.messageRepo as any);
    const searchResult = await searchHandler.query({
      conversationId: result.conversation.id,
      userId: user.id,
      query: "needle",
      limit: 20,
    });
    expect(searchResult.messages.map((message) => message.id)).toContain(result.messages[0].id);

    const mediaHandler = new GetConversationMediaQueryHandler(
      repos.memberRepo as any,
      repos.classificationRepo as any,
      repos.messageRepo as any,
    );
    const mediaResult = await mediaHandler.query({
      conversationId: result.conversation.id,
      userId: user.id,
      limit: 20,
      type: "file",
    });
    expect(mediaResult.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageId: result.messages[0].id,
          url: "https://example.com/annual.pdf",
        }),
      ]),
    );
  });

  it("enforces a v2 30 second edit window when provided", async () => {
    const conversationId = v7();
    const userId = v7();
    const messageId = v7();
    const message = {
      id: messageId,
      conversationId,
      senderId: userId,
      type: MessageType.TEXT,
      text: "old",
      createdAt: new Date(Date.now() - 31_000),
      pinned: false,
    };
    const messageRepo = {
      get: jest.fn().mockResolvedValue(message),
      update: jest.fn(),
    };
    const memberRepo = {
      findByCond: jest.fn().mockResolvedValue({
        id: v7(),
        conversationId,
        userId,
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: new Date(),
        updatedAt: new Date(),
      }),
    };
    const handler = new EditMessageHandler(messageRepo as any, messageRepo as any, memberRepo as any);

    await expect(
      handler.execute({
        messageId,
        userId,
        text: "new",
        timeLimitMs: 30_000,
      }),
    ).rejects.toThrow();
    expect(messageRepo.update).not.toHaveBeenCalled();
  });

  it("auto-transfers ownership to the oldest active admin when a v2 owner leaves", async () => {
    const conversationId = v7();
    const ownerId = "owner";
    const adminId = "admin";
    const memberId = "member";
    const conversationRepo = {
      get: jest.fn().mockResolvedValue({
        id: conversationId,
        type: ConversationType.GROUP,
        createdBy: ownerId,
        ownerId,
        admins: [ownerId, adminId],
        membersCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: jest.fn(),
    };
    const ownerMember = {
      id: "m-owner",
      conversationId,
      userId: ownerId,
      role: ConversationMemberRole.ADMIN,
      status: ConversationMemberStatus.ACTIVE,
      joinedAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date(),
    };
    const adminMember = {
      id: "m-admin",
      conversationId,
      userId: adminId,
      role: ConversationMemberRole.ADMIN,
      status: ConversationMemberStatus.ACTIVE,
      joinedAt: new Date("2024-01-02T00:00:00Z"),
      updatedAt: new Date(),
    };
    const regularMember = {
      id: "m-member",
      conversationId,
      userId: memberId,
      role: ConversationMemberRole.MEMBER,
      status: ConversationMemberStatus.ACTIVE,
      joinedAt: new Date("2024-01-03T00:00:00Z"),
      updatedAt: new Date(),
    };
    const memberRepo = {
      findByCond: jest.fn().mockImplementation(async (cond: any) => {
        if (cond.userId === ownerId) return ownerMember;
        if (cond.role === ConversationMemberRole.ADMIN && cond.status === ConversationMemberStatus.ACTIVE) return adminMember;
        return null;
      }),
      listByConversationId: jest.fn().mockResolvedValue([ownerMember, adminMember, regularMember]),
      update: jest.fn(),
      touchActivityForConversation: jest.fn(),
    };
    const messageRepo = { insert: jest.fn() };
    const userRepo = { get: jest.fn().mockResolvedValue({ displayName: "Owner" }) };
    const handler = new LeaveGroupHandler(
      conversationRepo as any,
      conversationRepo as any,
      memberRepo as any,
      memberRepo as any,
      messageRepo as any,
      userRepo as any,
    );

    await handler.execute({ conversationId, userId: ownerId, autoTransferOwner: true });

    expect(memberRepo.update).toHaveBeenCalledWith(adminMember.id, {
      role: ConversationMemberRole.OWNER,
    });
    expect(conversationRepo.update).toHaveBeenCalledWith(
      conversationId,
      expect.objectContaining({
        ownerId: adminId,
        admins: [],
        membersCount: 2,
      }),
    );
  });

  it("retains quote metadata on split media quote messages", async () => {
    const conversationId = v7();
    const senderId = v7();
    const quotedMessageId = v7();
    const inserted: any[] = [];
    const messageRepo = {
      get: jest.fn().mockResolvedValue({
        id: quotedMessageId,
        conversationId,
        senderId: v7(),
        type: MessageType.TEXT,
        text: "quoted text",
        createdAt: new Date(),
        pinned: false,
      }),
      insert: jest.fn(async (message) => {
        inserted.push(message);
        return true;
      }),
    };
    const memberRepo = {
      findByCond: jest.fn().mockResolvedValue({
        id: v7(),
        conversationId,
        userId: senderId,
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: new Date(),
        updatedAt: new Date(),
      }),
    };
    const conversationRepo = { update: jest.fn() };
    const classificationRepo = { insertBatch: jest.fn() };
    const handler = new QuoteMessageHandler(
      messageRepo as any,
      messageRepo as any,
      memberRepo as any,
      conversationRepo as any,
      classificationRepo as any,
    );

    const messages = await handler.execute({
      conversationId,
      senderId,
      quotedMessageId,
      media: [
        { url: "https://example.com/a.png", filename: "a.png", mimetype: "image/png", size: 10 },
        { url: "https://example.com/b.pdf", filename: "b.pdf", mimetype: "application/pdf", size: 20 },
      ],
    });

    expect(messages).toHaveLength(2);
    expect(inserted.every((message) => message.quotedMessageId === quotedMessageId)).toBe(true);
    expect(inserted.every((message) => message.quotedMessagePreview === "quoted text")).toBe(true);
    expect(inserted[0].media[0].mediaType).toBe(MediaType.IMAGE);
    expect(inserted[1].media[0].mediaType).toBe(MediaType.FILE);
  });

  it("restores a left group member without stale admin or hidden state", async () => {
    const conversationId = v7();
    const requesterId = v7();
    const memberId = v7();
    const now = new Date("2024-01-01T00:00:00Z");
    const conversationRepo = {
      get: jest.fn().mockResolvedValue({
        id: conversationId,
        type: ConversationType.GROUP,
        membersCount: 1,
        settings: { allowMemberInvite: true, requireApproval: false, allowSendLink: true, whoCanSendMessages: "all" },
        createdAt: now,
        updatedAt: now,
      }),
      update: jest.fn(),
    };
    const requesterMember = {
      id: "requester-member",
      conversationId,
      userId: requesterId,
      role: ConversationMemberRole.ADMIN,
      status: ConversationMemberStatus.ACTIVE,
      joinedAt: now,
      updatedAt: now,
    };
    const leftMember = {
      id: "left-member",
      conversationId,
      userId: memberId,
      role: ConversationMemberRole.ADMIN,
      status: ConversationMemberStatus.ACTIVE,
      joinedAt: now,
      leftAt: new Date("2024-01-02T00:00:00Z"),
      unreadCount: 5,
      archived: true,
      hidden: true,
      hiddenAt: new Date("2024-01-02T00:00:00Z"),
      hiddenPinHash: "hash",
      updatedAt: now,
    };
    const memberRepo = {
      findByCond: jest.fn(async (cond) => {
        if (cond.userId === requesterId) return requesterMember;
        if (cond.userId === memberId) return leftMember;
        return null;
      }),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      touchActivityForConversation: jest.fn(),
    };
    const messageRepo = { insert: jest.fn() };
    const groupBlockRepo = { isUserBlocked: jest.fn().mockResolvedValue(false) };
    const userRepo = {
      findByIds: jest.fn().mockResolvedValue([
        { id: requesterId, displayName: "Admin" },
        { id: memberId, displayName: "Member" },
      ]),
    };
    const accessPolicy = {
      validateAddGroupMembers: jest.fn().mockResolvedValue([memberId]),
    };
    const handler = new AddMembersToGroupHandler(
      conversationRepo as any,
      conversationRepo as any,
      memberRepo as any,
      memberRepo as any,
      groupBlockRepo as any,
      messageRepo as any,
      userRepo as any,
      accessPolicy as any,
    );

    const members = await handler.execute({ conversationId, requesterId, memberIds: [memberId] });

    expect(members).toHaveLength(1);
    expect(memberRepo.update).toHaveBeenCalledWith(
      leftMember.id,
      expect.objectContaining({
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        leftAt: null,
        unreadCount: 0,
        archived: false,
        hidden: false,
        hiddenAt: null,
        hiddenPinHash: null,
      }),
    );
  });

  it("forwards call messages but rejects system messages", async () => {
    const userId = v7();
    const sourceConversationId = v7();
    const targetConversationId = v7();
    const callMessageId = v7();
    const inserted: any[] = [];
    const conversationRepo = {
      get: jest.fn().mockResolvedValue({ id: targetConversationId, type: ConversationType.PRIVATE }),
      update: jest.fn(),
    };
    const memberRepo = {
      findByCond: jest.fn().mockResolvedValue({
        id: v7(),
        conversationId: targetConversationId,
        userId,
        status: ConversationMemberStatus.ACTIVE,
        role: ConversationMemberRole.MEMBER,
        joinedAt: new Date(),
        updatedAt: new Date(),
      }),
      incrementUnreadCountForConversation: jest.fn(),
    };
    const messageRepo = {
      get: jest.fn().mockResolvedValue({
        id: callMessageId,
        conversationId: sourceConversationId,
        senderId: userId,
        type: MessageType.CALL,
        text: "Cuoc goi thoai nho",
        call: {
          callId: "call-1",
          roomName: "room-1",
          callType: "audio",
          status: "missed",
          callerId: userId,
          calleeIds: [],
          endedAt: new Date(),
        },
        messageStatus: MessageStatus.ACTIVE,
        createdAt: new Date(),
        pinned: false,
      }),
      batchInsert: jest.fn(async (messages) => {
        inserted.push(...messages);
        return true;
      }),
    };
    const classificationRepo = { insertBatch: jest.fn() };
    const handler = new ForwardMessagesHandler(
      conversationRepo as any,
      conversationRepo as any,
      memberRepo as any,
      memberRepo as any,
      messageRepo as any,
      messageRepo as any,
      classificationRepo as any,
    );

    await handler.execute({
      userId,
      messageIds: [callMessageId],
      targetConversationIds: [targetConversationId],
    });

    expect(inserted[0]).toEqual(expect.objectContaining({
      type: MessageType.CALL,
      text: "Cuoc goi thoai nho",
      forwardedFrom: sourceConversationId,
      forwardedFromMessageId: callMessageId,
    }));

    messageRepo.get.mockResolvedValueOnce({
      id: v7(),
      conversationId: sourceConversationId,
      senderId: userId,
      type: MessageType.SYSTEM,
      text: "System",
      messageStatus: MessageStatus.ACTIVE,
      createdAt: new Date(),
      pinned: false,
    });

    await expect(
      handler.execute({
        userId,
        messageIds: [v7()],
        targetConversationIds: [targetConversationId],
      }),
    ).rejects.toThrow("System messages cannot be forwarded");
  });

  it("uses type-specific quote preview for call messages", async () => {
    const conversationId = v7();
    const senderId = v7();
    const quotedMessageId = v7();
    const inserted: any[] = [];
    const messageRepo = {
      get: jest.fn().mockResolvedValue({
        id: quotedMessageId,
        conversationId,
        senderId: v7(),
        type: MessageType.CALL,
        text: "Cuoc goi video 00:42",
        messageStatus: MessageStatus.ACTIVE,
        createdAt: new Date(),
        pinned: false,
      }),
      insert: jest.fn(async (message) => {
        inserted.push(message);
        return true;
      }),
    };
    const memberRepo = {
      findByCond: jest.fn().mockResolvedValue({
        id: v7(),
        conversationId,
        userId: senderId,
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: new Date(),
        updatedAt: new Date(),
      }),
    };
    const handler = new QuoteMessageHandler(
      messageRepo as any,
      messageRepo as any,
      memberRepo as any,
      { update: jest.fn() } as any,
      { insertBatch: jest.fn() } as any,
    );

    await handler.execute({
      conversationId,
      senderId,
      quotedMessageId,
      text: "ok",
    });

    expect(inserted[0].quotedMessagePreview).toBe("Cuoc goi video 00:42");
  });

  it("rejects reactions on system messages", async () => {
    const userId = v7();
    const messageId = v7();
    const handler = new AddReactionHandler(
      {
        get: jest.fn().mockResolvedValue({
          id: messageId,
          conversationId: v7(),
          senderId: v7(),
          type: MessageType.SYSTEM,
          text: "System",
          messageStatus: MessageStatus.ACTIVE,
          createdAt: new Date(),
          pinned: false,
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(handler.execute({ messageId, userId, emoji: "like" })).rejects.toThrow(
      "System messages cannot be reacted to",
    );
  });

  it("filters loaded messages before the user's hiddenAt cutoff", async () => {
    const conversationId = v7();
    const userId = v7();
    const hiddenAt = new Date("2024-01-02T00:00:00Z");
    const visibleMessage = {
      id: v7(),
      conversationId,
      senderId: v7(),
      type: MessageType.TEXT,
      text: "new",
      createdAt: new Date("2024-01-03T00:00:00Z"),
      pinned: false,
    };
    const oldMessage = {
      id: v7(),
      conversationId,
      senderId: v7(),
      type: MessageType.TEXT,
      text: "old",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      pinned: false,
    };
    const handler = new LoadMessagesQueryHandler(
      {
        findByCond: jest.fn().mockResolvedValue({
          id: v7(),
          conversationId,
          userId,
          role: ConversationMemberRole.MEMBER,
          status: ConversationMemberStatus.ACTIVE,
          joinedAt: new Date(),
          hiddenAt,
          updatedAt: new Date(),
        }),
        list: jest.fn().mockResolvedValue([]),
      } as any,
      {
        listWithCursor: jest.fn().mockResolvedValue([visibleMessage, oldMessage]),
      } as any,
      {
        findByMessageId: jest.fn().mockResolvedValue([]),
      } as any,
      {
        get: jest.fn(),
      } as any,
      {
        get: jest.fn().mockResolvedValue(null),
      } as any,
      {
        get: jest.fn().mockResolvedValue(null),
      } as any,
      {
        get: jest.fn().mockResolvedValue({ id: conversationId }),
      } as any,
    );

    const result = await handler.query({ conversationId, userId, limit: 20 });

    expect(result.messages).toEqual([visibleMessage]);
    expect(result.hasMore).toBe(false);
  });

  it("deletes a private conversation for one user and only shows messages after recreation activity", async () => {
    const store = new ChatE2EStore();
    const user = store.addUser({ displayName: "Owner" });
    const target = store.addUser({ displayName: "Target" });
    const repos = createConversationListRepos(store);
    const conversation = store.addConversation({
      type: ConversationType.PRIVATE,
      pairKey: [user.id, target.id].sort().join("_"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      createdAt: new Date("2024-01-01T00:00:00Z"),
    });
    store.addMember({
      conversationId: conversation.id,
      userId: user.id,
      lastActivityAt: new Date("2024-01-01T00:00:00Z"),
    });
    store.addMember({
      conversationId: conversation.id,
      userId: target.id,
      lastActivityAt: new Date("2024-01-01T00:00:00Z"),
    });
    const oldMessage = store.addMessage({
      conversationId: conversation.id,
      senderId: target.id,
      type: MessageType.FILE,
      text: "old needle",
      media: [{ url: "https://cdn.test/old.pdf", mediaType: MediaType.FILE, name: "old.pdf" }],
      createdAt: new Date("2024-01-01T00:00:00Z"),
    });
    store.classifications.push({
      id: v7(),
      conversationId: conversation.id,
      type: ClassificationType.FILE,
      senderId: target.id,
      url: "https://cdn.test/old.pdf",
      name: "old.pdf",
      messageId: oldMessage.id,
      createdAt: oldMessage.createdAt,
    });
    await repos.conversationRepo.update(conversation.id, {
      lastMessage: {
        messageId: oldMessage.id,
        senderId: oldMessage.senderId,
        type: oldMessage.type,
        textPreview: oldMessage.text,
        createdAt: oldMessage.createdAt,
      },
      lastMessageAt: oldMessage.createdAt,
    });

    const deleteHandler = new DeleteConversationForMeHandler(repos.memberRepo as any, repos.memberRepo as any);
    const deleted = await deleteHandler.execute({ conversationId: conversation.id, userId: user.id });

    const listHandler = new GetConversationsQueryHandler(
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.userRepo as any,
      repos.messageRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
    );
    const afterDeleteList = await listHandler.query({ userId: user.id, page: 1, limit: 20 });
    expect(afterDeleteList.map((item) => item.id)).not.toContain(conversation.id);

    const newCreatedAt = new Date(deleted.deletedAt.getTime() + 1000);
    const newMessage = store.addMessage({
      conversationId: conversation.id,
      senderId: target.id,
      type: MessageType.FILE,
      text: "new needle",
      media: [{ url: "https://cdn.test/new.pdf", mediaType: MediaType.FILE, name: "new.pdf" }],
      createdAt: newCreatedAt,
    });
    store.classifications.push({
      id: v7(),
      conversationId: conversation.id,
      type: ClassificationType.FILE,
      senderId: target.id,
      url: "https://cdn.test/new.pdf",
      name: "new.pdf",
      messageId: newMessage.id,
      createdAt: newMessage.createdAt,
    });
    await repos.conversationRepo.update(conversation.id, {
      lastMessage: {
        messageId: newMessage.id,
        senderId: newMessage.senderId,
        type: newMessage.type,
        textPreview: newMessage.text,
        createdAt: newMessage.createdAt,
      },
      lastMessageAt: newMessage.createdAt,
    });
    await repos.memberRepo.touchActivityForConversation(conversation.id, newCreatedAt);

    const afterActivityList = await listHandler.query({ userId: user.id, page: 1, limit: 20 });
    expect(afterActivityList.map((item) => item.id)).toContain(conversation.id);
    expect(afterActivityList.find((item) => item.id === conversation.id)?.lastMessage?.messageId).toBe(newMessage.id);

    const loadHandler = new LoadMessagesQueryHandler(
      repos.memberRepo as any,
      repos.messageRepo as any,
      { findByMessageId: jest.fn().mockResolvedValue([]) } as any,
      repos.userRepo as any,
      { get: jest.fn().mockResolvedValue(null) } as any,
      { get: jest.fn().mockResolvedValue(null) } as any,
      repos.conversationRepo as any,
    );
    const loaded = await loadHandler.query({ conversationId: conversation.id, userId: user.id, limit: 20 });
    expect(loaded.messages.map((message) => message.id)).toEqual([newMessage.id]);

    const searchHandler = new SearchMessagesHandler(repos.memberRepo as any, repos.messageRepo as any);
    const search = await searchHandler.query({
      conversationId: conversation.id,
      userId: user.id,
      query: "needle",
      limit: 20,
    });
    expect(search.messages.map((message) => message.id)).toEqual([newMessage.id]);

    const mediaHandler = new GetConversationMediaQueryHandler(
      repos.memberRepo as any,
      repos.classificationRepo as any,
      repos.messageRepo as any,
    );
    const media = await mediaHandler.query({
      conversationId: conversation.id,
      userId: user.id,
      type: "file",
      limit: 20,
    });
    expect(media.files.map((file) => file.messageId)).toEqual([newMessage.id]);
  });

  it("deletes Saved Messages for the user and only loads newly saved messages after delete", async () => {
    const store = new ChatE2EStore();
    const user = store.addUser({ displayName: "Owner" });
    const repos = createConversationListRepos(store);
    const sourceConversation = store.addConversation({
      type: ConversationType.GROUP,
      name: "Source",
    });
    store.addMember({ conversationId: sourceConversation.id, userId: user.id });
    const oldSource = store.addMessage({
      conversationId: sourceConversation.id,
      senderId: user.id,
      type: MessageType.TEXT,
      text: "old saved needle",
    });
    const newSource = store.addMessage({
      conversationId: sourceConversation.id,
      senderId: user.id,
      type: MessageType.TEXT,
      text: "new saved needle",
    });
    const forwardHandler = new ForwardMessagesHandler(
      repos.conversationRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.memberRepo as any,
      repos.messageRepo as any,
      repos.messageRepo as any,
      repos.classificationRepo as any,
    );
    const saveHandler = new SaveMessagesToMyDocumentHandler(
      repos.conversationRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.memberRepo as any,
      forwardHandler,
    );

    const oldSaved = await saveHandler.execute({ userId: user.id, messageIds: [oldSource.id] });
    const deleteHandler = new DeleteConversationForMeHandler(repos.memberRepo as any, repos.memberRepo as any);
    await deleteHandler.execute({ conversationId: oldSaved.conversation.id, userId: user.id });

    const listHandler = new GetConversationsQueryHandler(
      repos.conversationRepo as any,
      repos.memberRepo as any,
      repos.userRepo as any,
      repos.messageRepo as any,
      repos.conversationRepo as any,
      repos.memberRepo as any,
    );
    const afterDeleteList = await listHandler.query({ userId: user.id, page: 1, limit: 20 });
    expect(afterDeleteList.map((item) => item.id)).not.toContain(oldSaved.conversation.id);

    await new Promise((resolve) => setTimeout(resolve, 2));
    const newSaved = await saveHandler.execute({ userId: user.id, messageIds: [newSource.id] });
    expect(newSaved.conversation).toEqual(
      expect.objectContaining({
        id: oldSaved.conversation.id,
        type: "saved_messages",
        isSavedMessages: true,
      }),
    );

    const loadHandler = new LoadMessagesQueryHandler(
      repos.memberRepo as any,
      repos.messageRepo as any,
      { findByMessageId: jest.fn().mockResolvedValue([]) } as any,
      repos.userRepo as any,
      { get: jest.fn().mockResolvedValue(null) } as any,
      { get: jest.fn().mockResolvedValue(null) } as any,
      repos.conversationRepo as any,
    );
    const loaded = await loadHandler.query({
      conversationId: oldSaved.conversation.id,
      userId: user.id,
      limit: 20,
    });
    expect(loaded.messages.map((message) => message.id)).toEqual(newSaved.messages.map((message) => message.id));
  });
});
