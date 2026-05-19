import "module-alias/register";

import axios, { AxiosInstance } from "axios";
import express, { NextFunction, Request, Response } from "express";
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { Server as SocketIOServer } from "socket.io";
import { io as createSocketClient, Socket as ClientSocket } from "socket.io-client";
import { v7 } from "uuid";

import { jwtProvider } from "@share/component/jwt";
import { responseFormatMiddleware } from "@share/middleware";
import { MessagingHttpService, MessagingSocketService } from "@modules/chat/infras";
import { ChatV2Controller } from "@modules/chat/infras/transport/http/v2-chat-controller";
import { setupChatV2Routes } from "@modules/chat/infras/transport/http/v2-chat.routes";
import {
  AddReactionHandler,
  DeleteMessageForEveryoneHandler,
  DeleteMessageForMeHandler,
  EditMessageHandler,
  ForwardMessagesHandler,
  GetReactionsHandler,
  GetConversationDetailQueryHandler,
  GetConversationMembersQueryHandler,
  GetPinnedMessagesHandler,
  LoadMessagesQueryHandler,
  MarkAsDeliveredHandler,
  MarkAsSeenHandler,
  PinMessageHandler,
  QuoteMessageHandler,
  RemoveAllReactionsHandler,
  RemoveReactionHandler,
  RevokeMessageHandler,
  SendGroupMessageHandler,
  SendMessageHandler,
  UnpinMessageHandler,
} from "@modules/chat/usecase";
import {
  ClassificationType,
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageReaction,
  MessageStatus,
  MessageType,
  UserInfo,
  UserStatus,
} from "@modules/chat/model";
import { MessageClassification } from "@modules/chat/model/model";
import { FriendshipStatus } from "@modules/friendships/model/model";

type EventRecord = {
  target: "user" | "group";
  targetId: string;
  event: string;
  data: any;
};

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

function cloneDate(value: Date | undefined | null): Date | undefined | null {
  if (value === undefined || value === null) return value;
  return new Date(value);
}

function cloneMessage(message: Message): Message {
  return {
    ...message,
    media: message.media ? message.media.map((item) => ({ ...item })) : undefined,
    links: message.links ? [...message.links] : undefined,
    deletedForUserIds: message.deletedForUserIds ? [...message.deletedForUserIds] : undefined,
    readBy: message.readBy
      ? message.readBy.map((item) => ({ ...item, readAt: new Date(item.readAt) }))
      : undefined,
    reactions: message.reactions ? message.reactions.map((item) => ({ ...item })) : undefined,
    createdAt: new Date(message.createdAt),
    editedAt: cloneDate(message.editedAt) as Date | undefined,
    deletedAt: cloneDate(message.deletedAt) as Date | undefined,
    revokedAt: cloneDate(message.revokedAt) as Date | undefined,
    expiresAt: cloneDate(message.expiresAt) as Date | undefined,
    pinnedAt: cloneDate(message.pinnedAt) as Date | undefined,
  };
}

function cloneMember(member: ConversationMember): ConversationMember {
  return {
    ...member,
    joinedAt: new Date(member.joinedAt),
    leftAt: cloneDate(member.leftAt) as Date | undefined,
    lastReadAt: cloneDate(member.lastReadAt) as Date | undefined,
    lastSeenAt: cloneDate(member.lastSeenAt) as Date | undefined,
    lastDeliveredAt: cloneDate(member.lastDeliveredAt) as Date | undefined,
    lastActivityAt: cloneDate(member.lastActivityAt) as Date | undefined,
    muteUntil: cloneDate(member.muteUntil) as Date | undefined,
    pinnedAt: cloneDate(member.pinnedAt) as Date | undefined,
    hiddenAt: cloneDate(member.hiddenAt) as Date | undefined,
    hiddenUserIds: member.hiddenUserIds ? [...member.hiddenUserIds] : [],
  };
}

function cloneConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    admins: conversation.admins ? [...conversation.admins] : undefined,
    settings: conversation.settings ? { ...conversation.settings } : undefined,
    lastMessage: conversation.lastMessage
      ? { ...conversation.lastMessage, createdAt: new Date(conversation.lastMessage.createdAt) }
      : undefined,
    lastMessageAt: cloneDate(conversation.lastMessageAt) as Date | undefined,
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
  };
}

function matchesCond<T extends Record<string, any>>(item: T, cond: Record<string, any>): boolean {
  return Object.entries(cond).every(([key, value]) => value === undefined || item[key] === value);
}

export class ChatE2EStore {
  readonly users = new Map<string, UserInfo>();
  readonly conversations = new Map<string, Conversation>();
  readonly members = new Map<string, ConversationMember>();
  readonly messages = new Map<string, Message>();
  readonly reactions = new Map<string, MessageReaction>();
  readonly classifications: MessageClassification[] = [];
  readonly friendships = new Set<string>();
  readonly blocks = new Set<string>();

