import { SocketEvent } from "../../../constants/socket-events";
import { ConversationMemberStatus } from "../../../model/model";
import { getAttachedMessage } from "../../../usecase/utility-messages";
import { SocketHandlerContext } from "./types";

export interface SocketNotifierMethods {
  notifyNewGroup(memberUserIds: string[], groupData: any): void;
  notifySystemMessages(conversationId: string, messages: any[] | any | undefined): Promise<void>;
  notifyMembersAdded(conversationId: string, newMembers: any[], addedBy?: string): Promise<void>;
  notifyMemberRemoved(conversationId: string, removedUserId: string, removedBy?: string, reason?: "removed" | "left"): Promise<void>;
  notifyMemberLeft(conversationId: string, leftUserId: string, leftBy: string): Promise<void>;
  notifyGroupDissolved(conversationId: string, dissolvedBy: string, memberUserIds: string[]): void;
  notifyConversationPinned(conversationId: string, pinnedBy: string, pinned: boolean): void;
  notifyConversationArchived(conversationId: string, userId: string, archived: boolean): void;
  notifyConversationMuted(conversationId: string, userId: string, mutedBy: string, muteUntil?: string): void;
  notifyGroupRenamed(conversationId: string, newName: string, renamedBy: string): void;
  notifyGroupAvatarChanged(conversationId: string, avatarUrl: string, changedBy: string): void;
  notifyGroupUpdated(conversationId: string, updatedData: any): void;
  notifyMessageSeen(userId: string, conversationId: string, seenBy: string, lastSeenMessageId: string, state?: Record<string, any>): void;
  notifyMessageDelivered(userId: string, conversationId: string, deliveredBy: string, lastDeliveredMessageId: string, state?: Record<string, any>): void;
  notifyMessageDeleted(userId: string, conversationId: string, messageId: string, deletedBy: string): void;
  notifyAdminChanged(conversationId: string, targetUserId: string, isAdmin: boolean): void;
  notifyOwnerTransferred(conversationId: string, oldOwnerId: string, newOwnerId: string): void;
  notifyPollCreated(conversationId: string, poll: any): void;
  notifyPollVoted(conversationId: string, pollId: string, userId: string, poll: any): void;
  notifyMemberApproved(conversationId: string, userId: string, member: any, approvedBy?: string): Promise<void>;
  notifyMemberRejected(conversationId: string, userId: string): void;
  notifyGroupSettingsUpdated(conversationId: string, settings: any): void;
  notifyOnlineStatus(userId: string, isOnline: boolean): void;
  notifyUserPresence(userId: string, lastSeen: Date): void;
  notifyReactionSummary(conversationId: string, messageId: string, summary: Record<string, number>): void;
  notifyMessageRecall(conversationId: string, messageId: string, recallBy: string): void;
  notifyEditStart(conversationId: string, messageId: string, userId: string): void;
  notifyEditEnd(conversationId: string, messageId: string, userId: string): void;
  notifyVoiceMessage(conversationId: string, message: any): void;
  notifyLocationShare(conversationId: string, userId: string, location: any): void;
  notifyMemberNicknameChanged(conversationId: string, targetUserId: string, nickname: string, changedBy: string): void;
  notifyMemberWallpaperChanged(conversationId: string, wallpaperUrl: string | null, changedBy: string): void;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value)));
}

function isActiveMember(member: any): boolean {
  return !!member && member.status === ConversationMemberStatus.ACTIVE && !member.leftAt;
}

function latestMessageFromConversation(conversationId: string, conversation: any) {
  const lastMessage = conversation?.lastMessage;
  if (!lastMessage?.messageId) return undefined;

  return {
    id: lastMessage.messageId,
    conversationId,
    senderId: lastMessage.senderId,
    type: lastMessage.type,
    text: lastMessage.textPreview,
    createdAt: lastMessage.createdAt,
    pinned: false,
  };
}

async function getActiveMemberUserIds(context: SocketHandlerContext, conversationId: string): Promise<string[]> {
  try {
    return await context.getMemberUserIds(conversationId);
  } catch {
    return [];
  }
}

