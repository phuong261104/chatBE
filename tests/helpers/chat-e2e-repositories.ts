import { v7 } from "uuid";

import {
  ClassificationType,
  Conversation,
  ConversationMember,
  ConversationMemberStatus,
  ConversationType,
  GroupNote,
  GroupReminder,
  Message,
  MessageReaction,
  MessageStatus,
  Poll,
  PollStatus,
  UserInfo,
} from "@modules/chat/model";
import { MessageClassification } from "@modules/chat/model/model";
import { FriendshipStatus } from "@modules/friendships/model/model";
import {
  ChatE2EStore,
  cloneConversation,
  cloneGroupNote,
  cloneGroupReminder,
  cloneMember,
  cloneMessage,
  clonePoll,
  isDefined,
  matchesCond,
} from "./chat-e2e-store";

export class InMemoryUserRepository {
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

export class InMemoryConversationRepository {
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

export class InMemoryConversationMemberRepository {
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

export class InMemoryMessageRepository {
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
      .filter((message) => message.pinned && message.messageStatus !== MessageStatus.REVOKED && !message.deletedAt)
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

export class InMemoryReactionRepository {
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

  async findByUserMessageEmoji(messageId: string, userId: string, emoji: string): Promise<MessageReaction | null> {
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

export class InMemoryPollRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async get(id: string): Promise<Poll | null> {
    const poll = this.store.polls.get(id);
    return poll ? clonePoll(poll) : null;
  }

  async findByConversationId(conversationId: string): Promise<Poll[]> {
    return Array.from(this.store.polls.values())
      .filter((poll) => poll.conversationId === conversationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(clonePoll);
  }

  async findActivePolls(conversationId: string): Promise<Poll[]> {
    const now = Date.now();
    return Array.from(this.store.polls.values())
      .filter((poll) => poll.conversationId === conversationId)
      .filter((poll) => (poll.status || PollStatus.ACTIVE) === PollStatus.ACTIVE)
      .filter((poll) => !poll.expiresAt || poll.expiresAt.getTime() > now)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(clonePoll);
  }

  async insert(poll: Poll): Promise<boolean> {
    this.store.polls.set(poll.id, clonePoll(poll));
    return true;
  }

  async update(id: string, data: Partial<Poll>): Promise<boolean> {
    const poll = this.store.polls.get(id);
    if (!poll) return false;
    const normalized = { ...data } as Record<string, any>;
    for (const key of ["closedAt", "closedBy", "pinnedAt", "pinnedBy"] as const) {
      if (normalized[key] === null) normalized[key] = undefined;
    }
    Object.assign(poll, normalized, { updatedAt: new Date() });
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.polls.delete(id);
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    for (const poll of Array.from(this.store.polls.values())) {
      if (poll.conversationId === conversationId) this.store.polls.delete(poll.id);
    }
  }
}

export class InMemoryGroupReminderRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async get(id: string): Promise<GroupReminder | null> {
    const reminder = this.store.reminders.get(id);
    return reminder ? cloneGroupReminder(reminder) : null;
  }

  async findByConversationId(conversationId: string): Promise<GroupReminder[]> {
    return Array.from(this.store.reminders.values())
      .filter((reminder) => reminder.conversationId === conversationId)
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
      .map(cloneGroupReminder);
  }

  async insert(reminder: GroupReminder): Promise<boolean> {
    this.store.reminders.set(reminder.id, cloneGroupReminder(reminder));
    return true;
  }

  async update(id: string, data: Partial<GroupReminder>): Promise<boolean> {
    const reminder = this.store.reminders.get(id);
    if (!reminder) return false;
    const normalized = { ...data } as Record<string, any>;
    if (normalized.description === null) normalized.description = undefined;
    Object.assign(reminder, normalized, { updatedAt: new Date() });
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.reminders.delete(id);
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    for (const reminder of Array.from(this.store.reminders.values())) {
      if (reminder.conversationId === conversationId) this.store.reminders.delete(reminder.id);
    }
  }
}

export class InMemoryGroupNoteRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async get(id: string): Promise<GroupNote | null> {
    const note = this.store.notes.get(id);
    return note ? cloneGroupNote(note) : null;
  }

  async findByConversationId(conversationId: string): Promise<GroupNote[]> {
    return Array.from(this.store.notes.values())
      .filter((note) => note.conversationId === conversationId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(cloneGroupNote);
  }

  async insert(note: GroupNote): Promise<boolean> {
    this.store.notes.set(note.id, cloneGroupNote(note));
    return true;
  }

  async update(id: string, data: Partial<GroupNote>): Promise<boolean> {
    const note = this.store.notes.get(id);
    if (!note) return false;
    Object.assign(note, data, { updatedAt: new Date() });
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.notes.delete(id);
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    for (const note of Array.from(this.store.notes.values())) {
      if (note.conversationId === conversationId) this.store.notes.delete(note.id);
    }
  }
}

export class InMemoryClassificationRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async insertBatch(classifications: MessageClassification[]): Promise<void> {
    this.store.classifications.push(...classifications.map((item) => ({ ...item })));
  }

  async deleteByMessageId(messageId: string): Promise<void> {
    for (let i = this.store.classifications.length - 1; i >= 0; i--) {
      if (this.store.classifications[i].messageId === messageId) this.store.classifications.splice(i, 1);
    }
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    for (let i = this.store.classifications.length - 1; i >= 0; i--) {
      if (this.store.classifications[i].conversationId === conversationId) this.store.classifications.splice(i, 1);
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

  async listByConversation(conversationId: string): Promise<{
    items: MessageClassification[];
    nextCursor: string;
    hasMore: boolean;
  }> {
    return {
      items: this.store.classifications.filter((item) => item.conversationId === conversationId),
      nextCursor: "",
      hasMore: false,
    };
  }
}

export class InMemoryFriendshipRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async findByCond(cond: { userA?: string; userB?: string }): Promise<{ status: FriendshipStatus } | null> {
    if (!cond.userA || !cond.userB) return null;
    return this.store.friendships.has(this.store.friendshipKey(cond.userA, cond.userB))
      ? { status: FriendshipStatus.ACTIVE }
      : null;
  }
}

export class InMemoryBlockRepository {
  constructor(private readonly store: ChatE2EStore) {}

  async findByCond(cond: { blockerId?: string; blockedUserId?: string }): Promise<{ id: string } | null> {
    if (!cond.blockerId || !cond.blockedUserId) return null;
    return this.store.blocks.has(`${cond.blockerId}#${cond.blockedUserId}`) ? { id: v7() } : null;
  }
}
