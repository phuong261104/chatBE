import { ICommandHandler, IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IConversationMemberQueryRepository,
  IConversationQueryRepository,
  IGroupNoteCommandRepository,
  IGroupNoteQueryRepository,
  IGroupReminderCommandRepository,
  IGroupReminderQueryRepository,
  IMessageCommandRepository,
} from "../interface";
import {
  Conversation,
  ConversationMember,
  ConversationMemberStatus,
  ConversationType,
  GroupNote,
  GroupReminder,
  GroupReminderRepeatRule,
  GroupReminderStatus,
  GroupSettings,
  MessageType,
} from "../model/model";
import {
  CreateGroupNoteCommand,
  CreateGroupReminderCommand,
  GroupNoteActionCommand,
  GroupReminderActionCommand,
  UpdateGroupNoteCommand,
  UpdateGroupReminderCommand,
} from "../model/dto";
import {
  canUseGroupUtility,
  isActiveMember,
  isGroupManager,
  normalizeGroupSettings,
} from "./group-permissions";
import {
  attachHiddenMessage,
  createConversationActivityMessage,
  getInitialNextNotifyAt,
} from "./utility-messages";

type UtilityKind = keyof GroupSettings["utilityPermissions"];

abstract class GroupUtilityBase {
  constructor(
    protected readonly conversationQueryRepo: IConversationQueryRepository,
    protected readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  protected async assertMember(conversationId: string, userId: string): Promise<{
    conversation: Conversation;
    member: ConversationMember;
    settings: GroupSettings;
  }> {
    const conversation = await this.conversationQueryRepo.get(conversationId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }
    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Utilities are only available in group conversations"), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({ conversationId, userId });
    if (!isActiveMember(member)) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    return { conversation, member, settings: normalizeGroupSettings(conversation.settings) };
  }

  protected async assertUtilityPermission(conversationId: string, userId: string, utility: UtilityKind): Promise<void> {
    const { conversation, member, settings } = await this.assertMember(conversationId, userId);
    if (!canUseGroupUtility(settings, utility, member, conversation)) {
      throw AppError.from(new Error(`Only owner or admins can manage group ${utility}s`), 403);
    }
  }

  protected async assertManager(conversationId: string, userId: string): Promise<void> {
    const { conversation, member } = await this.assertMember(conversationId, userId);
    if (!isGroupManager(member, conversation)) {
      throw AppError.from(new Error("Only owner or admins can manage this item"), 403);
    }
  }

  protected async assertCreatorOrManager(conversationId: string, userId: string, createdBy: string): Promise<void> {
    const { conversation, member } = await this.assertMember(conversationId, userId);
    if (createdBy !== userId && !isGroupManager(member, conversation)) {
      throw AppError.from(new Error("Only creator, owner or admins can manage this item"), 403);
    }
  }
}

export class CreateGroupReminderHandler
  extends GroupUtilityBase
  implements ICommandHandler<CreateGroupReminderCommand, GroupReminder>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly reminderCommandRepo: IGroupReminderCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async execute(command: CreateGroupReminderCommand): Promise<GroupReminder> {
    await this.assertUtilityPermission(command.conversationId, command.userId, "reminder");
    const now = new Date();
    const remindAt = new Date(command.remindAt);
    const repeatRule = command.repeatRule || GroupReminderRepeatRule.NONE;
    const notifyBeforeMinutes = command.notifyBeforeMinutes || 0;
    const reminder: GroupReminder = {
      id: v7(),
      conversationId: command.conversationId,
      title: command.title,
      description: command.description,
      remindAt,
      repeatRule,
      notifyBeforeMinutes,
      nextNotifyAt: getInitialNextNotifyAt(remindAt, notifyBeforeMinutes),
      status: GroupReminderStatus.ACTIVE,
      pinned: false,
      createdBy: command.userId,
      createdAt: now,
      updatedAt: now,
    };
    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId: command.conversationId,
      senderId: command.userId,
      type: MessageType.REMINDER,
      text: `Nhắc hẹn: ${command.title}`,
      reminderId: reminder.id,
      createdAt: now,
    });
    reminder.messageId = message.id;
    await this.reminderCommandRepo.insert(reminder);
    message.reminder = reminder;
    return attachHiddenMessage(reminder, "timelineMessage", message);
  }
}

export class ListGroupRemindersHandler
  extends GroupUtilityBase
  implements IQueryHandler<{ conversationId: string; userId: string }, GroupReminder[]>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly reminderQueryRepo: IGroupReminderQueryRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async query(query: { conversationId: string; userId: string }): Promise<GroupReminder[]> {
    await this.assertMember(query.conversationId, query.userId);
    return this.reminderQueryRepo.findByConversationId(query.conversationId);
  }
}

