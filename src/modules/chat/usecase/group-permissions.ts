import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  GroupSettings,
  Poll,
  PollStatus,
} from "../model/model";

export const DEFAULT_GROUP_SETTINGS: GroupSettings = {
  allowSendLink: true,
  requireApproval: false,
  allowMemberInvite: true,
  whoCanSendMessages: "all",
  whoCanAddMembers: "all",
  utilityPermissions: {
    poll: "all",
    reminder: "all",
    note: "all",
  },
};

export function normalizeGroupSettings(settings?: Partial<GroupSettings>): GroupSettings {
  return {
    ...DEFAULT_GROUP_SETTINGS,
    ...(settings || {}),
    utilityPermissions: {
      ...DEFAULT_GROUP_SETTINGS.utilityPermissions,
      ...(settings?.utilityPermissions || {}),
    },
  };
}

export function isActiveMember(member?: ConversationMember | null): member is ConversationMember {
  return !!member && !member.leftAt && member.status === ConversationMemberStatus.ACTIVE;
}

export function isOwnerMember(member: ConversationMember, conversation?: Conversation | null): boolean {
  return (
    member.role === ConversationMemberRole.OWNER ||
    (!!conversation && !!(conversation.ownerId || conversation.createdBy) &&
      member.userId === (conversation.ownerId || conversation.createdBy))
  );
}

export function isGroupManager(member: ConversationMember, conversation?: Conversation | null): boolean {
  return isOwnerMember(member, conversation) || member.role === ConversationMemberRole.ADMIN;
}

export function canUseGroupUtility(
  settings: GroupSettings,
  utility: keyof GroupSettings["utilityPermissions"],
  member: ConversationMember,
  conversation?: Conversation | null,
): boolean {
  const permission = settings.utilityPermissions[utility];
  return permission === "all" || isGroupManager(member, conversation);
}

export function isPollClosed(poll: Poll): boolean {
  return poll.status === PollStatus.CLOSED || (!!poll.expiresAt && new Date() > new Date(poll.expiresAt));
}

export function sanitizePollForViewer(
  poll: Poll,
  viewer: ConversationMember,
  conversation?: Conversation | null,
): Poll {
  if (poll.showResultsBeforeClose || isPollClosed(poll) || poll.createdBy === viewer.userId || isGroupManager(viewer, conversation)) {
    return poll;
  }

  return {
    ...poll,
    options: poll.options.map((option) => {
      const votedByViewer = option.votedUserIds.includes(viewer.userId);
      return {
        ...option,
        voteCount: votedByViewer ? 1 : 0,
        votedUserIds: votedByViewer ? [viewer.userId] : [],
      };
    }),
    totalVotes: poll.options.some((option) => option.votedUserIds.includes(viewer.userId)) ? 1 : 0,
  };
}
