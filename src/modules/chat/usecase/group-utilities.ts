import { ICommandHandler, IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationMemberQueryRepository,
  IConversationQueryRepository,
  IGroupNoteCommandRepository,
  IGroupNoteQueryRepository,
  IGroupReminderCommandRepository,
  IGroupReminderQueryRepository,
} from "../interface";
import {
  Conversation,
  ConversationMember,
  ConversationMemberStatus,
  ConversationType,
  GroupNote,
  GroupReminder,
  GroupReminderStatus,
  GroupSettings,
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
}

export class CreateGroupReminderHandler
  extends GroupUtilityBase
  implements ICommandHandler<CreateGroupReminderCommand, GroupReminder>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly reminderCommandRepo: IGroupReminderCommandRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async execute(command: CreateGroupReminderCommand): Promise<GroupReminder> {
    await this.assertUtilityPermission(command.conversationId, command.userId, "reminder");
    const now = new Date();
    const reminder: GroupReminder = {
      id: v7(),
      conversationId: command.conversationId,
      title: command.title,
      description: command.description,
      remindAt: new Date(command.remindAt),
      status: GroupReminderStatus.ACTIVE,
      createdBy: command.userId,
      createdAt: now,
      updatedAt: now,
    };
    await this.reminderCommandRepo.insert(reminder);
    return reminder;
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
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async execute(command: UpdateGroupReminderCommand): Promise<GroupReminder> {
    const reminder = await this.reminderQueryRepo.get(command.reminderId);
    if (!reminder) {
      throw AppError.from(new Error("Reminder not found"), 404);
    }
    await this.assertManager(reminder.conversationId, command.userId);

    await this.reminderCommandRepo.update(command.reminderId, {
      ...(command.title !== undefined && { title: command.title }),
      ...(command.description !== undefined && { description: command.description || undefined }),
      ...(command.remindAt !== undefined && { remindAt: new Date(command.remindAt) }),
      ...(command.status !== undefined && { status: command.status }),
    });
    const updated = await this.reminderQueryRepo.get(command.reminderId);
    if (!updated) throw AppError.from(new Error("Failed to get updated reminder"), 500);
    return updated;
  }
}

export class DeleteGroupReminderHandler
  extends GroupUtilityBase
  implements ICommandHandler<GroupReminderActionCommand, void>
{
  constructor(
    conversationQueryRepo: IConversationQueryRepository,
    conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly reminderQueryRepo: IGroupReminderQueryRepository,
    private readonly reminderCommandRepo: IGroupReminderCommandRepository,
  ) {
    super(conversationQueryRepo, conversationMemberQueryRepo);
  }

  async execute(command: GroupReminderActionCommand): Promise<void> {
    const reminder = await this.reminderQueryRepo.get(command.reminderId);
    if (!reminder) throw AppError.from(new Error("Reminder not found"), 404);
    await this.assertManager(reminder.conversationId, command.userId);
    await this.reminderCommandRepo.delete(command.reminderId);
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