export class UpdateGroupReminderHandler
  extends GroupUtilityBase
  implements ICommandHandler<UpdateGroupReminderCommand, GroupReminder>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly reminderQueryRepo: IGroupReminderQueryRepository,
    private readonly reminderCommandRepo: IGroupReminderCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async execute(command: UpdateGroupReminderCommand): Promise<GroupReminder> {
    const reminder = await this.reminderQueryRepo.get(command.reminderId);
    if (!reminder) {
      throw AppError.from(new Error("Reminder not found"), 404);
    }
    await this.assertCreatorOrManager(reminder.conversationId, command.userId, reminder.createdBy);

    const remindAt = command.remindAt !== undefined ? new Date(command.remindAt) : reminder.remindAt;
    const repeatRule = command.repeatRule !== undefined ? command.repeatRule : reminder.repeatRule || GroupReminderRepeatRule.NONE;
    const notifyBeforeMinutes =
      command.notifyBeforeMinutes !== undefined ? command.notifyBeforeMinutes : reminder.notifyBeforeMinutes || 0;

    await this.reminderCommandRepo.update(command.reminderId, {
      ...(command.title !== undefined && { title: command.title }),
      ...(command.description !== undefined && { description: command.description || undefined }),
      ...(command.remindAt !== undefined && { remindAt }),
      ...(command.repeatRule !== undefined && { repeatRule }),
      ...(command.notifyBeforeMinutes !== undefined && { notifyBeforeMinutes }),
      ...((command.remindAt !== undefined || command.notifyBeforeMinutes !== undefined || command.repeatRule !== undefined) && {
        nextNotifyAt: getInitialNextNotifyAt(remindAt, notifyBeforeMinutes),
      }),
      ...(command.status !== undefined && { status: command.status }),
    });
    const updated = await this.reminderQueryRepo.get(command.reminderId);
    if (!updated) throw AppError.from(new Error("Failed to get updated reminder"), 500);
    if (updated.messageId && (command.title !== undefined || command.description !== undefined || command.remindAt !== undefined)) {
      await this.messageCommandRepo.update(updated.messageId, {
        text: `Nhắc hẹn: ${updated.title}`,
      });
    }
    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId: updated.conversationId,
      senderId: command.userId,
      type: MessageType.SYSTEM,
      text: `Đã cập nhật nhắc hẹn "${updated.title}"`,
      reminderId: updated.id,
      systemAction: "reminder_updated",
      systemRefId: updated.id,
    });
    return attachHiddenMessage(updated, "systemMessage", message);
  }
}

export class DeleteGroupReminderHandler
  extends GroupUtilityBase
  implements ICommandHandler<GroupReminderActionCommand, GroupReminder>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly reminderQueryRepo: IGroupReminderQueryRepository,
    private readonly reminderCommandRepo: IGroupReminderCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async execute(command: GroupReminderActionCommand): Promise<GroupReminder> {
    const reminder = await this.reminderQueryRepo.get(command.reminderId);
    if (!reminder) throw AppError.from(new Error("Reminder not found"), 404);
    await this.assertCreatorOrManager(reminder.conversationId, command.userId, reminder.createdBy);
    await this.reminderCommandRepo.update(command.reminderId, {
      status: GroupReminderStatus.CANCELLED,
    });
    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId: reminder.conversationId,
      senderId: command.userId,
      type: MessageType.SYSTEM,
      text: `Đã xóa nhắc hẹn "${reminder.title}"`,
      reminderId: reminder.id,
      systemAction: "reminder_deleted",
      systemRefId: reminder.id,
    });
    return attachHiddenMessage(
      {
        ...reminder,
        status: GroupReminderStatus.CANCELLED,
      },
      "systemMessage",
      message,
    );
  }
}

export abstract class GroupReminderPinBase
  extends GroupUtilityBase
  implements ICommandHandler<GroupReminderActionCommand, GroupReminder>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    protected readonly reminderQueryRepo: IGroupReminderQueryRepository,
    protected readonly reminderCommandRepo: IGroupReminderCommandRepository,
    protected readonly messageCommandRepo: IMessageCommandRepository,
    protected readonly conversationCommandRepo: IConversationCommandRepository,
    protected readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  abstract execute(command: GroupReminderActionCommand): Promise<GroupReminder>;

  protected async assertReminder(command: GroupReminderActionCommand): Promise<GroupReminder> {
    const reminder = await this.reminderQueryRepo.get(command.reminderId);
    if (!reminder) throw AppError.from(new Error("Reminder not found"), 404);
    await this.assertCreatorOrManager(reminder.conversationId, command.userId, reminder.createdBy);
    return reminder;
  }
}

