import { v7 } from "uuid";
import {
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IConversationMemberQueryRepository,
  IConversationQueryRepository,
} from "../interface";
import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
} from "../model/model";

export const SELF_CONVERSATION_NAME = "Saved Messages";
export const SAVED_MESSAGES_CONVERSATION_TYPE = "saved_messages" as const;
export type ConversationResponseType = ConversationType | typeof SAVED_MESSAGES_CONVERSATION_TYPE;

export function selfConversationPairKey(userId: string): string {
  return `self_${userId}`;
}

export function isSelfConversation(
  conversation: Pick<ConversationListItem, "type" | "pairKey">,
  userId: string,
): boolean {
  return conversation.type === ConversationType.PRIVATE && conversation.pairKey === selfConversationPairKey(userId);
}

export type ConversationListItem = Omit<Conversation, "type"> & {
  type: ConversationResponseType;
  activityAt?: Date;
  pinned?: boolean;
  isPinned?: boolean;
  pinnedAt?: Date;
  isSelfChat?: boolean;
  isSavedMessages?: boolean;
};

export function normalizeConversationListItem<T extends ConversationListItem>(item: T, userId: string): T {
  const selfChat = isSelfConversation(item, userId);
  if (!selfChat) return item;

  return {
    ...item,
    type: SAVED_MESSAGES_CONVERSATION_TYPE,
    name: SELF_CONVERSATION_NAME,
    avatarUrl: item.avatarUrl || "",
    membersCount: 1,
    isSelfChat: true,
    isSavedMessages: true,
  };
}

export function compareConversationListItems(userId: string) {
  return (a: ConversationListItem, b: ConversationListItem): number => {
    const pinnedA = !!(a.pinned || a.isPinned);
    const pinnedB = !!(b.pinned || b.isPinned);

    // Ordering rules:
    // 1) All pinned conversations are always on top.
    // 2) Unpinned conversations, including Saved Messages, sort by activity.
    if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;

    if (pinnedA && pinnedB) {
      const pinnedAtA = a.pinnedAt?.getTime?.() || 0;
      const pinnedAtB = b.pinnedAt?.getTime?.() || 0;
      if (pinnedAtA !== pinnedAtB) return pinnedAtB - pinnedAtA;

      const activityA = getConversationActivityTime(a);
      const activityB = getConversationActivityTime(b);
      if (activityA !== activityB) return activityB - activityA;

      return a.id.localeCompare(b.id);
    }

    const activityA = getConversationActivityTime(a);
    const activityB = getConversationActivityTime(b);
    if (activityA !== activityB) return activityB - activityA;

    return a.id.localeCompare(b.id);
  };
}

export function getConversationActivityTime(item: ConversationListItem): number {
  return (
    item.activityAt?.getTime?.() ||
    item.lastMessageAt?.getTime?.() ||
    item.updatedAt?.getTime?.() ||
    item.createdAt.getTime()
  );
}

export async function ensureSelfConversation(
  userId: string,
  conversationQueryRepo: IConversationQueryRepository,
  conversationCommandRepo: IConversationCommandRepository,
  memberQueryRepo: IConversationMemberQueryRepository,
  memberCommandRepo: IConversationMemberCommandRepository,
): Promise<{ conversation: Conversation; member: ConversationMember }> {
  const pairKey = selfConversationPairKey(userId);
  const now = new Date();

  let conversation =
    (await (conversationQueryRepo as any).findByPairKey?.(pairKey, ConversationType.PRIVATE)) ||
    (await conversationQueryRepo.findByCond({
      type: ConversationType.PRIVATE,
      pairKey,
    }));

  if (!conversation) {
    conversation = {
      id: v7(),
      type: ConversationType.PRIVATE,
      pairKey,
      name: SELF_CONVERSATION_NAME,
      createdBy: userId,
      membersCount: 1,
      createdAt: now,
      updatedAt: now,
    };
    await conversationCommandRepo.insert(conversation);
  } else if (conversation.name !== SELF_CONVERSATION_NAME || conversation.membersCount !== 1) {
    await conversationCommandRepo.update(conversation.id, {
      name: SELF_CONVERSATION_NAME,
      membersCount: 1,
    });
    conversation = {
      ...conversation,
      name: SELF_CONVERSATION_NAME,
      membersCount: 1,
      updatedAt: now,
    };
  }

  let member = await memberQueryRepo.findByCond({
    conversationId: conversation.id,
    userId,
  });

  if (!member) {
    member = {
      id: v7(),
      conversationId: conversation.id,
      userId,
      role: ConversationMemberRole.MEMBER,
      status: ConversationMemberStatus.ACTIVE,
      joinedAt: now,
      unreadCount: 0,
      pinned: false,
      archived: false,
      hiddenUserIds: [],
      hidden: false,
      lastActivityAt: conversation.lastMessageAt || conversation.updatedAt || now,
      updatedAt: now,
    };
    await memberCommandRepo.insert(member);
    return { conversation, member };
  }

  const update: Record<string, unknown> = {};
  if (member.status !== ConversationMemberStatus.ACTIVE) update.status = ConversationMemberStatus.ACTIVE;
  if (member.leftAt) update.leftAt = null;
  if (member.archived) update.archived = false;
  if (member.hidden) update.hidden = false;
  if (member.hiddenAt) update.hiddenAt = null;
  if (!member.lastActivityAt) update.lastActivityAt = conversation.lastMessageAt || conversation.updatedAt || now;

  if (Object.keys(update).length > 0) {
    await memberCommandRepo.update(member.id, update as any);
    member = {
      ...member,
      ...update,
      leftAt: update.leftAt === null ? undefined : member.leftAt,
      hiddenAt: update.hiddenAt === null ? undefined : member.hiddenAt,
      updatedAt: now,
    } as ConversationMember;
  }

  return { conversation, member };
}
