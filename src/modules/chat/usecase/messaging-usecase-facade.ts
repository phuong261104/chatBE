import { IMessagingUseCase, CreateGroupData } from "../interface";
import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  Message,
  MediaAttachment,
} from "../model/model";
import {
  ConversationWithMetadata,
  ConversationDetail,
  LoadMessagesResult,
} from "../model/dto";

import { GetOrCreatePrivateConversationHandler } from "./get-or-create-private-conversation";
import { SendMessageHandler } from "./send-message";
import { CreateGroupHandler } from "./create-group";
import { SendGroupMessageHandler } from "./send-group-message";
import { AddMembersToGroupHandler } from "./add-members-to-group";
import { RemoveMemberFromGroupHandler } from "./remove-member-from-group";
import { UpdateGroupInfoHandler } from "./update-group-info";
import { MarkAsSeenHandler } from "./mark-as-seen";
import { MarkAsDeliveredHandler } from "./mark-as-delivered";
import { LeaveGroupHandler } from "./leave-group";
import { GetConversationsQueryHandler } from "./get-conversations";
import { GetConversationDetailQueryHandler } from "./get-conversation-detail";
import { GetConversationMembersQueryHandler } from "./get-conversation-members";
import { LoadMessagesQueryHandler } from "./load-messages";
import { GetTotalUnreadCountQueryHandler } from "./get-total-unread-count";
import { GetGroupMembersQueryHandler } from "./get-group-members";
import { RevokeMessageHandler } from "./revoke-message";
import { DeleteMessageForMeHandler } from "./delete-message-for-me";
import { ForwardMessagesHandler } from "./forward-messages";
import { MuteConversationHandler, UnmuteConversationHandler } from "./mute-conversation";
import { PinConversationHandler, UnpinConversationHandler } from "./pin-conversation";
import { ArchiveConversationHandler, UnarchiveConversationHandler } from "./archive-conversation";
import { EditMessageHandler } from "./edit-message";

export class MessagingUseCaseFacade implements IMessagingUseCase {
  constructor(
    private readonly getOrCreatePrivateConversationHandler: GetOrCreatePrivateConversationHandler,
    private readonly sendMessageHandler: SendMessageHandler,
    private readonly createGroupHandler: CreateGroupHandler,
    private readonly sendGroupMessageHandler: SendGroupMessageHandler,
    private readonly addMembersToGroupHandler: AddMembersToGroupHandler,
    private readonly removeMemberFromGroupHandler: RemoveMemberFromGroupHandler,
    private readonly updateGroupInfoHandler: UpdateGroupInfoHandler,
    private readonly markAsSeenHandler: MarkAsSeenHandler,
    private readonly markAsDeliveredHandler: MarkAsDeliveredHandler,
    private readonly leaveGroupHandler: LeaveGroupHandler,
    private readonly getConversationsQueryHandler: GetConversationsQueryHandler,
    private readonly getConversationDetailQueryHandler: GetConversationDetailQueryHandler,
    private readonly getConversationMembersQueryHandler: GetConversationMembersQueryHandler,
    private readonly loadMessagesQueryHandler: LoadMessagesQueryHandler,
    private readonly getTotalUnreadCountQueryHandler: GetTotalUnreadCountQueryHandler,
    private readonly getGroupMembersQueryHandler: GetGroupMembersQueryHandler,
    private readonly revokeMessageHandler: RevokeMessageHandler,
    private readonly deleteMessageForMeHandler: DeleteMessageForMeHandler,
    private readonly forwardMessagesHandler: ForwardMessagesHandler,
    private readonly muteConversationHandler: MuteConversationHandler,
    private readonly unmuteConversationHandler: UnmuteConversationHandler,
    private readonly pinConversationHandler: PinConversationHandler,
    private readonly unpinConversationHandler: UnpinConversationHandler,
    private readonly archiveConversationHandler: ArchiveConversationHandler,
    private readonly unarchiveConversationHandler: UnarchiveConversationHandler,
    private readonly editMessageHandler: EditMessageHandler,
  ) {}

  async getOrCreatePrivateConversation(
    currentUserId: string,
    targetUserId: string,
  ): Promise<Conversation> {
    return this.getOrCreatePrivateConversationHandler.execute({
      currentUserId,
      targetUserId,
    });
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    text?: string,
    media?: MediaAttachment[],
  ): Promise<Message> {
    return this.sendMessageHandler.execute({
      conversationId,
      senderId,
      text,
      media,
    });
  }

  async getConversationMembers(
    conversationId: string,
    excludeUserId?: string,
  ): Promise<string[]> {
    return this.getConversationMembersQueryHandler.query({
      conversationId,
      excludeUserId,
    });
  }