async function emitConversationCreatedForUser(
  context: SocketHandlerContext,
  conversationId: string,
  userId: string,
  extra: Record<string, any> = {},
) {
  try {
    const detail = await context.useCase.getConversationDetail(conversationId, userId);
    context.emitToUser(userId, SocketEvent.CONVERSATION_CREATED, {
      conversation: detail.conversation,
      members: detail.members,
      currentUserRole: detail.currentUserRole,
      systemMessage: latestMessageFromConversation(conversationId, detail.conversation),
      ...extra,
    });
  } catch {
    // User may no longer be an active member by the time the notifier runs.
  }
}

async function emitLatestMessageToUsers(
  context: SocketHandlerContext,
  conversationId: string,
  userIds: string[],
) {
  const firstUserId = userIds[0];
  if (!firstUserId) return;

  try {
    const detail = await context.useCase.getConversationDetail(conversationId, firstUserId);
    const message = latestMessageFromConversation(conversationId, detail.conversation);
    if (!message) return;

    for (const userId of uniqueStrings(userIds)) {
      context.emitToUser(userId, SocketEvent.RECEIVE_MESSAGE, {
        conversationId,
        message,
      });
    }
  } catch {
    // Best-effort realtime notification; persistence has already succeeded.
  }
}

function normalizeMessages(messages: any[] | any | undefined): any[] {
  if (!messages) return [];
  return Array.isArray(messages) ? messages.filter(Boolean) : [messages];
}

async function emitMessagesToActiveMembers(
  context: SocketHandlerContext,
  conversationId: string,
  messages: any[] | any | undefined,
) {
  const normalizedMessages = normalizeMessages(messages);
  if (normalizedMessages.length === 0) return;

  const activeMemberUserIds = await getActiveMemberUserIds(context, conversationId);
  for (const userId of uniqueStrings(activeMemberUserIds)) {
    for (const message of normalizedMessages) {
      context.emitToUser(userId, SocketEvent.RECEIVE_MESSAGE, {
        conversationId,
        message,
      });
    }
  }
}