  addUser(data: Partial<UserInfo> & { id?: string } = {}): UserInfo {
    const user: UserInfo = {
      id: data.id || v7(),
      displayName: data.displayName || `User ${this.users.size + 1}`,
      avatarUrl: data.avatarUrl,
      status: data.status || UserStatus.ACTIVE,
    };
    this.users.set(user.id, user);
    return user;
  }

  addFriendship(userA: string, userB: string): void {
    this.friendships.add(this.friendshipKey(userA, userB));
  }

  addConversation(data: Partial<Conversation> & { id?: string; type?: ConversationType }): Conversation {
    const now = new Date();
    const conversation: Conversation = {
      id: data.id || v7(),
      type: data.type || ConversationType.GROUP,
      pairKey: data.pairKey,
      name: data.name,
      avatarUrl: data.avatarUrl,
      createdBy: data.createdBy,
      ownerId: data.ownerId,
      admins: data.admins ? [...data.admins] : undefined,
      membersCount: data.membersCount || 0,
      settings: data.settings || {
        allowSendLink: true,
        requireApproval: false,
        allowMemberInvite: true,
        whoCanSendMessages: "all",
      },
      lastMessage: data.lastMessage,
      lastMessageAt: data.lastMessageAt,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  addMember(data: {
    conversationId: string;
    userId: string;
    role?: ConversationMemberRole;
    status?: ConversationMemberStatus;
    joinedAt?: Date;
    leftAt?: Date;
  } & Partial<ConversationMember>): ConversationMember {
    const now = new Date();
    const member: ConversationMember = {
      id: data.id || v7(),
      conversationId: data.conversationId,
      userId: data.userId,
      role: data.role || ConversationMemberRole.MEMBER,
      status: data.status || ConversationMemberStatus.ACTIVE,
      joinedAt: data.joinedAt || now,
      leftAt: data.leftAt,
      unreadCount: data.unreadCount || 0,
      lastReadMessageId: data.lastReadMessageId,
      lastReadAt: data.lastReadAt,
      lastSeenMessageId: data.lastSeenMessageId,
      lastDeliveredMessageId: data.lastDeliveredMessageId,
      lastSeenAt: data.lastSeenAt,
      lastDeliveredAt: data.lastDeliveredAt,
      lastActivityAt: data.lastActivityAt,
      muteUntil: data.muteUntil,
      pinned: data.pinned || false,
      pinnedAt: data.pinnedAt,
      archived: data.archived || false,
      hiddenUserIds: data.hiddenUserIds || [],
      hidden: data.hidden,
      hiddenAt: data.hiddenAt,
      hiddenPinHash: data.hiddenPinHash,
      updatedAt: data.updatedAt || now,
    };
    this.members.set(member.id, member);
    const conversation = this.conversations.get(data.conversationId);
    if (conversation) {
      conversation.membersCount = this.activeMembers(data.conversationId).length;
      conversation.updatedAt = now;
    }
    return member;
  }

  addMessage(data: Partial<Message> & {
    conversationId: string;
    senderId: string;
    type?: MessageType;
  }): Message {
    const message: Message = {
      id: data.id || v7(),
      conversationId: data.conversationId,
      senderId: data.senderId,
      type: data.type || MessageType.TEXT,
      text: data.text,
      media: data.media,
      links: data.links,
      call: data.call,
      profileCardUserId: data.profileCardUserId,
      messageStatus: data.messageStatus || MessageStatus.ACTIVE,
      deletedBy: data.deletedBy,
      revokedAt: data.revokedAt,
      deletedAt: data.deletedAt,
      deletedForUserIds: data.deletedForUserIds,
      quotedMessageId: data.quotedMessageId,
      quotedMessagePreview: data.quotedMessagePreview,
      forwardedFrom: data.forwardedFrom,
      forwardedFromMessageId: data.forwardedFromMessageId,
      mentions: data.mentions,
      createdAt: data.createdAt || new Date(),
      editedAt: data.editedAt,
      expiresAt: data.expiresAt,
      expireAtEpoch: data.expireAtEpoch,
      pinned: data.pinned || false,
      pinnedAt: data.pinnedAt,
      readBy: data.readBy,
      reactions: data.reactions,
    };
    this.messages.set(message.id, message);
    return message;
  }

  getMember(conversationId: string, userId: string): ConversationMember | undefined {
    return Array.from(this.members.values()).find(
      (member) => member.conversationId === conversationId && member.userId === userId,
    );
  }

  getMessage(id: string): Message | undefined {
    return this.messages.get(id);
  }

  visibleMessages(conversationId: string, viewerUserId?: string): Message[] {
    const nowEpoch = Math.floor(Date.now() / 1000);
    return Array.from(this.messages.values())
      .filter((message) => message.conversationId === conversationId)
      .filter((message) => !message.expireAtEpoch || message.expireAtEpoch > nowEpoch)
      .filter((message) => !viewerUserId || !message.deletedForUserIds?.includes(viewerUserId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  activeMembers(conversationId: string): ConversationMember[] {
    return Array.from(this.members.values()).filter(
      (member) =>
        member.conversationId === conversationId &&
        member.status === ConversationMemberStatus.ACTIVE &&
        !member.leftAt,
    );
  }

  expireMessage(messageId: string): void {
    const message = this.messages.get(messageId);
    if (!message) return;
    message.expiresAt = new Date(Date.now() - 1000);
    message.expireAtEpoch = Math.floor(message.expiresAt.getTime() / 1000);
  }

  friendshipKey(userA: string, userB: string): string {
    return [userA, userB].sort().join("#");
  }
}

class InMemoryUserRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async get(id: string): Promise<UserInfo | null> {
    return this.store.users.get(id) || null;
  }

  async findByCond(cond: Partial<UserInfo>): Promise<UserInfo | null> {
    return Array.from(this.store.users.values()).find((user) => matchesCond(user, cond)) || null;
  }

  async findByIds(ids: string[]): Promise<UserInfo[]> {
    return ids.map((id) => this.store.users.get(id)).filter(isDefined);
  }
}

class InMemoryConversationRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async get(id: string): Promise<Conversation | null> {
    const conversation = this.store.conversations.get(id);
    return conversation ? cloneConversation(conversation) : null;
  }

  async findByCond(cond: Partial<Conversation>): Promise<Conversation | null> {
    const conversation = Array.from(this.store.conversations.values()).find((item) => matchesCond(item, cond));
    return conversation ? cloneConversation(conversation) : null;
  }

  async findByPairKey(pairKey: string, type?: ConversationType): Promise<Conversation | null> {
    const conversation = Array.from(this.store.conversations.values()).find(
      (item) => item.pairKey === pairKey && (!type || item.type === type),
    );
    return conversation ? cloneConversation(conversation) : null;
  }

  async list(cond: Partial<Conversation>): Promise<Conversation[]> {
    return Array.from(this.store.conversations.values())
      .filter((item) => matchesCond(item, cond))
      .map(cloneConversation);
  }

  async listByIds(ids: string[]): Promise<Conversation[]> {
    return ids.map((id) => this.store.conversations.get(id)).filter(isDefined).map(cloneConversation);
  }

  async insert(conversation: Conversation): Promise<boolean> {
    this.store.conversations.set(conversation.id, cloneConversation(conversation));
    return true;
  }

  async update(id: string, data: Partial<Conversation>): Promise<boolean> {
    const conversation = this.store.conversations.get(id);
    if (!conversation) return false;
    Object.assign(conversation, data, { updatedAt: new Date() });
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.conversations.delete(id);
  }
}

class InMemoryConversationMemberRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async get(id: string): Promise<ConversationMember | null> {
    const member = this.store.members.get(id);
    return member ? cloneMember(member) : null;
  }

  async findByCond(cond: Partial<ConversationMember>): Promise<ConversationMember | null> {
    const member = Array.from(this.store.members.values()).find((item) => matchesCond(item, cond));
    return member ? cloneMember(member) : null;
  }

  async list(cond: Partial<ConversationMember>): Promise<ConversationMember[]> {
    return Array.from(this.store.members.values())
      .filter((item) => matchesCond(item, cond))
      .map(cloneMember);
  }

  async listByConversationId(conversationId: string): Promise<ConversationMember[]> {
    return this.list({ conversationId });
  }

  async listByUserIdCursor(userId: string): Promise<{
    pinnedMembers: ConversationMember[];
    normalMembers: ConversationMember[];
    hasMore: boolean;
  }> {
    const members = await this.list({ userId });
    return {
      pinnedMembers: members.filter((member) => member.pinned),
      normalMembers: members.filter((member) => !member.pinned),
      hasMore: false,
    };
  }

  async insert(member: ConversationMember): Promise<boolean> {
    this.store.members.set(member.id, cloneMember(member));
    return true;
  }

  async update(id: string, data: Partial<ConversationMember>): Promise<boolean> {
    const member = this.store.members.get(id);
    if (!member) return false;
    const normalized = { ...data } as Record<string, any>;
    for (const key of ["leftAt", "hiddenAt", "hiddenPinHash"] as const) {
      if (normalized[key] === null) normalized[key] = undefined;
    }
    Object.assign(member, normalized, { updatedAt: new Date() });
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.members.delete(id);
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    for (const member of Array.from(this.store.members.values())) {
      if (member.conversationId === conversationId) this.store.members.delete(member.id);
    }
  }

  async incrementUnreadCountForConversation(conversationId: string, excludeUserId?: string): Promise<void> {
    for (const member of this.store.activeMembers(conversationId)) {
      if (member.userId !== excludeUserId) {
        member.unreadCount = (member.unreadCount || 0) + 1;
        member.lastActivityAt = new Date();
      }
    }
  }

  async touchActivityForConversation(conversationId: string, activityAt = new Date()): Promise<void> {
    for (const member of this.store.activeMembers(conversationId)) {
      member.lastActivityAt = activityAt;
      member.updatedAt = activityAt;
    }
  }
}

class InMemoryMessageRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async get(id: string): Promise<Message | null> {
    const message = this.store.messages.get(id);
    return message ? cloneMessage(message) : null;
  }

  async findByCond(cond: Partial<Message>): Promise<Message | null> {
    const message = Array.from(this.store.messages.values()).find((item) => matchesCond(item, cond));
    return message ? cloneMessage(message) : null;
  }

  async list(cond: Partial<Message>): Promise<Message[]> {
    return Array.from(this.store.messages.values())
      .filter((item) => matchesCond(item, cond))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(cloneMessage);
  }

  async listWithCursor(
    conversationId: string,
    cursor: string | undefined,
    limit: number,
    viewerUserId?: string,
  ): Promise<Message[]> {
    let messages = this.store.visibleMessages(conversationId, viewerUserId);
    if (cursor) {
      const cursorIndex = messages.findIndex((message) => message.id === cursor);
      if (cursorIndex >= 0) messages = messages.slice(cursorIndex + 1);
    }
    return messages.slice(0, limit).map(cloneMessage);
  }

  async findPinnedMessages(conversationId: string): Promise<Message[]> {
    return this.store.visibleMessages(conversationId)
      .filter(
        (message) =>
          message.pinned &&
          message.messageStatus !== MessageStatus.REVOKED &&
          !message.deletedAt,
      )
      .reverse()
      .map(cloneMessage);
  }

  async searchMessages(
    conversationId: string,
    userId: string,
    query: string,
    cursor?: string,
    limit = 20,
  ): Promise<{ messages: Message[]; nextCursor?: string; hasMore: boolean; total: number }> {
    const needle = query.toLowerCase();
    let messages = this.store.visibleMessages(conversationId, userId)
      .filter(
        (message) =>
          message.messageStatus !== MessageStatus.REVOKED &&
          !message.deletedAt &&
          (message.text || "").toLowerCase().includes(needle),
      );
    if (cursor) {
      const cursorIndex = messages.findIndex((message) => message.id === cursor);
      if (cursorIndex >= 0) messages = messages.slice(cursorIndex + 1);
    }
    const page = messages.slice(0, limit + 1);
    const hasMore = page.length > limit;
    const results = hasMore ? page.slice(0, limit) : page;
    return {
      messages: results.map(cloneMessage),
      nextCursor: hasMore && results.length > 0 ? results[results.length - 1].id : undefined,
      hasMore,
      total: messages.length,
    };
  }

  async insert(message: Message): Promise<boolean> {
    this.store.messages.set(message.id, cloneMessage(message));
    return true;
  }

  async batchInsert(messages: Message[]): Promise<boolean> {
    for (const message of messages) {
      await this.insert(message);
    }
    return true;
  }

  async update(id: string, data: Partial<Message>): Promise<boolean> {
    const message = this.store.messages.get(id);
    if (!message) return false;
    Object.assign(message, data);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.messages.delete(id);
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    for (const message of Array.from(this.store.messages.values())) {
      if (message.conversationId === conversationId) this.store.messages.delete(message.id);
    }
  }
}

class InMemoryReactionRepository {
  constructor(private readonly store: ChatE2EStore) {}

