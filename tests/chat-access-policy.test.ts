import { AppError } from "@share/app-error";
import { ChatAccessPolicy } from "@modules/chat/usecase/chat-access-policy";
import {
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  MessageStatus,
  MessageType,
} from "@modules/chat/model";

function createPolicy(overrides: {
  users?: Array<{ id: string; status?: string }>;
  blocks?: Array<[string, string]>;
  conversations?: Record<string, any>;
  members?: Array<Record<string, any>>;
} = {}) {
  const users = new Map(
    (overrides.users || []).map((user) => [user.id, { status: "active", ...user }]),
  );
  const blocks = new Set((overrides.blocks || []).map(([blockerId, blockedUserId]) => `${blockerId}#${blockedUserId}`));
  const conversations = new Map(Object.entries(overrides.conversations || {}));
  const members = overrides.members || [];

  const userQueryRepo = {
    get: jest.fn((id: string) => Promise.resolve(users.get(id) || null)),
    findByIds: jest.fn((ids: string[]) => Promise.resolve(ids.map((id) => users.get(id)).filter(Boolean))),
  };
  const blockQueryRepo = {
    findByCond: jest.fn(({ blockerId, blockedUserId }) =>
      Promise.resolve(blocks.has(`${blockerId}#${blockedUserId}`) ? { id: `${blockerId}#${blockedUserId}` } : null),
    ),
  };
  const conversationQueryRepo = {
    get: jest.fn((id: string) => Promise.resolve(conversations.get(id) || null)),
  };
  const conversationMemberQueryRepo = {
    findByCond: jest.fn((cond: { conversationId: string; userId: string }) =>
      Promise.resolve(
        members.find((member) => member.conversationId === cond.conversationId && member.userId === cond.userId) ||
          null,
      ),
    ),
    listByConversationId: jest.fn((conversationId: string) =>
      Promise.resolve(members.filter((member) => member.conversationId === conversationId)),
    ),
  };

  return {
    policy: new ChatAccessPolicy(
      userQueryRepo as any,
      blockQueryRepo as any,
      conversationQueryRepo as any,
      conversationMemberQueryRepo as any,
    ),
    repos: {
      userQueryRepo,
      blockQueryRepo,
      conversationQueryRepo,
      conversationMemberQueryRepo,
    },
  };
}

function expectAppError(error: unknown, statusCode: number, code: string) {
  expect(error).toBeInstanceOf(AppError);
  const appError = error as AppError;
  expect(appError.getStatusCode()).toBe(statusCode);
  expect(appError.toJSON(false)).toEqual(expect.objectContaining({ details: { code } }));
}

describe("ChatAccessPolicy", () => {
  it("allows private conversation only when both users are active and neither side has blocked the other", async () => {
    const { policy, repos } = createPolicy({
      users: [{ id: "user-1" }, { id: "user-2" }],
    });

    await expect(policy.assertCanStartPrivateConversation("user-1", "user-2")).resolves.toBeUndefined();
    expect(repos.userQueryRepo.get).toHaveBeenCalledWith("user-1");
    expect(repos.userQueryRepo.get).toHaveBeenCalledWith("user-2");
    expect(repos.blockQueryRepo.findByCond).toHaveBeenCalledWith({
      blockerId: "user-1",
      blockedUserId: "user-2",
    });
    expect(repos.blockQueryRepo.findByCond).toHaveBeenCalledWith({
      blockerId: "user-2",
      blockedUserId: "user-1",
    });
  });

  it("rejects private conversation when either direction is blocked", async () => {
    const { policy } = createPolicy({
      users: [{ id: "user-1" }, { id: "user-2" }],
      blocks: [["user-2", "user-1"]],
    });

    try {
      await policy.assertCanStartPrivateConversation("user-1", "user-2");
      throw new Error("Expected blocked users to be rejected");
    } catch (error) {
      expectAppError(error, 403, "blocked");
    }
  });

  it("validates create-group members before allowing group creation", async () => {
    const { policy } = createPolicy({
      users: [{ id: "creator" }, { id: "member-1" }, { id: "member-2" }],
    });

    await expect(policy.validateCreateGroupMembers("creator", ["member-1", "member-2"])).resolves.toEqual([
      "member-1",
      "member-2",
    ]);
  });

  it("rejects duplicate or self members before repository lookup", async () => {
    const duplicate = createPolicy();
    await expect(duplicate.policy.validateCreateGroupMembers("creator", ["member-1", "member-1"])).rejects.toThrow(
      "Duplicate members are not allowed",
    );
    expect(duplicate.repos.userQueryRepo.findByIds).not.toHaveBeenCalled();

    const self = createPolicy();
    await expect(self.policy.validateAddGroupMembers("requester", ["requester"], 3)).rejects.toThrow(
      "Requester cannot add themselves",
    );
    expect(self.repos.userQueryRepo.findByIds).not.toHaveBeenCalled();
  });

  it("returns active member ids while excluding left and pending members", async () => {
    const { policy } = createPolicy({
      members: [
        {
          conversationId: "conversation-1",
          userId: "owner",
          role: ConversationMemberRole.OWNER,
          status: ConversationMemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
        {
          conversationId: "conversation-1",
          userId: "left",
          role: ConversationMemberRole.MEMBER,
          status: ConversationMemberStatus.ACTIVE,
          leftAt: new Date(),
          joinedAt: new Date(),
        },
        {
          conversationId: "conversation-1",
          userId: "pending",
          role: ConversationMemberRole.MEMBER,
          status: ConversationMemberStatus.PENDING,
          joinedAt: new Date(),
        },
        {
          conversationId: "conversation-1",
          userId: "active",
          role: ConversationMemberRole.MEMBER,
          status: ConversationMemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      ],
    });

    await expect(policy.getActiveMemberUserIds("conversation-1", "owner")).resolves.toEqual(["active"]);
  });

  it("guards group and message visibility checks with domain errors", async () => {
    const { policy } = createPolicy({
      conversations: {
        "conversation-1": {
          id: "conversation-1",
          type: ConversationType.PRIVATE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    });

    await expect(policy.assertGroupConversation("conversation-1")).rejects.toThrow(
      "Only group conversations are supported",
    );

    expect(() =>
      policy.assertMessageVisibleToUser(
        {
          id: "message-1",
          conversationId: "conversation-1",
          senderId: "sender",
          type: MessageType.TEXT,
          text: "hidden",
          messageStatus: MessageStatus.ACTIVE,
          deletedForUserIds: ["viewer"],
          pinned: false,
          createdAt: new Date(),
        },
        "viewer",
      ),
    ).toThrow("Message not found");
  });
});