export class PinGroupReminderHandler extends GroupReminderPinBase {
  async execute(command: GroupReminderActionCommand): Promise<GroupReminder> {
    const reminder = await this.assertReminder(command);
    const pinnedAt = new Date();
    await this.reminderCommandRepo.update(command.reminderId, {
      pinned: true,
      pinnedAt,
      pinnedBy: command.userId,
    });
    if (reminder.messageId) {
      await this.messageCommandRepo.update(reminder.messageId, {
        pinned: true,
        pinnedAt,
      });
    }
    const updated = await this.reminderQueryRepo.get(command.reminderId);
    if (!updated) throw AppError.from(new Error("Failed to get updated reminder"), 500);
    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId: reminder.conversationId,
      senderId: command.userId,
      type: MessageType.SYSTEM,
      text: `Đã ghim nhắc hẹn "${reminder.title}"`,
      reminderId: reminder.id,
      systemAction: "reminder_pinned",
      systemRefId: reminder.id,
      incrementUnread: false,
    });
    return attachHiddenMessage(updated, "systemMessage", message);
  }
}

export class UnpinGroupReminderHandler extends GroupReminderPinBase {
  async execute(command: GroupReminderActionCommand): Promise<GroupReminder> {
    const reminder = await this.assertReminder(command);
    await this.reminderCommandRepo.update(command.reminderId, {
      pinned: false,
      pinnedAt: null as any,
      pinnedBy: null as any,
    });
    if (reminder.messageId) {
      await this.messageCommandRepo.update(reminder.messageId, {
        pinned: false,
        pinnedAt: null as any,
      });
    }
    const updated = await this.reminderQueryRepo.get(command.reminderId);
    if (!updated) throw AppError.from(new Error("Failed to get updated reminder"), 500);
    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId: reminder.conversationId,
      senderId: command.userId,
      type: MessageType.SYSTEM,
      text: `Đã bỏ ghim nhắc hẹn "${reminder.title}"`,
      reminderId: reminder.id,
      systemAction: "reminder_unpinned",
      systemRefId: reminder.id,
      incrementUnread: false,
    });
    return attachHiddenMessage(updated, "systemMessage", message);
  }
}

export class CreateGroupNoteHandler
  extends GroupUtilityBase
  implements ICommandHandler<CreateGroupNoteCommand, GroupNote>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly noteCommandRepo: IGroupNoteCommandRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async execute(command: CreateGroupNoteCommand): Promise<GroupNote> {
    await this.assertUtilityPermission(command.conversationId, command.userId, "note");
    const now = new Date();
    const note: GroupNote = {
      id: v7(),
      conversationId: command.conversationId,
      title: command.title,
      content: command.content,
      createdBy: command.userId,
      createdAt: now,
      updatedAt: now,
    };
    await this.noteCommandRepo.insert(note);
    return note;
  }
}

export class ListGroupNotesHandler
  extends GroupUtilityBase
  implements IQueryHandler<{ conversationId: string; userId: string }, GroupNote[]>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly noteQueryRepo: IGroupNoteQueryRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async query(query: { conversationId: string; userId: string }): Promise<GroupNote[]> {
    await this.assertMember(query.conversationId, query.userId);
    return this.noteQueryRepo.findByConversationId(query.conversationId);
  }
}

export class UpdateGroupNoteHandler
  extends GroupUtilityBase
  implements ICommandHandler<UpdateGroupNoteCommand, GroupNote>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly noteQueryRepo: IGroupNoteQueryRepository,
    private readonly noteCommandRepo: IGroupNoteCommandRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async execute(command: UpdateGroupNoteCommand): Promise<GroupNote> {
    const note = await this.noteQueryRepo.get(command.noteId);
    if (!note) throw AppError.from(new Error("Note not found"), 404);
    await this.assertManager(note.conversationId, command.userId);

    await this.noteCommandRepo.update(command.noteId, {
      ...(command.title !== undefined && { title: command.title }),
      ...(command.content !== undefined && { content: command.content }),
      updatedBy: command.userId,
    });
    const updated = await this.noteQueryRepo.get(command.noteId);
    if (!updated) throw AppError.from(new Error("Failed to get updated note"), 500);
    return updated;
  }
}

export class DeleteGroupNoteHandler
  extends GroupUtilityBase
  implements ICommandHandler<GroupNoteActionCommand, void>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly noteQueryRepo: IGroupNoteQueryRepository,
    private readonly noteCommandRepo: IGroupNoteCommandRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async execute(command: GroupNoteActionCommand): Promise<void> {
    const note = await this.noteQueryRepo.get(command.noteId);
    if (!note) throw AppError.from(new Error("Note not found"), 404);
    await this.assertManager(note.conversationId, command.userId);
    await this.noteCommandRepo.delete(command.noteId);
  }
}
