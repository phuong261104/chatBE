import { v7 } from "uuid";
import {
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
} from "../interface";
import { GroupReminderRepeatRule, Message, MessageType } from "../model/model";

export interface UtilityMessageRepos {
  messageCommandRepo: IMessageCommandRepository;
  conversationCommandRepo: IConversationCommandRepository;
  conversationMemberCommandRepo: IConversationMemberCommandRepository;
}

export interface CreateUtilityMessageInput extends UtilityMessageRepos {
  conversationId: string;
  senderId: string;
  type: MessageType;
  text: string;
  createdAt?: Date;
  pollId?: string;
  reminderId?: string;
  systemAction?: string;
  systemRefId?: string;
  incrementUnread?: boolean;
}

export async function createConversationActivityMessage(input: CreateUtilityMessageInput): Promise<Message> {
  const createdAt = input.createdAt || new Date();
  const message: Message = {
    id: v7(),
    conversationId: input.conversationId,
    senderId: input.senderId,
    type: input.type,
    text: input.text,
    pollId: input.pollId,
    reminderId: input.reminderId,
    systemAction: input.systemAction,
    systemRefId: input.systemRefId,
    createdAt,
    pinned: false,
  };

  await input.messageCommandRepo.insert(message);
  await input.conversationCommandRepo.update(input.conversationId, {
    lastMessage: {
      messageId: message.id,
      senderId: input.senderId,
      type: input.type,
      textPreview: input.text.substring(0, 100),
      createdAt,
    },
    lastMessageAt: createdAt,
  });

  if (input.incrementUnread === false) {
    await input.conversationMemberCommandRepo.touchActivityForConversation(input.conversationId, createdAt);
  } else {
    await input.conversationMemberCommandRepo.incrementUnreadCountForConversation(input.conversationId, input.senderId);
  }

  return message;
}

export function attachHiddenMessage<T extends object>(target: T, key: string, message: Message): T {
  Object.defineProperty(target, key, {
    value: message,
    enumerable: false,
    configurable: true,
  });
  return target;
}

export function attachHiddenMessages<T extends object>(target: T, key: string, messages: Message[]): T {
  Object.defineProperty(target, key, {
    value: messages,
    enumerable: false,
    configurable: true,
  });
  return target;
}

export function getAttachedMessage(source: unknown, key: string): Message | undefined {
  return source && typeof source === "object" ? (source as Record<string, Message | undefined>)[key] : undefined;
}

export function getAttachedMessages(source: unknown, key: string): Message[] {
  const value = source && typeof source === "object" ? (source as Record<string, Message[] | undefined>)[key] : undefined;
  return Array.isArray(value) ? value : [];
}

export function getInitialNextNotifyAt(remindAt: Date, notifyBeforeMinutes = 0): Date {
  return new Date(remindAt.getTime() - Math.max(0, notifyBeforeMinutes) * 60_000);
}

export function addReminderInterval(remindAt: Date, repeatRule: GroupReminderRepeatRule): Date {
  const next = new Date(remindAt);
  if (repeatRule === GroupReminderRepeatRule.DAILY) {
    next.setDate(next.getDate() + 1);
  } else if (repeatRule === GroupReminderRepeatRule.WEEKLY) {
    next.setDate(next.getDate() + 7);
  } else if (repeatRule === GroupReminderRepeatRule.MONTHLY) {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export function getNextRepeatedReminderAt(
  currentRemindAt: Date,
  repeatRule: GroupReminderRepeatRule,
  now = new Date(),
): Date {
  let next = addReminderInterval(currentRemindAt, repeatRule);
  while (next <= now) {
    next = addReminderInterval(next, repeatRule);
  }
  return next;
}
