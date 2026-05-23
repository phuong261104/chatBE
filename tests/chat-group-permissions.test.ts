import {
  canUseGroupUtility,
  isActiveMember,
  isGroupManager,
  isOwnerMember,
  isPollClosed,
  normalizeGroupSettings,
  sanitizePollForViewer,
} from "@modules/chat/usecase/group-permissions";
import {
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  PollStatus,
} from "@modules/chat/model";

function member(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id || "member-id",
    conversationId: overrides.conversationId || "conversation-id",
    userId: overrides.userId || "user-id",
    role: overrides.role || ConversationMemberRole.MEMBER,
    status: overrides.status || ConversationMemberStatus.ACTIVE,
    joinedAt: overrides.joinedAt || new Date("2026-01-01T00:00:00.000Z"),
    unreadCount: 0,
    pinned: false,
    archived: false,
    hiddenUserIds: [],
    updatedAt: overrides.updatedAt || new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as any;
}

function conversation(overrides: Record<string, any> = {}) {
  return {
    id: "conversation-id",
    type: ConversationType.GROUP,
    ownerId: "owner-id",
    membersCount: 3,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as any;
}

function poll(overrides: Record<string, any> = {}) {
  return {
    id: "poll-id",
    conversationId: "conversation-id",
    question: "Pick one",
    options: [
      { id: "option-a", text: "A", voteCount: 2, votedUserIds: ["owner-id", "viewer-id"] },
      { id: "option-b", text: "B", voteCount: 1, votedUserIds: ["other-id"] },
    ],
    totalVotes: 3,
    isMultipleChoice: false,
    allowAddOption: false,
    showResultsBeforeClose: false,
    status: PollStatus.ACTIVE,
    createdBy: "owner-id",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as any;
}

describe("group permission helpers", () => {
  it("normalizes partial group settings without losing nested defaults", () => {
    expect(normalizeGroupSettings({ utilityPermissions: { poll: "admins" } as any })).toEqual({
      allowSendLink: true,
      requireApproval: false,
      allowMemberInvite: true,
      whoCanSendMessages: "all",
      whoCanAddMembers: "all",
      utilityPermissions: {
        poll: "admins",
        reminder: "all",
        note: "all",
      },
    });
  });

  it("identifies active members, owners, and managers using role or conversation owner metadata", () => {
    expect(isActiveMember(member())).toBe(true);
    expect(isActiveMember(member({ leftAt: new Date() }))).toBe(false);
    expect(isActiveMember(member({ status: ConversationMemberStatus.PENDING }))).toBe(false);

    expect(isOwnerMember(member({ role: ConversationMemberRole.OWNER }))).toBe(true);
    expect(isOwnerMember(member({ userId: "owner-id" }), conversation())).toBe(true);
    expect(isGroupManager(member({ role: ConversationMemberRole.ADMIN }))).toBe(true);
    expect(isGroupManager(member(), conversation())).toBe(false);
  });

  it("allows restricted utilities only for owner or admin members", () => {
    const settings = normalizeGroupSettings({
      utilityPermissions: { poll: "admins", reminder: "all" },
    } as any);

    expect(canUseGroupUtility(settings, "poll", member(), conversation())).toBe(false);
    expect(canUseGroupUtility(settings, "poll", member({ role: ConversationMemberRole.ADMIN }), conversation())).toBe(true);
    expect(canUseGroupUtility(settings, "reminder", member(), conversation())).toBe(true);
  });

  it("detects closed polls by status or expiry", () => {
    expect(isPollClosed(poll({ status: PollStatus.CLOSED }))).toBe(true);
    expect(isPollClosed(poll({ expiresAt: new Date(Date.now() - 1000) }))).toBe(true);
    expect(isPollClosed(poll({ expiresAt: new Date(Date.now() + 60_000) }))).toBe(false);
  });

  it("hides poll results from normal viewers before close while preserving their own vote", () => {
    const viewer = member({ userId: "viewer-id" });
    const sanitized = sanitizePollForViewer(poll(), viewer, conversation());

    expect(sanitized.totalVotes).toBe(1);
    expect(sanitized.options).toEqual([
      expect.objectContaining({ id: "option-a", voteCount: 1, votedUserIds: ["viewer-id"] }),
      expect.objectContaining({ id: "option-b", voteCount: 0, votedUserIds: [] }),
    ]);
  });

  it("returns full poll results to managers and after poll close", () => {
    const original = poll();

    expect(sanitizePollForViewer(original, member({ role: ConversationMemberRole.ADMIN }), conversation())).toBe(original);
    expect(sanitizePollForViewer(poll({ status: PollStatus.CLOSED }), member(), conversation()).totalVotes).toBe(3);
  });
});
