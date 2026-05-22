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
  GroupReminder,
  GroupNote,
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
  listByConversationId(conversationId: string): Promise<ConversationMember[]>;
}

export interface IConversationMemberCommandRepository {
  insert(member: ConversationMember): Promise<boolean>;
  update(id: string, data: ConversationMemberUpdateDTO): Promise<boolean>;
  delete(id: string, isHard: boolean): Promise<boolean>;
  deleteByConversationId(conversationId: string): Promise<void>;
  incrementUnreadCountForConversation(conversationId: string, excludeUserId?: string): Promise<void>;
  touchActivityForConversation(conversationId: string, activityAt?: Date): Promise<void>;
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
    options?: { from?: Date; to?: Date; hiddenAfter?: Date },
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
  deleteByConversationId(conversationId: string): Promise<void>;
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
  deleteByConversationId(conversationId: string): Promise<void>;
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
  deleteByConversationId(conversationId: string): Promise<void>;
}

export interface IGroupReminderQueryRepository {
  get(id: string): Promise<GroupReminder | null>;
  findByConversationId(conversationId: string): Promise<GroupReminder[]>;
}

export interface IGroupReminderCommandRepository {
  insert(reminder: GroupReminder): Promise<boolean>;
  update(id: string, data: Partial<GroupReminder>): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  deleteByConversationId(conversationId: string): Promise<void>;
}

export interface IGroupNoteQueryRepository {
  get(id: string): Promise<GroupNote | null>;
  findByConversationId(conversationId: string): Promise<GroupNote[]>;
}

export interface IGroupNoteCommandRepository {
  insert(note: GroupNote): Promise<boolean>;
  update(id: string, data: Partial<GroupNote>): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  deleteByConversationId(conversationId: string): Promise<void>;
}

export interface IMessageClassificationRepository {
  insertBatch(classifications: MessageClassification[]): Promise<void>;
  deleteByMessageId(messageId: string): Promise<void>;
  deleteByConversationId(conversationId: string): Promise<void>;
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
    ttlSeconds?: number,
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
    ttlSeconds?: number,
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

  leaveGroup(conversationId: string, userId: string, autoTransferOwner?: boolean): Promise<void>;

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

  editMessage(messageId: string, userId: string, text: string, timeLimitMs?: number): Promise<Message>;

  pinMessage(messageId: string, userId: string): Promise<Message>;

  unpinMessage(messageId: string, userId: string): Promise<Message>;

  getPinnedMessages(conversationId: string, userId: string): Promise<Message[]>;

  searchMessages(
    conversationId: string,
    userId: string,
    query: string,
    cursor?: string,
    limit?: number,
    options?: { from?: Date; to?: Date; contextLimit?: number },
  ): Promise<{
    messages: Message[];
    nextCursor?: string;
    hasMore: boolean;
    total: number;
  }>;

  addReaction(messageId: string, userId: string, emoji: string): Promise<MessageReaction>;

  removeReaction(messageId: string, userId: string, emoji?: string): Promise<number>;

  removeAllReactions(messageId: string, userId: string): Promise<number>;

  getReactions(messageId: string, userId: string): Promise<{
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
    showResultsBeforeClose?: boolean,
    expiresAt?: string,
  ): Promise<Poll>;

  getPolls(conversationId: string, userId: string): Promise<Poll[]>;

  votePoll(pollId: string, userId: string, optionIds: string[]): Promise<Poll>;

  getPollResults(pollId: string, userId: string): Promise<Poll>;

  closePoll(pollId: string, userId: string): Promise<Poll>;

  pinPoll(pollId: string, userId: string): Promise<Poll>;

  unpinPoll(pollId: string, userId: string): Promise<Poll>;

  getPendingMembers(groupId: string, requesterId: string): Promise<ConversationMember[]>;

  approveMember(groupId: string, userId: string, requesterId: string): Promise<ConversationMember>;

  rejectMember(groupId: string, userId: string, requesterId: string): Promise<void>;

  updateGroupSettings(
    groupId: string,
    requesterId: string,
    settings: {
      allowSendLink?: boolean;
      requireApproval?: boolean;
      allowMemberInvite?: boolean;
      whoCanSendMessages?: "all" | "admins";
      whoCanAddMembers?: "all" | "admins";
      utilityPermissions?: {
        poll?: "all" | "admins";
        reminder?: "all" | "admins";
        note?: "all" | "admins";
      };
    },
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
    type: "all" | "image" | "file" | "link" | "video" | "voice",
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

  dissolveGroup(groupId: string, requesterId: string): Promise<string[]>;

  getConversationStatistics(conversationId: string, userId: string): Promise<{
    messageCount: number;
    memberCount: number;
    activeMemberCount: number;
    lastActivity: Date | null;
    createdAt: Date;
  }>;

  getSharedConversations(userId: string, currentUserId: string): Promise<Conversation[]>;

  deleteMessagesBulk(
    conversationId: string,
    userId: string,
    before?: string,
    after?: string,
    messageIds?: string[],
  ): Promise<{ deletedCount: number }>;

  getConversationOnlineMembers(conversationId: string, userId: string): Promise<Array<{
    userId: string;
    isOnline: boolean;
    lastSeen: Date | null;
  }>>;

  getDrafts(conversationId: string, userId: string): Promise<{
    drafts: Array<{
      id: string;
      conversationId: string;
      userId: string;
      text: string;
      media: any[];
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;

  translateMessage(
    messageId: string,
    userId: string,
    targetLanguage?: string,
  ): Promise<{
    originalText: string;
    translatedText: string;
    detectedLanguage: string;
    targetLanguage: string;
  }>;

  copyConversation(
    conversationId: string,
    requesterId: string,
    targetUserId?: string,
    memberIds?: string[],
    before?: string,
    after?: string,
  ): Promise<{
    conversation: Conversation;
    messages: Message[];
  }>;

  createGroupReminder(
    conversationId: string,
    userId: string,
    title: string,
    description: string | undefined,
    remindAt: string,
  ): Promise<GroupReminder>;

  listGroupReminders(conversationId: string, userId: string): Promise<GroupReminder[]>;

  updateGroupReminder(
    reminderId: string,
    userId: string,
    data: { title?: string; description?: string | null; remindAt?: string; status?: GroupReminder["status"] },
  ): Promise<GroupReminder>;

  deleteGroupReminder(reminderId: string, userId: string): Promise<void>;

  createGroupNote(conversationId: string, userId: string, title: string, content: string): Promise<GroupNote>;

  listGroupNotes(conversationId: string, userId: string): Promise<GroupNote[]>;

  updateGroupNote(noteId: string, userId: string, data: { title?: string; content?: string }): Promise<GroupNote>;

  deleteGroupNote(noteId: string, userId: string): Promise<void>;
}