  key(messageId: string, userId: string, emoji: string): string {
    return `${messageId}#${userId}#${emoji}`;
  }

  async get(id: string): Promise<MessageReaction | null> {
    return this.store.reactions.get(id) || null;
  }

  async findByMessageId(messageId: string): Promise<MessageReaction[]> {
    return Array.from(this.store.reactions.values())
      .filter((reaction) => reaction.messageId === messageId)
      .map((reaction) => ({ ...reaction }));
  }

  async findByUserAndMessage(messageId: string, userId: string): Promise<MessageReaction[]> {
    return Array.from(this.store.reactions.values())
      .filter((reaction) => reaction.messageId === messageId && reaction.userId === userId)
      .map((reaction) => ({ ...reaction }));
  }

  async findByUserMessageEmoji(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<MessageReaction | null> {
    return this.store.reactions.get(this.key(messageId, userId, emoji)) || null;
  }

  async getReactionSummary(messageId: string): Promise<Record<string, number>> {
    const summary: Record<string, number> = {};
    for (const reaction of await this.findByMessageId(messageId)) {
      summary[reaction.emoji] = (summary[reaction.emoji] || 0) + (reaction.count || 1);
    }
    return summary;
  }

  async upsertReaction(reaction: MessageReaction): Promise<MessageReaction> {
    const normalized = {
      ...reaction,
      id: this.key(reaction.messageId, reaction.userId, reaction.emoji),
      count: reaction.count || 1,
      createdAt: reaction.createdAt || new Date(),
    };
    this.store.reactions.set(normalized.id, normalized);
    return { ...normalized };
  }

  async decrementReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    return this.store.reactions.delete(this.key(messageId, userId, emoji));
  }

