import { IMessagingUseCase, CreateGroupData } from "../interface";
import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  Message,
  MediaAttachment,
  MessageReaction,
  Poll,
  GroupSettings,
} from "../model/model";
import {
  ConversationWithMetadata,
  ConversationDetail,
  LoadMessagesResult,
  ReactionResult,
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
import { GetConversationsCursorQueryHandler } from "./get-conversations-cursor";
import { GetConversationDetailQueryHandler } from "./get-conversation-detail";
import { GetConversationMembersQueryHandler } from "./get-conversation-members";
import { LoadMessagesQueryHandler } from "./load-messages";
import { GetTotalUnreadCountQueryHandler } from "./get-total-unread-count";
import { GetGroupMembersQueryHandler } from "./get-group-members";
import { RevokeMessageHandler } from "./revoke-message";
import { DeleteMessageForMeHandler } from "./delete-message-for-me";
import { DeleteMessageForEveryoneHandler } from "./delete-message-for-everyone";
import { ForwardMessagesHandler } from "./forward-messages";
import { MuteConversationHandler, UnmuteConversationHandler } from "./mute-conversation";
import { PinConversationHandler, UnpinConversationHandler } from "./pin-conversation";
import { ArchiveConversationHandler, UnarchiveConversationHandler } from "./archive-conversation";
import { EditMessageHandler } from "./edit-message";
import { PinMessageHandler } from "./pin-message";
import { UnpinMessageHandler } from "./unpin-message";
import { GetPinnedMessagesHandler } from "./get-pinned-messages";
import { AddReactionHandler, RemoveReactionHandler, RemoveAllReactionsHandler, GetReactionsHandler } from "./add-reaction";
import { QuoteMessageHandler } from "./quote-message";
import { SetAdminHandler } from "./set-admin";
import { TransferOwnerHandler } from "./transfer-owner";
import { CreatePollHandler } from "./create-poll";
import { GetPollsHandler } from "./get-polls";
import { VotePollHandler } from "./vote-poll";
import { GetPollResultsHandler } from "./get-poll-results";
import { GetPendingMembersHandler } from "./get-pending-members";
import { ApproveMemberHandler } from "./approve-member";
import { RejectMemberHandler } from "./reject-member";
import { UpdateGroupSettingsHandler } from "./update-group-settings";
import { GetGroupInfoHandler } from "./get-group-info";
import { GetConversationMediaQueryHandler } from "./get-conversation-media";
import { DissolveGroupHandler } from "./dissolve-group";

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
    private readonly deleteMessageForEveryoneHandler: DeleteMessageForEveryoneHandler,
    private readonly forwardMessagesHandler: ForwardMessagesHandler,
    private readonly muteConversationHandler: MuteConversationHandler,
    private readonly unmuteConversationHandler: UnmuteConversationHandler,
    private readonly pinConversationHandler: PinConversationHandler,
    private readonly unpinConversationHandler: UnpinConversationHandler,
    private readonly archiveConversationHandler: ArchiveConversationHandler,
    private readonly unarchiveConversationHandler: UnarchiveConversationHandler,
    private readonly editMessageHandler: EditMessageHandler,
    private readonly pinMessageHandler: PinMessageHandler,
    private readonly unpinMessageHandler: UnpinMessageHandler,
    private readonly getPinnedMessagesHandler: GetPinnedMessagesHandler,
    private readonly addReactionHandler: AddReactionHandler,
    private readonly removeReactionHandler: RemoveReactionHandler,
    private readonly removeAllReactionsHandler: RemoveAllReactionsHandler,
    private readonly getReactionsHandler: GetReactionsHandler,
    private readonly quoteMessageHandler: QuoteMessageHandler,
    private readonly setAdminHandler: SetAdminHandler,
    private readonly transferOwnerHandler: TransferOwnerHandler,
    private readonly createPollHandler: CreatePollHandler,
    private readonly getPollsHandler: GetPollsHandler,
    private readonly votePollHandler: VotePollHandler,
    private readonly getPollResultsHandler: GetPollResultsHandler,
    private readonly getPendingMembersHandler: GetPendingMembersHandler,
    private readonly approveMemberHandler: ApproveMemberHandler,
    private readonly rejectMemberHandler: RejectMemberHandler,
    private readonly updateGroupSettingsHandler: UpdateGroupSettingsHandler,
    private readonly getGroupInfoHandler: GetGroupInfoHandler,
    private readonly getConversationMediaQueryHandler: GetConversationMediaQueryHandler,
    private readonly getConversationsCursorQueryHandler: GetConversationsCursorQueryHandler,
    private readonly dissolveGroupHandler: DissolveGroupHandler,
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
  ): Promise<Message[]> {
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
  ): Promise<Message[]> {
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

  async deleteMessageForMe(messageId: string, userId: string): Promise<Message> {
    return this.deleteMessageForMeHandler.execute({ messageId, userId });
  }

  async deleteMessageForEveryone(messageId: string, userId: string): Promise<Message> {
    return this.deleteMessageForEveryoneHandler.execute({ messageId, userId });
  }

  async getMessage(messageId: string): Promise<Message | null> {
    return this.deleteMessageForMeHandler.getMessage(messageId);
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

  async pinMessage(messageId: string, userId: string): Promise<Message> {
    return this.pinMessageHandler.execute({ messageId, userId });
  }

  async unpinMessage(messageId: string, userId: string): Promise<Message> {
    return this.unpinMessageHandler.execute({ messageId, userId });
  }

  async getPinnedMessages(conversationId: string, userId: string): Promise<Message[]> {
    return this.getPinnedMessagesHandler.query({ conversationId, userId });
  }

  async addReaction(messageId: string, userId: string, emoji: string): Promise<MessageReaction> {
    return this.addReactionHandler.execute({ messageId, userId, emoji });
  }

  async removeReaction(messageId: string, userId: string, emoji?: string): Promise<number> {
    return this.removeReactionHandler.execute(messageId, userId, emoji);
  }

  async removeAllReactions(messageId: string, userId: string): Promise<number> {
    return this.removeAllReactionsHandler.execute(messageId, userId);
  }

  async getReactions(messageId: string): Promise<ReactionResult> {
    return this.getReactionsHandler.execute(messageId);
  }

  async quoteMessage(
    conversationId: string,
    senderId: string,
    text: string | undefined,
    media: MediaAttachment[] | undefined,
    quotedMessageId: string,
  ): Promise<Message[]> {
    return this.quoteMessageHandler.execute({
      conversationId,
      senderId,
      text,
      media,
      quotedMessageId,
    });
  }

  async setAdmin(groupId: string, requesterId: string, targetUserId: string, isAdmin: boolean): Promise<Conversation> {
    return this.setAdminHandler.execute({ groupId, requesterId, targetUserId, isAdmin });
  }

  async transferOwner(groupId: string, requesterId: string, newOwnerId: string): Promise<Conversation> {
    return this.transferOwnerHandler.execute({ groupId, requesterId, newOwnerId });
  }

  async createPoll(
    conversationId: string,
    creatorId: string,
    question: string,
    options: string[],
    isMultipleChoice?: boolean,
    allowAddOption?: boolean,
    expiresAt?: string,
  ): Promise<Poll> {
    return this.createPollHandler.execute({
      conversationId,
      creatorId,
      question,
      options,
      isMultipleChoice,
      allowAddOption,
      expiresAt,
    });
  }

  async getPolls(conversationId: string): Promise<Poll[]> {
    return this.getPollsHandler.query({ conversationId });
  }

  async votePoll(pollId: string, userId: string, optionIds: string[]): Promise<Poll> {
    return this.votePollHandler.execute({ pollId, userId, optionIds });
  }

  async getPollResults(pollId: string): Promise<Poll> {
    return this.getPollResultsHandler.query({ pollId });
  }

  async getPendingMembers(groupId: string): Promise<ConversationMember[]> {
    return this.getPendingMembersHandler.query({ groupId });
  }

  async approveMember(groupId: string, userId: string, requesterId: string): Promise<ConversationMember> {
    return this.approveMemberHandler.execute({ groupId, userId, requesterId });
  }

  async rejectMember(groupId: string, userId: string, requesterId: string): Promise<void> {
    return this.rejectMemberHandler.execute({ groupId, userId, requesterId });
  }

  async updateGroupSettings(
    groupId: string,
    requesterId: string,
    settings: { allowSendLink?: boolean; requireApproval?: boolean; allowMemberInvite?: boolean },
  ): Promise<Conversation> {
    return this.updateGroupSettingsHandler.execute({
      groupId,
      requesterId,
      ...settings,
    });
  }

  async getGroupInfo(groupId: string, userId: string): Promise<{
    conversation: Conversation;
    members: ConversationMember[];
    currentUserRole: ConversationMemberRole;
    settings: GroupSettings;
  }> {
    return this.getGroupInfoHandler.query({ groupId, userId });
  }

  async getConversationMedia(
    conversationId: string,
    userId: string,
    cursor: string | undefined,
    limit: number,
    type: "all" | "image" | "file" | "link",
  ): Promise<{ images: any[]; files: any[]; links: any[]; nextCursor: string; hasMore: boolean }> {
    return this.getConversationMediaQueryHandler.query({
      conversationId,
      userId,
      cursor,
      limit,
      type,
    });
  }

  async getConversationsCursor(
    userId: string,
    cursor?: string,
    limit?: number,
  ): Promise<{
    pinned: Array<Conversation & { unreadCount: number; role: ConversationMemberRole; pinnedAt?: Date }> | null;
    data: Array<Conversation & { unreadCount: number; role: ConversationMemberRole }>;
    nextCursor?: string;
    hasMore: boolean;
  }> {
    return this.getConversationsCursorQueryHandler.query({ userId, cursor, limit });
  }

  async dissolveGroup(groupId: string, requesterId: string): Promise<void> {
    return this.dissolveGroupHandler.execute({ groupId, requesterId });
  }
}
