import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  Message,
  MessageClassification,
  UserInfo,
  MediaAttachment,
  MessageReaction,
  Poll,
  GroupSettings,
  ClassificationType,
} from "../model/model";
import {
  ConversationCondDTO,
  ConversationUpdateDTO,
  ConversationMemberCondDTO,
  ConversationMemberUpdateDTO,
  MessageCondDTO,
  MessageUpdateDTO,
  UserCondDTO,
} from "../model";
import { PagingDTO } from "@share/model/paging";

export interface IUserQueryRepository {
  get(id: string): Promise<UserInfo | null>;
  findByCond(cond: UserCondDTO): Promise<UserInfo | null>;
  findByIds(ids: string[]): Promise<UserInfo[]>;
}

export interface IConversationQueryRepository {
  get(id: string): Promise<Conversation | null>;
  findByCond(cond: ConversationCondDTO): Promise<Conversation | null>;
  list(cond: ConversationCondDTO, paging: PagingDTO): Promise<Conversation[]>;
  listByIds(ids: string[]): Promise<Conversation[]>;
}

export interface IConversationCommandRepository {
  insert(conversation: Conversation): Promise<boolean>;
  update(id: string, data: ConversationUpdateDTO): Promise<boolean>;
  delete(id: string, isHard: boolean): Promise<boolean>;
}