  async decrementAllByUserAndMessage(messageId: string, userId: string): Promise<number> {
    const reactions = await this.findByUserAndMessage(messageId, userId);
    for (const reaction of reactions) {
      this.store.reactions.delete(this.key(messageId, userId, reaction.emoji));
    }
    return reactions.length;
  }

  async deleteAllByUserAndMessage(messageId: string, userId: string): Promise<number> {
    return this.decrementAllByUserAndMessage(messageId, userId);
  }

  async deleteByMessageId(messageId: string): Promise<void> {
    for (const reaction of await this.findByMessageId(messageId)) {
      this.store.reactions.delete(this.key(messageId, reaction.userId, reaction.emoji));
    }
  }

  async deleteByConversationId(): Promise<void> {
    this.store.reactions.clear();
  }
}

class InMemoryClassificationRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async insertBatch(classifications: MessageClassification[]): Promise<void> {
    this.store.classifications.push(...classifications.map((item) => ({ ...item })));
  }

  async deleteByMessageId(messageId: string): Promise<void> {
    for (let i = this.store.classifications.length - 1; i >= 0; i--) {
      if (this.store.classifications[i].messageId === messageId) {
        this.store.classifications.splice(i, 1);
      }
    }
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    for (let i = this.store.classifications.length - 1; i >= 0; i--) {
      if (this.store.classifications[i].conversationId === conversationId) {
        this.store.classifications.splice(i, 1);
      }
    }
  }

