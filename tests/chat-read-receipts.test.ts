import {
  GetReadReceiptsHandler,
  MarkMultipleAsReadHandler,
} from "@modules/chat/usecase/read-receipts";

function message(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id || "message-id",
    conversationId: overrides.conversationId || "conversation-id",
    senderId: overrides.senderId || "sender-id",
    createdAt: overrides.createdAt || new Date("2026-01-01T00:00:00.000Z"),
    readBy: overrides.readBy,
    ...overrides,
  };
}

describe("read receipt handlers", () => {
  it("returns read receipts excluding the sender", async () => {
    const messageQueryRepo = {
      get: jest.fn().mockResolvedValue(
        message({
          readBy: [
            { userId: "sender-id", readAt: "2026-01-01T00:00:00.000Z" },
            { userId: "reader-id", readAt: "2026-01-01T00:01:00.000Z" },
          ],
        }),
      ),
    };

    await expect(new GetReadReceiptsHandler(messageQueryRepo as any, {} as any).query({
      messageId: "message-id",
      userId: "requester-id",
    })).resolves.toEqual([
      { userId: "reader-id", readAt: new Date("2026-01-01T00:01:00.000Z") },
    ]);
  });

  it("throws when reading receipts for a missing message", async () => {
    const messageQueryRepo = { get: jest.fn().mockResolvedValue(null) };

    await expect(new GetReadReceiptsHandler(messageQueryRepo as any, {} as any).query({
      messageId: "missing",
      userId: "requester-id",
    })).rejects.toThrow("Message not found");
  });

  it("marks unread messages as read and stores the latest read message by createdAt", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T01:00:00.000Z"));
    const messages = new Map([
      ["newer", message({ id: "newer", createdAt: new Date("2026-01-01T00:02:00.000Z") })],
      ["older", message({ id: "older", createdAt: new Date("2026-01-01T00:01:00.000Z") })],
      ["own", message({ id: "own", senderId: "reader-id", createdAt: new Date("2026-01-01T00:03:00.000Z") })],
      ["other-conversation", message({ id: "other-conversation", conversationId: "other" })],
      [
        "already",
        message({
          id: "already",
          createdAt: new Date("2026-01-01T00:04:00.000Z"),
          readBy: [{ userId: "reader-id", readAt: "2026-01-01T00:05:00.000Z" }],
        }),
      ],
    ]);
    const memberQueryRepo = {
      findByCond: jest.fn().mockResolvedValue({ id: "member-id" }),
    };
    const memberCommandRepo = {
      update: jest.fn().mockResolvedValue(true),
    };
    const messageQueryRepo = {
      get: jest.fn((id: string) => Promise.resolve(messages.get(id) || null)),
    };
    const messageCommandRepo = {
      update: jest.fn().mockResolvedValue(true),
    };

    await new MarkMultipleAsReadHandler(
      memberQueryRepo as any,
      memberCommandRepo as any,
      messageQueryRepo as any,
      messageCommandRepo as any,
    ).execute({
      conversationId: "conversation-id",
      userId: "reader-id",
      messageIds: ["newer", "older", "own", "other-conversation", "already", "missing"],
    });

    expect(messageCommandRepo.update).toHaveBeenCalledTimes(2);
    expect(messageCommandRepo.update).toHaveBeenCalledWith("newer", {
      readBy: [{ userId: "reader-id", readAt: "2026-01-01T01:00:00.000Z" }],
    });
    expect(messageCommandRepo.update).toHaveBeenCalledWith("older", {
      readBy: [{ userId: "reader-id", readAt: "2026-01-01T01:00:00.000Z" }],
    });
    expect(memberCommandRepo.update).toHaveBeenCalledWith("member-id", {
      lastSeenMessageId: "newer",
      unreadCount: 0,
    });
  });

  it("rejects marking messages read when the user is not a member", async () => {
    const handler = new MarkMultipleAsReadHandler(
      { findByCond: jest.fn().mockResolvedValue(null) } as any,
      { update: jest.fn() } as any,
      { get: jest.fn() } as any,
      { update: jest.fn() } as any,
    );

    await expect(handler.execute({
      conversationId: "conversation-id",
      userId: "reader-id",
      messageIds: ["message-id"],
    })).rejects.toThrow("You are not a member of this conversation");
  });

  afterEach(() => {
    jest.useRealTimers();
  });
});