export interface ConversationMemberCursorResult {
  pinnedMembers: ConversationMember[];
  normalMembers: ConversationMember[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface IConversationMemberQueryRepository {
  get(id: string): Promise<ConversationMember | null>;
  findByCond(
    cond: ConversationMemberCondDTO,
  ): Promise<ConversationMember | null>;
  list(
    cond: ConversationMemberCondDTO,
    paging: PagingDTO,
  ): Promise<ConversationMember[]>;
  listByUserIdCursor(
    userId: string,
    cursor?: string,
    limit?: number,
  ): Promise<ConversationMemberCursorResult>;
  listByConversationId(
    conversationId: string,
  ): Promise<ConversationMember[]>;
}

export interface IConversationMemberCommandRepository {
  insert(member: ConversationMember): Promise<boolean>;
  update(id: string, data: ConversationMemberUpdateDTO): Promise<boolean>;
  delete(id: string, isHard: boolean): Promise<boolean>;
}

export interface IMessageQueryRepository {
  get(id: string): Promise<Message | null>;
  findByCond(cond: MessageCondDTO): Promise<Message | null>;
  list(cond: MessageCondDTO, paging: PagingDTO): Promise<Message[]>;

  listWithCursor(
    conversationId: string,
    cursor: string | undefined,
    limit: number,
    viewerUserId?: string,
  ): Promise<Message[]>;

  findPinnedMessages(conversationId: string): Promise<Message[]>;

  searchMessages(
    conversationId: string,
    userId: string,
    query: string,
    cursor?: string,
    limit?: number,
  ): Promise<{
    messages: Message[];
    nextCursor?: string;
    hasMore: boolean;
    total: number;
  }>;
}

export interface IMessageCommandRepository {
  insert(message: Message): Promise<boolean>;
  batchInsert(messages: Message[]): Promise<boolean>;
  update(id: string, data: MessageUpdateDTO): Promise<boolean>;
  delete(id: string, isHard: boolean): Promise<boolean>;
}

export interface IMessageReactionQueryRepository {
  get(id: string): Promise<MessageReaction | null>;
  findByMessageId(messageId: string): Promise<MessageReaction[]>;
  findByUserAndMessage(messageId: string, userId: string): Promise<MessageReaction[]>;
  findByUserMessageEmoji(messageId: string, userId: string, emoji: string): Promise<MessageReaction | null>;
  getReactionSummary(messageId: string): Promise<Record<string, number>>;
}

export interface IMessageReactionCommandRepository {
  upsertReaction(reaction: MessageReaction): Promise<MessageReaction>;
  decrementReaction(messageId: string, userId: string, emoji: string): Promise<boolean>;
  decrementAllByUserAndMessage(messageId: string, userId: string): Promise<number>;
  deleteAllByUserAndMessage(messageId: string, userId: string): Promise<number>;
  deleteByMessageId(messageId: string): Promise<void>;
}

export interface IPollQueryRepository {
  get(id: string): Promise<Poll | null>;
  findByConversationId(conversationId: string): Promise<Poll[]>;
  findActivePolls(conversationId: string): Promise<Poll[]>;
}

export interface IPollCommandRepository {
  insert(poll: Poll): Promise<boolean>;
  update(id: string, data: Partial<Poll>): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

export interface IMessageClassificationRepository {
  insertBatch(classifications: MessageClassification[]): Promise<void>;
  deleteByMessageId(messageId: string): Promise<void>;
  listByConversationAndType(
    conversationId: string,
    type: ClassificationType,
    cursor?: string,
    limit?: number,
  ): Promise<{ items: MessageClassification[]; nextCursor: string; hasMore: boolean }>;
  listByConversation(
    conversationId: string,
    cursor?: string,
    limit?: number,
  ): Promise<{ items: MessageClassification[]; nextCursor: string; hasMore: boolean }>;
}

export interface CreateGroupData {
  name: string;
  memberIds: string[];
  avatarUrl?: string;
}

export interface IMessagingUseCase {
  getOrCreatePrivateConversation(
    currentUserId: string,
    targetUserId: string,
  ): Promise<Conversation>;

  sendMessage(
    conversationId: string,
    senderId: string,
    text?: string,
    media?: MediaAttachment[],
  ): Promise<Message[]>;

  getConversationMembers(
    conversationId: string,
    excludeUserId?: string,
  ): Promise<string[]>;

  createGroup(
    creatorId: string,
    data: CreateGroupData,
  ): Promise<{
    conversation: Conversation;
    members: ConversationMember[];
    systemMessage: Message;
  }>;

  sendGroupMessage(
    conversationId: string,
    senderId: string,
    text?: string,
    media?: MediaAttachment[],
  ): Promise<Message[]>;

  addMembersToGroup(
    conversationId: string,
    requesterId: string,
    memberIds: string[],
  ): Promise<ConversationMember[]>;

  removeMemberFromGroup(
    conversationId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void>;

  updateGroupInfo(
    conversationId: string,
    requesterId: string,
    data: { name?: string; avatarUrl?: string },
  ): Promise<Conversation>;

  getConversations(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<
    Array<Conversation & { unreadCount: number; role: ConversationMemberRole }>
  >;

  getConversationDetail(
    conversationId: string,
    userId: string,
  ): Promise<{
    conversation: Conversation;
    members: ConversationMember[];
    currentUserRole: ConversationMemberRole;
  }>;

  loadMessages(
    conversationId: string,
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<{
    messages: Message[];
    nextCursor: string;
    hasMore: boolean;
  }>;

  markAsSeen(
    conversationId: string,
    userId: string,
    lastSeenMessageId: string,
  ): Promise<void>;

  markAsDelivered(
    conversationId: string,
    userId: string,
    lastDeliveredMessageId: string,
  ): Promise<void>;

  getTotalUnreadCount(userId: string): Promise<number>;

  leaveGroup(conversationId: string, userId: string): Promise<void>;

  getGroupMembers(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMember[]>;

  revokeMessage(messageId: string, userId: string): Promise<Message>;

  deleteMessageForMe(messageId: string, userId: string): Promise<Message>;

  deleteMessageForEveryone(messageId: string, userId: string): Promise<Message>;

  forwardMessages(
    userId: string,
    messageIds: string[],
    targetConversationIds: string[],
  ): Promise<Message[]>;

  getMessage(messageId: string): Promise<Message | null>;

  muteConversation(
    conversationId: string,
    userId: string,
    muteUntil?: string,
    duration?: number,
  ): Promise<void>;

  unmuteConversation(conversationId: string, userId: string): Promise<void>;

  pinConversation(conversationId: string, userId: string): Promise<void>;

  unpinConversation(conversationId: string, userId: string): Promise<void>;

  archiveConversation(conversationId: string, userId: string): Promise<void>;

  unarchiveConversation(conversationId: string, userId: string): Promise<void>;

  editMessage(messageId: string, userId: string, text: string): Promise<Message>;

  pinMessage(messageId: string, userId: string): Promise<Message>;

  unpinMessage(messageId: string, userId: string): Promise<Message>;

  getPinnedMessages(conversationId: string, userId: string): Promise<Message[]>;

  searchMessages(
    conversationId: string,
    userId: string,
    query: string,
    cursor?: string,
    limit?: number,
  ): Promise<{
    messages: Message[];
    nextCursor?: string;
    hasMore: boolean;
    total: number;
  }>;

  addReaction(messageId: string, userId: string, emoji: string): Promise<MessageReaction>;

  removeReaction(messageId: string, userId: string, emoji?: string): Promise<number>;

  removeAllReactions(messageId: string, userId: string): Promise<number>;

  getReactions(messageId: string): Promise<{
    reactions: MessageReaction[];
    grouped: Record<string, number>;
  }>;

  quoteMessage(
    conversationId: string,
    senderId: string,
    text: string | undefined,
    media: MediaAttachment[] | undefined,
    quotedMessageId: string,
  ): Promise<Message[]>;

  setAdmin(groupId: string, requesterId: string, targetUserId: string, isAdmin: boolean): Promise<Conversation>;

  transferOwner(groupId: string, requesterId: string, newOwnerId: string): Promise<Conversation>;

  createPoll(
    conversationId: string,
    creatorId: string,
    question: string,
    options: string[],
    isMultipleChoice?: boolean,
    allowAddOption?: boolean,
    expiresAt?: string,
  ): Promise<Poll>;

  getPolls(conversationId: string): Promise<Poll[]>;

  votePoll(pollId: string, userId: string, optionIds: string[]): Promise<Poll>;

  getPollResults(pollId: string): Promise<Poll>;

  getPendingMembers(groupId: string): Promise<ConversationMember[]>;

  approveMember(groupId: string, userId: string, requesterId: string): Promise<ConversationMember>;

  rejectMember(groupId: string, userId: string, requesterId: string): Promise<void>;

  updateGroupSettings(
    groupId: string,
    requesterId: string,
    settings: { allowSendLink?: boolean; requireApproval?: boolean; allowMemberInvite?: boolean },
  ): Promise<Conversation>;

  getGroupInfo(groupId: string, userId: string): Promise<{
    conversation: Conversation;
    members: ConversationMember[];
    currentUserRole: ConversationMemberRole;
    settings: GroupSettings;
  }>;

  getConversationMedia(
    conversationId: string,
    userId: string,
    cursor: string | undefined,
    limit: number,
    type: "all" | "image" | "file" | "link",
  ): Promise<{
    images: any[];
    files: any[];
    links: any[];
    nextCursor: string;
    hasMore: boolean;
  }>;

  getConversationsCursor(
    userId: string,
    cursor?: string,
    limit?: number,
  ): Promise<{
    pinned: Array<Conversation & { unreadCount: number; role: ConversationMemberRole; pinnedAt?: Date }> | null;
    data: Array<Conversation & { unreadCount: number; role: ConversationMemberRole }>;
    nextCursor?: string;
    hasMore: boolean;
  }>;

  dissolveGroup(groupId: string, requesterId: string): Promise<void>;
}