  async listByConversationAndType(
    conversationId: string,
    type: ClassificationType,
  ): Promise<{ items: MessageClassification[]; nextCursor: string; hasMore: boolean }> {
    return {
      items: this.store.classifications.filter(
        (item) => item.conversationId === conversationId && item.type === type,
      ),
      nextCursor: "",
      hasMore: false,
    };
  }

  async listByConversation(
    conversationId: string,
  ): Promise<{ items: MessageClassification[]; nextCursor: string; hasMore: boolean }> {
    return {
      items: this.store.classifications.filter((item) => item.conversationId === conversationId),
      nextCursor: "",
      hasMore: false,
    };
  }
}

class InMemoryFriendshipRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async findByCond(cond: { userA?: string; userB?: string }): Promise<{ status: FriendshipStatus } | null> {
    if (!cond.userA || !cond.userB) return null;
    return this.store.friendships.has(this.store.friendshipKey(cond.userA, cond.userB))
      ? { status: FriendshipStatus.ACTIVE }
      : null;
  }
}

class InMemoryBlockRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async findByCond(cond: { blockerId?: string; blockedUserId?: string }): Promise<{ id: string } | null> {
    if (!cond.blockerId || !cond.blockedUserId) return null;
    return this.store.blocks.has(`${cond.blockerId}#${cond.blockedUserId}`) ? { id: v7() } : null;
  }
}

class TestPresenceUseCase {
  async registerSocket(): Promise<{ becameOnline: boolean }> {
    return { becameOnline: false };
  }

  async unregisterSocket(): Promise<{ becameOffline: boolean }> {
    return { becameOffline: false };
  }

  async touchSocket(): Promise<void> {}

  async getUserPresence(): Promise<{ isOnline: boolean; lastSeen: Date | null }> {
    return { isOnline: false, lastSeen: null };
  }
}

class RecordingMessagingSocketService extends MessagingSocketService {
  readonly emitted: EventRecord[] = [];

  public emitToUser(userId: string, event: string, data: any) {
    this.emitted.push({ target: "user", targetId: userId, event, data });
    super.emitToUser(userId, event, data);
  }

  public emitToGroupRoom(conversationId: string, event: string, data: any) {
    this.emitted.push({ target: "group", targetId: conversationId, event, data });
    super.emitToGroupRoom(conversationId, event, data);
  }
}