  async createGroup(
    creatorId: string,
    data: CreateGroupData,
  ): Promise<{
    conversation: Conversation;
    members: ConversationMember[];
    systemMessage: Message;
  }> {
    return this.createGroupHandler.execute({ creatorId, data });
  }

  async sendGroupMessage(
    conversationId: string,
    senderId: string,
    text?: string,
    media?: MediaAttachment[],
  ): Promise<Message> {
    return this.sendGroupMessageHandler.execute({
      conversationId,
      senderId,
      text,
      media,
    });
  }

  async addMembersToGroup(
    conversationId: string,
    requesterId: string,
    memberIds: string[],
  ): Promise<ConversationMember[]> {
    return this.addMembersToGroupHandler.execute({
      conversationId,
      requesterId,
      memberIds,
    });
  }

  async removeMemberFromGroup(
    conversationId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    return this.removeMemberFromGroupHandler.execute({
      conversationId,
      requesterId,
      targetUserId,
    });
  }

  async updateGroupInfo(
    conversationId: string,
    requesterId: string,
    data: { name?: string; avatarUrl?: string },
  ): Promise<Conversation> {
    return this.updateGroupInfoHandler.execute({
      conversationId,
      requesterId,
      ...data,
    });
  }

  async getConversations(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<
    Array<Conversation & { unreadCount: number; role: ConversationMemberRole }>
  > {
    return this.getConversationsQueryHandler.query({ userId, page, limit });
  }

  async getConversationDetail(
    conversationId: string,
    userId: string,
  ): Promise<{
    conversation: Conversation;
    members: ConversationMember[];
    currentUserRole: ConversationMemberRole;
  }> {
    return this.getConversationDetailQueryHandler.query({
      conversationId,
      userId,
    });
  }

  async loadMessages(
    conversationId: string,
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<{
    messages: Message[];
    nextCursor: string;
    hasMore: boolean;
  }> {
    return this.loadMessagesQueryHandler.query({
      conversationId,
      userId,
      cursor,
      limit,
    });
  }

  async markAsSeen(
    conversationId: string,
    userId: string,
    lastSeenMessageId: string,
  ): Promise<void> {
    return this.markAsSeenHandler.execute({
      conversationId,
      userId,
      lastSeenMessageId,
    });
  }

  async markAsDelivered(
    conversationId: string,
    userId: string,
    lastDeliveredMessageId: string,
  ): Promise<void> {
    return this.markAsDeliveredHandler.execute({
      conversationId,
      userId,
      lastDeliveredMessageId,
    });
  }

  async getTotalUnreadCount(userId: string): Promise<number> {
    return this.getTotalUnreadCountQueryHandler.query({ userId });
  }

  async leaveGroup(conversationId: string, userId: string): Promise<void> {
    return this.leaveGroupHandler.execute({ conversationId, userId });
  }

  async getGroupMembers(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMember[]> {
    return this.getGroupMembersQueryHandler.query({ conversationId, userId });
  }

  async revokeMessage(messageId: string, userId: string): Promise<Message> {
    return this.revokeMessageHandler.execute({ messageId, userId });
  }

  async deleteMessageForMe(messageId: string, userId: string): Promise<void> {
    return this.deleteMessageForMeHandler.execute({ messageId, userId });
  }

  async forwardMessages(
    userId: string,
    messageIds: string[],
    targetConversationIds: string[],
  ): Promise<Message[]> {
    return this.forwardMessagesHandler.execute({
      userId,
      messageIds,
      targetConversationIds,
    });
  }

  async muteConversation(
    conversationId: string,
    userId: string,
    muteUntil?: string,
    duration?: number,
  ): Promise<void> {
    return this.muteConversationHandler.execute({ conversationId, userId, muteUntil, duration });
  }

  async unmuteConversation(conversationId: string, userId: string): Promise<void> {
    return this.unmuteConversationHandler.execute({ conversationId, userId });
  }

  async pinConversation(conversationId: string, userId: string): Promise<void> {
    return this.pinConversationHandler.execute({ conversationId, userId });
  }

  async unpinConversation(conversationId: string, userId: string): Promise<void> {
    return this.unpinConversationHandler.execute({ conversationId, userId });
  }

  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    return this.archiveConversationHandler.execute({ conversationId, userId });
  }

  async unarchiveConversation(conversationId: string, userId: string): Promise<void> {
    return this.unarchiveConversationHandler.execute({ conversationId, userId });
  }

  async editMessage(messageId: string, userId: string, text: string): Promise<Message> {
    return this.editMessageHandler.execute({ messageId, userId, text });
  }
}
