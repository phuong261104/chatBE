import { v7 } from "uuid";

import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  GroupBlock,
  GroupInviteLink,
  GroupNote,
  GroupReminder,
  GroupSettings,
  Message,
  MessageReaction,
  MessageStatus,
  MessageType,
  Poll,
  UserInfo,
  UserStatus,
} from "@modules/chat/model";
import { MessageClassification } from "@modules/chat/model/model";

export const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

function defaultGroupSettings(): GroupSettings {
  return {
    allowSendLink: true,
    requireApproval: false,
    allowMemberInvite: true,
    whoCanSendMessages: "all",
    whoCanAddMembers: "all",
    whoCanUpdateGroupInfo: "admins",
    whoCanPinMessages: "admins",
    newMemberCanViewHistory: true,
    utilityPermissions: {
      poll: "all",
      reminder: "all",
      note: "all",
    },
  };
}

export function normalizeTestGroupSettings(settings?: Partial<GroupSettings>): GroupSettings {
  const defaults = defaultGroupSettings();
  return {
    ...defaults,
    ...(settings || {}),
    utilityPermissions: {
      ...defaults.utilityPermissions,
      ...(settings?.utilityPermissions || {}),
    },
  };
}

export function cloneDate(value: Date | undefined | null): Date | undefined | null {
  if (value === undefined || value === null) return value;
  return new Date(value);
}

export function cloneMessage(message: Message): Message {
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

export function cloneMember(member: ConversationMember): ConversationMember {
  return {
    ...member,
    joinedAt: new Date(member.joinedAt),
    leftAt: cloneDate(member.leftAt) as Date | undefined,
    lastReadAt: cloneDate(member.lastReadAt) as Date | undefined,
    lastSeenAt: cloneDate(member.lastSeenAt) as Date | undefined,
    lastDeliveredAt: cloneDate(member.lastDeliveredAt) as Date | undefined,
    lastReadMessageCreatedAt: cloneDate(member.lastReadMessageCreatedAt) as Date | undefined,
    lastSeenMessageCreatedAt: cloneDate(member.lastSeenMessageCreatedAt) as Date | undefined,
    lastDeliveredMessageCreatedAt: cloneDate(member.lastDeliveredMessageCreatedAt) as Date | undefined,
    lastActivityAt: cloneDate(member.lastActivityAt) as Date | undefined,
    muteUntil: cloneDate(member.muteUntil) as Date | undefined,
    pinnedAt: cloneDate(member.pinnedAt) as Date | undefined,
    hiddenAt: cloneDate(member.hiddenAt) as Date | undefined,
    hiddenUserIds: member.hiddenUserIds ? [...member.hiddenUserIds] : [],
  };
}

export function cloneConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    admins: conversation.admins ? [...conversation.admins] : undefined,
    settings: conversation.settings ? normalizeTestGroupSettings(conversation.settings) : undefined,
    lastMessage: conversation.lastMessage
      ? { ...conversation.lastMessage, createdAt: new Date(conversation.lastMessage.createdAt) }
      : undefined,
    lastMessageAt: cloneDate(conversation.lastMessageAt) as Date | undefined,
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
  };
}

export function clonePoll(poll: Poll): Poll {
  return {
    ...poll,
    options: poll.options.map((option) => ({
      ...option,
      votedUserIds: [...option.votedUserIds],
    })),
    expiresAt: cloneDate(poll.expiresAt) as Date | undefined,
    closedAt: cloneDate(poll.closedAt) as Date | undefined,
    pinnedAt: cloneDate(poll.pinnedAt) as Date | undefined,
    lastVoteActivityAt: cloneDate(poll.lastVoteActivityAt) as Date | undefined,
    createdAt: new Date(poll.createdAt),
    updatedAt: new Date(poll.updatedAt),
  };
}

export function cloneGroupReminder(reminder: GroupReminder): GroupReminder {
  return {
    ...reminder,
    remindAt: new Date(reminder.remindAt),
    nextNotifyAt: cloneDate(reminder.nextNotifyAt) as Date | undefined,
    lastNotifiedAt: cloneDate(reminder.lastNotifiedAt) as Date | undefined,
    pinnedAt: cloneDate(reminder.pinnedAt) as Date | undefined,
    createdAt: new Date(reminder.createdAt),
    updatedAt: new Date(reminder.updatedAt),
  };
}

export function cloneGroupNote(note: GroupNote): GroupNote {
  return {
    ...note,
    createdAt: new Date(note.createdAt),
    updatedAt: new Date(note.updatedAt),
  };
}

export function matchesCond<T extends Record<string, any>>(item: T, cond: Record<string, any>): boolean {
  return Object.entries(cond).every(([key, value]) => {
    if (value === undefined) return true;
    const actual = key.split(".").reduce((current, part) => current?.[part], item);
    return actual === value;
  });
}

export class ChatE2EStore {
  readonly users = new Map<string, UserInfo>();
  readonly conversations = new Map<string, Conversation>();
  readonly members = new Map<string, ConversationMember>();
  readonly messages = new Map<string, Message>();
  readonly reactions = new Map<string, MessageReaction>();
  readonly polls = new Map<string, Poll>();
  readonly reminders = new Map<string, GroupReminder>();
  readonly notes = new Map<string, GroupNote>();
  readonly classifications: MessageClassification[] = [];
  readonly friendships = new Set<string>();
  readonly blocks = new Set<string>();
  readonly inviteLinks = new Map<string, GroupInviteLink>();
  readonly groupBlocks = new Map<string, GroupBlock>();
  readonly avatarHistory: Array<{ id: string; userId: string; avatarUrl: string; createdAt: Date }> = [];

  addUser(data: Partial<UserInfo> & Record<string, any> & { id?: string } = {}): UserInfo {
    const user: UserInfo & Record<string, any> = {
      ...data,
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
      settings: data.settings ? normalizeTestGroupSettings(data.settings) : defaultGroupSettings(),
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
      lastReadMessageCreatedAt: data.lastReadMessageCreatedAt,
      lastSeenMessageId: data.lastSeenMessageId,
      lastDeliveredMessageId: data.lastDeliveredMessageId,
      lastSeenAt: data.lastSeenAt,
      lastDeliveredAt: data.lastDeliveredAt,
      lastSeenMessageCreatedAt: data.lastSeenMessageCreatedAt,
      lastDeliveredMessageCreatedAt: data.lastDeliveredMessageCreatedAt,
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

  addMessage(data: Partial<Message> & { conversationId: string; senderId: string; type?: MessageType }): Message {
    const message: Message = {
      id: data.id || v7(),
      conversationId: data.conversationId,
      senderId: data.senderId,
      clientMessageId: data.clientMessageId,
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