function buildUseCase(store: ChatE2EStore) {
  const userRepo = new InMemoryUserRepository(store);
  const conversationRepo = new InMemoryConversationRepository(store);
  const memberRepo = new InMemoryConversationMemberRepository(store);
  const messageRepo = new InMemoryMessageRepository(store);
  const reactionRepo = new InMemoryReactionRepository(store);
  const classificationRepo = new InMemoryClassificationRepository(store);
  const accessPolicy = {
    assertNotBlockedBetween: async () => undefined,
    validateAddGroupMembers: async (_requesterId: string, memberIds: string[]) => memberIds,
  };

  const getConversationDetail = new GetConversationDetailQueryHandler(conversationRepo as any, memberRepo as any);
  const getConversationMembers = new GetConversationMembersQueryHandler(memberRepo as any);
  const sendMessage = new SendMessageHandler(
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    conversationRepo as any,
    conversationRepo as any,
    classificationRepo as any,
    accessPolicy as any,
  );
  const sendGroupMessage = new SendGroupMessageHandler(
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    conversationRepo as any,
    conversationRepo as any,
    classificationRepo as any,
  );
  const loadMessages = new LoadMessagesQueryHandler(
    memberRepo as any,
    messageRepo as any,
    reactionRepo as any,
    userRepo as any,
  );
  const markAsSeen = new MarkAsSeenHandler(memberRepo as any, memberRepo as any, messageRepo as any);
  const markAsDelivered = new MarkAsDeliveredHandler(memberRepo as any, memberRepo as any, messageRepo as any);
  const revokeMessage = new RevokeMessageHandler(
    messageRepo as any,
    messageRepo as any,
    memberRepo as any,
    classificationRepo as any,
    conversationRepo as any,
    conversationRepo as any,
  );
  const deleteMessageForMe = new DeleteMessageForMeHandler(messageRepo as any, messageRepo as any, memberRepo as any);
  const deleteMessageForEveryone = new DeleteMessageForEveryoneHandler(
    messageRepo as any,
    messageRepo as any,
    memberRepo as any,
    classificationRepo as any,
    conversationRepo as any,
    conversationRepo as any,
  );
  const editMessage = new EditMessageHandler(messageRepo as any, messageRepo as any, memberRepo as any);
  const forwardMessages = new ForwardMessagesHandler(
    conversationRepo as any,
    conversationRepo as any,
    memberRepo as any,
    memberRepo as any,
    messageRepo as any,
    messageRepo as any,
    classificationRepo as any,
  );
  const pinMessage = new PinMessageHandler(
    messageRepo as any,
    messageRepo as any,
    memberRepo as any,
    memberRepo as any,
    conversationRepo as any,
    conversationRepo as any,
    userRepo as any,
  );
  const unpinMessage = new UnpinMessageHandler(
    messageRepo as any,
    messageRepo as any,
    memberRepo as any,
    memberRepo as any,
    conversationRepo as any,
    conversationRepo as any,
    userRepo as any,
  );
  const getPinnedMessages = new GetPinnedMessagesHandler(messageRepo as any, memberRepo as any);
  const addReaction = new AddReactionHandler(
    messageRepo as any,
    reactionRepo as any,
    reactionRepo as any,
    memberRepo as any,
    userRepo as any,
  );
  const removeReaction = new RemoveReactionHandler(messageRepo as any, reactionRepo as any, memberRepo as any);
  const removeAllReactions = new RemoveAllReactionsHandler(messageRepo as any, reactionRepo as any, memberRepo as any);
  const getReactions = new GetReactionsHandler(
    messageRepo as any,
    reactionRepo as any,
    memberRepo as any,
    userRepo as any,
  );
  const quoteMessage = new QuoteMessageHandler(
    messageRepo as any,
    messageRepo as any,
    memberRepo as any,
    conversationRepo as any,
    classificationRepo as any,
  );

  return {
    repos: {
      userRepo,
      conversationRepo,
      memberRepo,
      messageRepo,
      reactionRepo,
      classificationRepo,
      friendshipRepo: new InMemoryFriendshipRepository(store),
      blockRepo: new InMemoryBlockRepository(store),
    },
    useCase: {
      getConversationDetail: (conversationId: string, userId: string) =>
        getConversationDetail.query({ conversationId, userId }),
      getConversationMembers: (conversationId: string, excludeUserId?: string) =>
        getConversationMembers.query({ conversationId, excludeUserId }),
      sendMessage: (
        conversationId: string,
        senderId: string,
        text?: string,
        media?: any[],
        ttlSeconds?: number,
      ) => sendMessage.execute({ conversationId, senderId, text, media, ttlSeconds }),
      sendGroupMessage: (
        conversationId: string,
        senderId: string,
        text?: string,
        media?: any[],
        ttlSeconds?: number,
      ) => sendGroupMessage.execute({ conversationId, senderId, text, media, ttlSeconds }),
      loadMessages: (conversationId: string, userId: string, cursor: string | undefined, limit: number) =>
        loadMessages.query({ conversationId, userId, cursor, limit }),
      markAsSeen: (conversationId: string, userId: string, lastSeenMessageId: string) =>
        markAsSeen.execute({ conversationId, userId, lastSeenMessageId }),
      markAsDelivered: (conversationId: string, userId: string, lastDeliveredMessageId: string) =>
        markAsDelivered.execute({ conversationId, userId, lastDeliveredMessageId }),
      revokeMessage: (messageId: string, userId: string) => revokeMessage.execute({ messageId, userId }),
      deleteMessageForMe: (messageId: string, userId: string) =>
        deleteMessageForMe.execute({ messageId, userId }),
      deleteMessageForEveryone: (messageId: string, userId: string) =>
        deleteMessageForEveryone.execute({ messageId, userId }),
      editMessage: (messageId: string, userId: string, text: string, timeLimitMs?: number) =>
        editMessage.execute({ messageId, userId, text, timeLimitMs }),
      forwardMessages: (userId: string, messageIds: string[], targetConversationIds: string[]) =>
        forwardMessages.execute({ userId, messageIds, targetConversationIds }),
      pinMessage: (messageId: string, userId: string) => pinMessage.execute({ messageId, userId }),
      unpinMessage: (messageId: string, userId: string) => unpinMessage.execute({ messageId, userId }),
      getPinnedMessages: (conversationId: string, userId: string) =>
        getPinnedMessages.query({ conversationId, userId }),
      addReaction: (messageId: string, userId: string, emoji: string) =>
        addReaction.execute({ messageId, userId, emoji }),
      removeReaction: (messageId: string, userId: string, emoji?: string) =>
        removeReaction.execute(messageId, userId, emoji),
      removeAllReactions: (messageId: string, userId: string) =>
        removeAllReactions.execute(messageId, userId),
      getReactions: (messageId: string, userId: string) => getReactions.execute(messageId, userId),
      quoteMessage: (
        conversationId: string,
        senderId: string,
        text: string | undefined,
        media: any[] | undefined,
        quotedMessageId: string,
      ) => quoteMessage.execute({ conversationId, senderId, text, media, quotedMessageId }),
      getMessage: (messageId: string) => messageRepo.get(messageId),
      searchMessages: (conversationId: string, userId: string, query: string, cursor?: string, limit?: number) =>
        messageRepo.searchMessages(conversationId, userId, query, cursor, limit),
    },
  };
}