export const socketNotifiers = {
  notifyNewGroup(this: SocketHandlerContext, memberUserIds: string[], groupData: any) {
    for (const userId of memberUserIds) {
      this.namespace.to(`user:${userId}`).emit(SocketEvent.CONVERSATION_CREATED, groupData);
    }
  },

  async notifySystemMessages(this: SocketHandlerContext, conversationId: string, messages: any[] | any | undefined) {
    await emitMessagesToActiveMembers(this, conversationId, messages);
  },

  async notifyMembersAdded(this: SocketHandlerContext, conversationId: string, newMembers: any[], addedBy?: string) {
    const payload = {
      conversationId,
      newMembers,
      addedBy,
    };

    this.emitToGroupRoom(conversationId, SocketEvent.CONVERSATION_MEMBERS_ADDED, payload);

    const activeMemberUserIds = await getActiveMemberUserIds(this, conversationId);
    for (const userId of activeMemberUserIds) {
      this.emitToUser(userId, SocketEvent.CONVERSATION_MEMBERS_ADDED, payload);
    }

    for (const member of newMembers.filter(isActiveMember)) {
      await emitConversationCreatedForUser(this, conversationId, member.userId, { member, addedBy });
    }

    const systemMessage = getAttachedMessage(newMembers, "systemMessage");
    if (systemMessage) {
      await emitMessagesToActiveMembers(this, conversationId, systemMessage);
    } else {
      await emitLatestMessageToUsers(this, conversationId, activeMemberUserIds);
    }
  },

  async notifyMemberRemoved(
    this: SocketHandlerContext,
    conversationId: string,
    removedUserId: string,
    removedBy?: string,
    reason: "removed" | "left" = "removed",
  ) {
    const payload = {
      conversationId,
      removedUserId,
      removedBy,
      reason,
    };

    this.emitToGroupRoom(conversationId, SocketEvent.CONVERSATION_MEMBER_REMOVED, payload);
    const activeMemberUserIds = await getActiveMemberUserIds(this, conversationId);
    for (const userId of uniqueStrings([...activeMemberUserIds, removedUserId])) {
      this.emitToUser(userId, SocketEvent.CONVERSATION_MEMBER_REMOVED, payload);
    }

    await emitLatestMessageToUsers(this, conversationId, activeMemberUserIds);
  },

  async notifyMemberLeft(this: SocketHandlerContext, conversationId: string, leftUserId: string, leftBy: string) {
    const memberRemovedPayload = {
      conversationId,
      removedUserId: leftUserId,
      removedBy: leftBy,
      reason: "left",
    };
    const memberLeftPayload = {
      conversationId,
      leftUserId,
      leftBy,
    };

    this.emitToGroupRoom(conversationId, SocketEvent.CONVERSATION_MEMBER_REMOVED, memberRemovedPayload);
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_MEMBER_LEFT, memberLeftPayload);

    const activeMemberUserIds = await getActiveMemberUserIds(this, conversationId);
    for (const userId of uniqueStrings([...activeMemberUserIds, leftUserId])) {
      this.emitToUser(userId, SocketEvent.CONVERSATION_MEMBER_REMOVED, memberRemovedPayload);
      this.emitToUser(userId, SocketEvent.GROUP_MEMBER_LEFT, memberLeftPayload);
    }

    await emitLatestMessageToUsers(this, conversationId, activeMemberUserIds);
  },

  notifyGroupDissolved(this: SocketHandlerContext, conversationId: string, dissolvedBy: string, memberUserIds: string[]) {
    for (const userId of memberUserIds) {
      this.emitToUser(userId, SocketEvent.GROUP_DISSOLVED, {
        conversationId,
        dissolvedBy,
      });
    }
  },

  notifyConversationPinned(this: SocketHandlerContext, conversationId: string, pinnedBy: string, pinned: boolean) {
    this.namespace.to(`user:${pinnedBy}`).emit(SocketEvent.CONVERSATION_PIN_TOGGLED, {
      conversationId,
      pinnedBy,
      pinned,
    });
  },

  notifyConversationArchived(this: SocketHandlerContext, conversationId: string, userId: string, archived: boolean) {
    this.namespace.to(`user:${userId}`).emit(SocketEvent.CONVERSATION_ARCHIVED_TOGGLED, {
      conversationId,
      userId,
      archived,
    });
  },

  notifyConversationMuted(this: SocketHandlerContext, conversationId: string, userId: string, mutedBy: string, muteUntil?: string) {
    this.namespace.to(`user:${userId}`).emit(SocketEvent.CONVERSATION_MUTE_CHANGED, {
      conversationId,
      userId,
      mutedBy,
      muteUntil,
    });
  },

  notifyGroupRenamed(this: SocketHandlerContext, conversationId: string, newName: string, renamedBy: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_RENAMED, {
      conversationId,
      newName,
      renamedBy,
    });
  },

  notifyGroupAvatarChanged(this: SocketHandlerContext, conversationId: string, avatarUrl: string, changedBy: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_AVATAR_CHANGED, {
      conversationId,
      avatarUrl,
      changedBy,
    });
  },

  notifyGroupUpdated(this: SocketHandlerContext, conversationId: string, updatedData: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.CONVERSATION_UPDATED, {
      conversationId,
      data: updatedData,
    });
  },

  notifyMessageSeen(this: SocketHandlerContext, 
    userId: string,
    conversationId: string,
    seenByUserId: string,
    lastSeenMessageId: string,
    state: Record<string, any> = {},
  ) {
    this.emitToUser(userId, SocketEvent.MESSAGE_SEEN, {
      ...state,
      conversationId,
      userId: seenByUserId,
      lastSeenMessageId,
    });
  },

  notifyMessageDelivered(this: SocketHandlerContext, 
    userId: string,
    conversationId: string,
    deliveredByUserId: string,
    lastDeliveredMessageId: string,
    state: Record<string, any> = {},
  ) {
    this.emitToUser(userId, SocketEvent.MESSAGE_DELIVERED, {
      ...state,
      conversationId,
      userId: deliveredByUserId,
      lastDeliveredMessageId,
    });
  },

  notifyMessageDeleted(this: SocketHandlerContext, 
    conversationId: string,
    messageId: string,
    deletedBy: string,
  ) {
    this.emitToGroupRoom(conversationId, SocketEvent.MESSAGE_DELETED, {
      conversationId,
      messageId,
      deletedBy,
    });
  },

  notifyAdminChanged(this: SocketHandlerContext, conversationId: string, targetUserId: string, isAdmin: boolean) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_ADMIN_CHANGED, {
      conversationId,
      targetUserId,
      isAdmin,
    });
  },

  notifyOwnerTransferred(this: SocketHandlerContext, conversationId: string, oldOwnerId: string, newOwnerId: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_OWNER_TRANSFERRED, {
      conversationId,
      oldOwnerId,
      newOwnerId,
    });
  },

  notifyPollCreated(this: SocketHandlerContext, conversationId: string, poll: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.POLL_NEW, {
      conversationId,
      poll,
    });
  },

  notifyPollVoted(this: SocketHandlerContext, conversationId: string, pollId: string, userId: string, poll: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.POLL_VOTE, {
      conversationId,
      pollId,
      userId,
      poll,
    });
  },

  async notifyMemberApproved(
    this: SocketHandlerContext,
    conversationId: string,
    userId: string,
    member: any,
    approvedBy?: string,
  ) {
    const payload = {
      conversationId,
      userId,
      member,
      approvedBy,
    };

    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_MEMBER_APPROVED, payload);

    const activeMemberUserIds = await getActiveMemberUserIds(this, conversationId);
    for (const memberUserId of uniqueStrings([...activeMemberUserIds, userId])) {
      this.emitToUser(memberUserId, SocketEvent.GROUP_MEMBER_APPROVED, payload);
    }

    await emitConversationCreatedForUser(this, conversationId, userId, {
      member,
      approvedBy,
    });
    await emitLatestMessageToUsers(this, conversationId, activeMemberUserIds);
  },

  notifyMemberRejected(this: SocketHandlerContext, conversationId: string, userId: string) {
    this.emitToUser(userId, SocketEvent.GROUP_MEMBER_REJECTED, {
      conversationId,
      userId,
    });
  },

  notifyGroupSettingsUpdated(this: SocketHandlerContext, conversationId: string, settings: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_SETTINGS_UPDATED, {
      conversationId,
      settings,
    });
  },

  notifyOnlineStatus(this: SocketHandlerContext, userId: string, isOnline: boolean) {
    this.namespace.to(`user:${userId}`).emit(SocketEvent.ONLINE_STATUS, { userId, isOnline });
  },

  notifyUserPresence(this: SocketHandlerContext, userId: string, lastSeen: Date) {
    this.namespace.to(`user:${userId}`).emit(SocketEvent.USER_PRESENCE, { userId, lastSeen });
  },

  notifyReactionSummary(this: SocketHandlerContext, conversationId: string, messageId: string, summary: Record<string, number>) {
    this.emitToGroupRoom(conversationId, SocketEvent.MESSAGE_REACTION_SUMMARY, { messageId, summary });
  },

  notifyMessageRecall(this: SocketHandlerContext, conversationId: string, messageId: string, recallBy: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.RECALL_MESSAGE, { messageId, recallBy });
  },

  notifyEditStart(this: SocketHandlerContext, conversationId: string, messageId: string, userId: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.EDIT_MESSAGE_START, { messageId, userId });
  },

  notifyEditEnd(this: SocketHandlerContext, conversationId: string, messageId: string, userId: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.EDIT_MESSAGE_END, { messageId, userId });
  },

  notifyVoiceMessage(this: SocketHandlerContext, conversationId: string, message: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.VOICE_MESSAGE, { conversationId, message });
  },

  notifyLocationShare(this: SocketHandlerContext, conversationId: string, userId: string, location: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.LOCATION_SHARE, { conversationId, userId, location });
  },

  notifyMemberNicknameChanged(
    this: SocketHandlerContext,
    conversationId: string,
    targetUserId: string,
    nickname: string,
    changedBy: string,
  ) {
    this.emitToGroupRoom(conversationId, SocketEvent.MEMBER_NICKNAME_CHANGED, {
      conversationId,
      targetUserId,
      nickname,
      changedBy,
    });
  },

  notifyMemberWallpaperChanged(
    this: SocketHandlerContext,
    conversationId: string,
    wallpaperUrl: string | null,
    changedBy: string,
  ) {
    this.emitToGroupRoom(conversationId, SocketEvent.MEMBER_WALLPAPER_CHANGED, {
      conversationId,
      wallpaperUrl,
      changedBy,
    });
  },
};
