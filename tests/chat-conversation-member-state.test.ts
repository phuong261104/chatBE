import {
  ArchiveConversationHandler,
  UnarchiveConversationHandler,
} from "@modules/chat/usecase/archive-conversation";
import { GetConversationMembersQueryHandler } from "@modules/chat/usecase/get-conversation-members";
import { GetTotalUnreadCountQueryHandler } from "@modules/chat/usecase/get-total-unread-count";
import {
  MuteConversationHandler,
  UnmuteConversationHandler,
} from "@modules/chat/usecase/mute-conversation";
import {
  PinConversationHandler,
  UnpinConversationHandler,
} from "@modules/chat/usecase/pin-conversation";
import {
  ConversationMemberRole,
  ConversationMemberStatus,
} from "@modules/chat/model";

function member(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id || "member-id",
    conversationId: overrides.conversationId || "conversation-id",
    userId: overrides.userId || "user-id",
    role: overrides.role || ConversationMemberRole.MEMBER,
    status: overrides.status || ConversationMemberStatus.ACTIVE,
    joinedAt: overrides.joinedAt || new Date("2026-01-01T00:00:00.000Z"),
    unreadCount: overrides.unreadCount || 0,
    pinned: overrides.pinned || false,
    archived: overrides.archived || false,
    hiddenUserIds: [],
    updatedAt: overrides.updatedAt || new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createMemberRepos(currentMember: any = member()) {
  return {
    queryRepo: {
      findByCond: jest.fn().mockResolvedValue(currentMember),
      list: jest.fn().mockResolvedValue([]),
    },
    commandRepo: {
      update: jest.fn().mockResolvedValue(true),
    },
  };
}

describe("conversation member state handlers", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("pins and unpins an active conversation member", async () => {
    const repos = createMemberRepos(member({ pinned: false }));
    await new PinConversationHandler(repos.queryRepo as any, repos.commandRepo as any).execute({
      conversationId: "conversation-id",
      userId: "user-id",
    });
    expect(repos.commandRepo.update).toHaveBeenCalledWith(
      "member-id",
      expect.objectContaining({ pinned: true, pinnedAt: expect.any(Date) }),
    );

    repos.queryRepo.findByCond.mockResolvedValue(member({ pinned: true }));
    await new UnpinConversationHandler(repos.queryRepo as any, repos.commandRepo as any).execute({
      conversationId: "conversation-id",
      userId: "user-id",
    });
    expect(repos.commandRepo.update).toHaveBeenCalledWith("member-id", { pinned: false });
  });

  it("rejects duplicate pin and unpin state changes", async () => {
    const pinnedRepos = createMemberRepos(member({ pinned: true }));
    await expect(
      new PinConversationHandler(pinnedRepos.queryRepo as any, pinnedRepos.commandRepo as any).execute({
        conversationId: "conversation-id",
        userId: "user-id",
      }),
    ).rejects.toThrow("Conversation is already pinned");

    const unpinnedRepos = createMemberRepos(member({ pinned: false }));
    await expect(
      new UnpinConversationHandler(unpinnedRepos.queryRepo as any, unpinnedRepos.commandRepo as any).execute({
        conversationId: "conversation-id",
        userId: "user-id",
      }),
    ).rejects.toThrow("Conversation is not pinned");
  });

  it("mutes with an explicit duration and unmutes by clearing muteUntil", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const repos = createMemberRepos(member());

    await new MuteConversationHandler(repos.queryRepo as any, repos.commandRepo as any).execute({
      conversationId: "conversation-id",
      userId: "user-id",
      duration: 60_000,
    });
    expect(repos.commandRepo.update).toHaveBeenCalledWith("member-id", {
      muteUntil: new Date("2026-01-01T00:01:00.000Z"),
    });

    await new UnmuteConversationHandler(repos.queryRepo as any, repos.commandRepo as any).execute({
      conversationId: "conversation-id",
      userId: "user-id",
    });
    expect(repos.commandRepo.update).toHaveBeenCalledWith("member-id", { muteUntil: undefined });
  });

  it("archives and unarchives an active conversation member", async () => {
    const repos = createMemberRepos(member({ archived: false }));
    await new ArchiveConversationHandler(repos.queryRepo as any, repos.commandRepo as any).execute({
      conversationId: "conversation-id",
      userId: "user-id",
    });
    expect(repos.commandRepo.update).toHaveBeenCalledWith("member-id", { archived: true });

    repos.queryRepo.findByCond.mockResolvedValue(member({ archived: true }));
    await new UnarchiveConversationHandler(repos.queryRepo as any, repos.commandRepo as any).execute({
      conversationId: "conversation-id",
      userId: "user-id",
    });
    expect(repos.commandRepo.update).toHaveBeenCalledWith("member-id", { archived: false });
  });

  it("sums unread counts only from active non-archived memberships", async () => {
    const queryRepo = {
      list: jest.fn().mockResolvedValue([
        member({ unreadCount: 2 }),
        member({ id: "archived", unreadCount: 10, archived: true }),
        member({ id: "left", unreadCount: 10, leftAt: new Date() }),
        member({ id: "pending", unreadCount: 10, status: ConversationMemberStatus.PENDING }),
        member({ id: "zero" }),
      ]),
    };

    await expect(new GetTotalUnreadCountQueryHandler(queryRepo as any).query({ userId: "user-id" })).resolves.toBe(2);
  });

  it("lists active conversation members while honoring excludeUserId", async () => {
    const queryRepo = {
      list: jest.fn().mockResolvedValue([
        member({ userId: "user-a" }),
        member({ id: "b", userId: "user-b" }),
        member({ id: "left", userId: "left", leftAt: new Date() }),
        member({ id: "pending", userId: "pending", status: ConversationMemberStatus.PENDING }),
      ]),
    };

    await expect(
      new GetConversationMembersQueryHandler(queryRepo as any).query({
        conversationId: "conversation-id",
        excludeUserId: "user-a",
      }),
    ).resolves.toEqual(["user-b"]);
  });
});