function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token?.startsWith("user:")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.requester = { sub: token.slice("user:".length) };
  next();
}

export function bearer(userId: string): string {
  return `Bearer user:${userId}`;
}

export function socketToken(userId: string): string {
  return `user:${userId}`;
}

export async function emitWithAck<T = any>(
  socket: ClientSocket,
  event: string,
  payload: any,
  timeoutMs = 1000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event} ack`)), timeoutMs);
    socket.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

export async function waitForSocketEvent<T = any>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 1000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for socket event ${event}`));
    }, timeoutMs);
    const onEvent = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}

export type ChatE2EHarness = {
  api: AxiosInstance;
  store: ChatE2EStore;
  socketEvents: EventRecord[];
  connectMessagesSocket: (userId: string) => Promise<ClientSocket>;
  close: () => Promise<void>;
};

export async function createChatE2EHarness(): Promise<ChatE2EHarness> {
  const store = new ChatE2EStore();
  const { repos, useCase } = buildUseCase(store);
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: "*" } });
  const presenceUseCase = new TestPresenceUseCase();
  const socketService = new RecordingMessagingSocketService(io, useCase as any, presenceUseCase as any);
  const httpService = new MessagingHttpService(useCase as any);
  httpService.setSocketService(socketService);

  const mdlFactory = { auth, allowRoles: () => (_req: Request, _res: Response, next: NextFunction) => next(), upload: {} };
  const v2Controller = new ChatV2Controller(
    useCase as any,
    repos.conversationRepo as any,
    repos.memberRepo as any,
    repos.messageRepo as any,
    repos.friendshipRepo as any,
    repos.blockRepo as any,
    repos.userRepo as any,
    socketService,
    presenceUseCase as any,
  );

  app.use(express.json());
  app.use("/v1", responseFormatMiddleware);
  app.use("/v2", responseFormatMiddleware);

  const v1Router = express.Router();
  v1Router.get("/conversations/:conversationId/messages", auth, httpService.loadMessagesAPI.bind(httpService));
  v1Router.post("/conversations/:conversationId/delivered", auth, httpService.markAsDeliveredAPI.bind(httpService));
  v1Router.post("/conversations/:conversationId/seen", auth, httpService.markAsSeenAPI.bind(httpService));
  v1Router.post("/messages/:messageId/revoke", auth, httpService.revokeMessageAPI.bind(httpService));
  v1Router.post("/messages/:messageId/delete", auth, httpService.deleteMessageForMeAPI.bind(httpService));
  v1Router.post(
    "/messages/:messageId/delete-for-everyone",
    auth,
    httpService.deleteMessageForEveryoneAPI.bind(httpService),
  );
  v1Router.post("/messages/forward", auth, httpService.forwardMessagesAPI.bind(httpService));
  v1Router.post("/messages/:messageId/pin", auth, httpService.pinMessageAPI.bind(httpService));
  v1Router.delete("/messages/:messageId/pin", auth, httpService.unpinMessageAPI.bind(httpService));
  v1Router.get(
    "/conversations/:conversationId/pinned-messages",
    auth,
    httpService.getPinnedMessagesAPI.bind(httpService),
  );
  v1Router.post("/messages/:messageId/react", auth, httpService.addReactionAPI.bind(httpService));
  v1Router.delete("/messages/:messageId/react", auth, httpService.removeReactionAPI.bind(httpService));
  v1Router.get("/messages/:messageId/reactions", auth, httpService.getReactionsAPI.bind(httpService));
  v1Router.post("/messages/:messageId/quote", auth, httpService.quoteMessageAPI.bind(httpService));
  v1Router.get("/conversations/:conversationId/search", auth, httpService.searchMessagesAPI.bind(httpService));

  app.use("/v1", v1Router);
  app.use("/v2", setupChatV2Routes(v2Controller, mdlFactory as any));

  const jwtSpy = jest.spyOn(jwtProvider, "verifyToken").mockImplementation(async (token: string) => {
    const normalized = token.replace(/^Bearer\s+/i, "");
    if (!normalized.startsWith("user:")) return null;
    return { sub: normalized.slice("user:".length) } as any;
  });

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const { port } = httpServer.address() as AddressInfo;
  const baseURL = `http://127.0.0.1:${port}`;
  const clients: ClientSocket[] = [];
  const api = axios.create({
    baseURL,
    validateStatus: () => true,
    proxy: false,
  });

  return {
    api,
    store,
    socketEvents: socketService.emitted,
    connectMessagesSocket: async (userId: string) => {
      const socket = createSocketClient(`${baseURL}/messages`, {
        auth: { token: socketToken(userId) },
        transports: ["websocket"],
        forceNew: true,
      });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out connecting messages socket")), 1000);
        socket.once("connect", () => {
          clearTimeout(timer);
          resolve();
        });
        socket.once("connect_error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      return socket;
    },
    close: async () => {
      for (const client of clients) {
        client.disconnect();
      }
      jwtSpy.mockRestore();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    },
  };
}

