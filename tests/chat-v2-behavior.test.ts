import { v7 } from "uuid";
import { EditMessageHandler } from "@modules/chat/usecase/edit-message";
import { AddReactionHandler } from "@modules/chat/usecase/add-reaction";
import { AddMembersToGroupHandler } from "@modules/chat/usecase/add-members-to-group";
import { ForwardMessagesHandler } from "@modules/chat/usecase/forward-messages";
import { LeaveGroupHandler } from "@modules/chat/usecase/leave-group";
import { LoadMessagesQueryHandler } from "@modules/chat/usecase/load-messages";
import { QuoteMessageHandler } from "@modules/chat/usecase/quote-message";
import {
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  MediaType,
  MessageStatus,
  MessageType,
} from "@modules/chat/model";

describe("chat v2 business behavior", () => {
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
      findByCond: jest.fn().mockResolvedValue(ownerMember),
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
      role: ConversationMemberRole.ADMIN,
    });
    expect(conversationRepo.update).toHaveBeenCalledWith(
      conversationId,
      expect.objectContaining({
        ownerId: adminId,
        admins: [adminId],
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
    );

    const result = await handler.query({ conversationId, userId, limit: 20 });

    expect(result.messages).toEqual([visibleMessage]);
    expect(result.hasMore).toBe(false);
  });
});
