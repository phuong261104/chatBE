import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  Message,
  UserInfo,
  MediaAttachment
} from '../model/model';
import {
  ConversationCondDTO,
  ConversationUpdateDTO,
  ConversationMemberCondDTO,
  ConversationMemberUpdateDTO,
  MessageCondDTO,
  MessageUpdateDTO,
  UserCondDTO
} from '../model/dto';
import { PagingDTO } from '@share/model/paging';

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

export interface IConversationMemberQueryRepository {
  get(id: string): Promise<ConversationMember | null>;
  findByCond(cond: ConversationMemberCondDTO): Promise<ConversationMember | null>;
  list(cond: ConversationMemberCondDTO, paging: PagingDTO): Promise<ConversationMember[]>;
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

  listWithCursor(conversationId: string, cursor: string | undefined, limit: number): Promise<Message[]>;
}

export interface IMessageCommandRepository {
  insert(message: Message): Promise<boolean>;
  update(id: string, data: MessageUpdateDTO): Promise<boolean>;
  delete(id: string, isHard: boolean): Promise<boolean>;
}

export interface CreateGroupData {
  name: string;
  memberIds: string[];
  avatarUrl?: string;
}

export interface IMessagingUseCase {
  getOrCreatePrivateConversation(currentUserId: string, targetUserId: string): Promise<Conversation>;

  sendMessage(conversationId: string, senderId: string, text?: string, media?: MediaAttachment[]): Promise<Message>;

  getConversationMembers(conversationId: string, excludeUserId?: string): Promise<string[]>;

  createGroup(
    creatorId: string,
    data: CreateGroupData
  ): Promise<{
    conversation: Conversation;
    members: ConversationMember[];
    systemMessage: Message;
  }>;

  sendGroupMessage(
    conversationId: string,
    senderId: string,
    text?: string,
    media?: MediaAttachment[]
  ): Promise<Message>;

  addMembersToGroup(conversationId: string, requesterId: string, memberIds: string[]): Promise<ConversationMember[]>;

  removeMemberFromGroup(conversationId: string, requesterId: string, targetUserId: string): Promise<void>;

  updateGroupInfo(
    conversationId: string,
    requesterId: string,
    data: { name?: string; avatarUrl?: string }
  ): Promise<Conversation>;

  getConversations(
    userId: string,
    page?: number,
    limit?: number
  ): Promise<Array<Conversation & { unreadCount: number; role: ConversationMemberRole }>>;

  getConversationDetail(
    conversationId: string,
    userId: string
  ): Promise<{
    conversation: Conversation;
    members: ConversationMember[];
    currentUserRole: ConversationMemberRole;
  }>;

  loadMessages(
    conversationId: string,
    userId: string,
    cursor: string | undefined,
    limit: number
  ): Promise<{
    messages: Message[];
    nextCursor: string;
    hasMore: boolean;
  }>;

  markAsSeen(conversationId: string, userId: string, lastSeenMessageId: string): Promise<void>;

  markAsDelivered(conversationId: string, userId: string, lastDeliveredMessageId: string): Promise<void>;

  getTotalUnreadCount(userId: string): Promise<number>;

  leaveGroup(conversationId: string, userId: string): Promise<void>;

  getGroupMembers(conversationId: string, userId: string): Promise<ConversationMember[]>;
}
