import { v7 } from "uuid";
import { EditMessageHandler } from "@modules/chat/usecase/edit-message";
import { LeaveGroupHandler } from "@modules/chat/usecase/leave-group";
import { QuoteMessageHandler } from "@modules/chat/usecase/quote-message";
import {
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  MediaType,
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
});
