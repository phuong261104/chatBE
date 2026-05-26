import {
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IGroupReminderCommandRepository,
  IGroupReminderQueryRepository,
  IPollCommandRepository,
  IPollQueryRepository,
  IMessageCommandRepository,
} from "../interface";
import {
  GroupReminder,
  GroupReminderRepeatRule,
  GroupReminderStatus,
  Message,
  MessageType,
  PollStatus,
} from "../model/model";
import {
  createConversationActivityMessage,
  getInitialNextNotifyAt,
  getNextRepeatedReminderAt,
} from "./utility-messages";

interface UtilityNotifier {
  getMemberUserIds(conversationId: string, excludeUserId?: string): Promise<string[]>;
  emitToUser(userId: string, event: string, data: any): void;
  emitToGroupRoom(conversationId: string, event: string, data: any): void;
}

export interface GroupUtilityWorkerDeps {
  pollQueryRepo: IPollQueryRepository;
  pollCommandRepo: IPollCommandRepository;
  reminderQueryRepo: IGroupReminderQueryRepository;
  reminderCommandRepo: IGroupReminderCommandRepository;
  messageCommandRepo: IMessageCommandRepository;
  conversationCommandRepo: IConversationCommandRepository;
  conversationMemberCommandRepo: IConversationMemberCommandRepository;
  notifier?: UtilityNotifier;
  intervalMs?: number;
}

export class GroupUtilityWorker {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly deps: GroupUtilityWorkerDeps) {}

  start(): void {
    if (this.timer) return;
    const intervalMs = this.deps.intervalMs || Number(process.env.CHAT_UTILITY_WORKER_INTERVAL_MS || 30000);
    this.timer = setInterval(() => {
      this.runOnce().catch((error) => console.error("Group utility worker failed:", error));
    }, intervalMs);
    this.timer.unref?.();
    setTimeout(() => this.runOnce().catch((error) => console.error("Group utility worker failed:", error)), 1000).unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async runOnce(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.closeExpiredPolls(now);
      await this.processDueReminders(now);
    } finally {
      this.running = false;
    }
  }

  private async closeExpiredPolls(now: Date): Promise<void> {
    if (!this.deps.pollQueryRepo.findExpiredActivePolls) return;
    const polls = await this.deps.pollQueryRepo.findExpiredActivePolls(now, 100);
    for (const poll of polls) {
      if (poll.status !== PollStatus.ACTIVE || !poll.expiresAt || poll.expiresAt > now) continue;
      const closed = this.deps.pollCommandRepo.closeExpired
        ? await this.deps.pollCommandRepo.closeExpired(poll.id, now)
        : await this.closeExpiredPollWithoutCondition(poll.id, now);
      if (!closed) continue;
      const message = await createConversationActivityMessage({
        messageCommandRepo: this.deps.messageCommandRepo,
        conversationCommandRepo: this.deps.conversationCommandRepo,
        conversationMemberCommandRepo: this.deps.conversationMemberCommandRepo,
        conversationId: poll.conversationId,
        senderId: poll.createdBy,
        type: MessageType.SYSTEM,
        text: `Bình chọn "${poll.question}" đã kết thúc`,
        systemAction: "poll_expired",
        systemRefId: poll.id,
        pollId: poll.id,
        createdAt: now,
      });
      await this.emitReceiveMessage(poll.conversationId, message);
      this.deps.notifier?.emitToGroupRoom(poll.conversationId, "poll:closed", {
        conversationId: poll.conversationId,
        pollId: poll.id,
        poll: { ...poll, status: PollStatus.CLOSED, closedAt: now },
        systemMessage: message,
      });
    }
  }

  private async processDueReminders(now: Date): Promise<void> {
    if (!this.deps.reminderQueryRepo.findDueReminders) return;
    const reminders = await this.deps.reminderQueryRepo.findDueReminders(now, 100);
    for (const reminder of reminders) {
      if (reminder.status !== GroupReminderStatus.ACTIVE || !reminder.nextNotifyAt || reminder.nextNotifyAt > now) {
        continue;
      }

      const updateData = this.getReminderNotificationUpdate(reminder, now);
      const updated = this.deps.reminderCommandRepo.updateDueReminder
        ? await this.deps.reminderCommandRepo.updateDueReminder(reminder.id, reminder.nextNotifyAt, updateData)
        : await this.updateDueReminderWithoutCondition(reminder.id, updateData);
      if (!updated) continue;

      const updatedReminder = {
        ...reminder,
        ...updateData,
        updatedAt: now,
      };
      const isBeforeEvent = now < reminder.remindAt;
      const text = isBeforeEvent
        ? `Nhắc hẹn "${reminder.title}" sẽ diễn ra lúc ${reminder.remindAt.toISOString()}`
        : `Đến giờ: ${reminder.title}`;
      const message = await createConversationActivityMessage({
        messageCommandRepo: this.deps.messageCommandRepo,
        conversationCommandRepo: this.deps.conversationCommandRepo,
        conversationMemberCommandRepo: this.deps.conversationMemberCommandRepo,
        conversationId: reminder.conversationId,
        senderId: reminder.createdBy,
        type: MessageType.SYSTEM,
        text,
        reminderId: reminder.id,
        systemAction: isBeforeEvent ? "reminder_upcoming" : "reminder_due",
        systemRefId: reminder.id,
        createdAt: now,
      });

      await this.emitReceiveMessage(reminder.conversationId, message);
      this.deps.notifier?.emitToGroupRoom(reminder.conversationId, "group:reminder_due", {
        conversationId: reminder.conversationId,
        reminderId: reminder.id,
        reminder: updatedReminder,
        message,
      });
    }
  }

  private async closeExpiredPollWithoutCondition(id: string, now: Date): Promise<boolean> {
    await this.deps.pollCommandRepo.update(id, {
      status: PollStatus.CLOSED,
      closedAt: now,
    });
    return true;
  }

  private async updateDueReminderWithoutCondition(
    id: string,
    data: Partial<GroupReminder>,
  ): Promise<boolean> {
    await this.deps.reminderCommandRepo.update(id, data);
    return true;
  }

  private getReminderNotificationUpdate(
    reminder: GroupReminder,
    now: Date,
  ): Partial<GroupReminder> {
    const isBeforeEvent = now < reminder.remindAt;
    if (isBeforeEvent) {
      return {
        nextNotifyAt: reminder.remindAt,
        lastNotifiedAt: now,
      };
    }

    const repeatRule = reminder.repeatRule || GroupReminderRepeatRule.NONE;
    if (repeatRule === GroupReminderRepeatRule.NONE) {
      return {
        status: GroupReminderStatus.DONE,
        lastNotifiedAt: now,
      };
    }

    const nextRemindAt = getNextRepeatedReminderAt(reminder.remindAt, repeatRule, now);
    return {
      remindAt: nextRemindAt,
      nextNotifyAt: getInitialNextNotifyAt(nextRemindAt, reminder.notifyBeforeMinutes || 0),
      lastNotifiedAt: now,
    };
  }

  private async emitReceiveMessage(conversationId: string, message: Message): Promise<void> {
    if (!this.deps.notifier) return;
    const memberUserIds = await this.deps.notifier.getMemberUserIds(conversationId);
    for (const userId of memberUserIds) {
      this.deps.notifier.emitToUser(userId, "receiveMessage", {
        conversationId,
        message,
      });
    }
  }
}
