import { SocketEvent } from "../../../constants/socket-events";
import { SocketHandlerContext } from "./types";

export interface SocketNotifierMethods {
  notifyNewGroup(memberUserIds: string[], groupData: any): void;
  notifyMembersAdded(conversationId: string, newMembers: any[]): void;
  notifyMemberRemoved(conversationId: string, removedUserId: string): void;
  notifyMemberLeft(conversationId: string, leftUserId: string, leftBy: string): void;
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
  notifyMemberApproved(conversationId: string, userId: string, member: any): void;
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

export const socketNotifiers = {
  notifyNewGroup(this: SocketHandlerContext, memberUserIds: string[], groupData: any) {
    for (const userId of memberUserIds) {
      this.namespace.to(`user:${userId}`).emit(SocketEvent.CONVERSATION_CREATED, groupData);
    }
  },

  notifyMembersAdded(this: SocketHandlerContext, conversationId: string, newMembers: any[]) {
    this.emitToGroupRoom(conversationId, SocketEvent.CONVERSATION_MEMBERS_ADDED, {
      conversationId,
      newMembers,
    });
  },

  notifyMemberRemoved(this: SocketHandlerContext, conversationId: string, removedUserId: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.CONVERSATION_MEMBER_REMOVED, {
      conversationId,
      removedUserId,
    });
  },

  notifyMemberLeft(this: SocketHandlerContext, conversationId: string, leftUserId: string, leftBy: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_MEMBER_LEFT, {
      conversationId,
      leftUserId,
      leftBy,
    });
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

  notifyMemberApproved(this: SocketHandlerContext, conversationId: string, userId: string, member: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_MEMBER_APPROVED, {
      conversationId,
      userId,
      member,
    });
    this.emitToUser(userId, SocketEvent.GROUP_MEMBER_APPROVED, {
      conversationId,
      userId,
      member,
    });
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