export function seedPrivateConversation(
  store: ChatE2EStore,
  userA = store.addUser({ displayName: "Alice" }),
  userB = store.addUser({ displayName: "Bob" }),
) {
  store.addFriendship(userA.id, userB.id);
  const conversation = store.addConversation({
    type: ConversationType.PRIVATE,
    pairKey: [userA.id, userB.id].sort().join("_"),
    membersCount: 2,
  });
  store.addMember({ conversationId: conversation.id, userId: userA.id });
  store.addMember({ conversationId: conversation.id, userId: userB.id });
  return { userA, userB, conversation };
}

export function seedGroupConversation(store: ChatE2EStore, memberCount = 3) {
  const users = Array.from({ length: memberCount }, (_, index) =>
    store.addUser({ displayName: ["Owner", "Admin", "Member", "Extra"][index] || `User ${index + 1}` }),
  );
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      store.addFriendship(users[i].id, users[j].id);
    }
  }
  const conversation = store.addConversation({
    type: ConversationType.GROUP,
    name: "Team",
    createdBy: users[0].id,
    ownerId: users[0].id,
    admins: [users[0].id, users[1]?.id].filter(isDefined),
    membersCount: users.length,
  });
  users.forEach((user, index) => {
    store.addMember({
      conversationId: conversation.id,
      userId: user.id,
      role: index <= 1 ? ConversationMemberRole.ADMIN : ConversationMemberRole.MEMBER,
      joinedAt: new Date(Date.UTC(2026, 0, index + 1)),
    });
  });
  return {
    owner: users[0],
    admin: users[1],
    member: users[2],
    users,
    conversation,
  };
}

export function authHeader(userId: string) {
  return { Authorization: bearer(userId) };
}
