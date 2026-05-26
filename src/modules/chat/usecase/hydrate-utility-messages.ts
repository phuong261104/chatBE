import {
  IGroupReminderQueryRepository,
  IPollQueryRepository,
} from "../interface";
import {
  Conversation,
  ConversationMember,
  Message,
  MessageType,
} from "../model/model";
import { sanitizePollForViewer } from "./group-permissions";

export async function hydrateUtilityMessages(
  messages: Message[],
  options: {
    pollQueryRepo: IPollQueryRepository;
    reminderQueryRepo: IGroupReminderQueryRepository;
    viewer?: ConversationMember;
    conversation?: Conversation | null;
  },
): Promise<void> {
  const pollIds = Array.from(
    new Set(messages.filter((message) => message.type === MessageType.POLL && message.pollId).map((message) => message.pollId as string)),
  );
  const reminderIds = Array.from(
    new Set(
      messages
        .filter((message) => message.type === MessageType.REMINDER && message.reminderId)
        .map((message) => message.reminderId as string),
    ),
  );

  const pollEntries = await Promise.all(
    pollIds.map(async (pollId) => [pollId, await options.pollQueryRepo.get(pollId)] as const),
  );
  const reminderEntries = await Promise.all(
    reminderIds.map(async (reminderId) => [reminderId, await options.reminderQueryRepo.get(reminderId)] as const),
  );

  const polls = new Map(pollEntries.filter((entry) => !!entry[1]));
  const reminders = new Map(reminderEntries.filter((entry) => !!entry[1]));

  for (const message of messages) {
    if (message.type === MessageType.POLL && message.pollId) {
      const poll = polls.get(message.pollId);
      if (poll) {
        message.poll = options.viewer ? sanitizePollForViewer(poll, options.viewer, options.conversation) : poll;
      }
    }

    if (message.type === MessageType.REMINDER && message.reminderId) {
      const reminder = reminders.get(message.reminderId);
      if (reminder) {
        message.reminder = reminder;
      }
    }
  }
}
