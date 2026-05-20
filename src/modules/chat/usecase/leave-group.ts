import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { v7 } from 'uuid';
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
  IUserQueryRepository
} from '../interface';
import {
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageType,
} from '../model/model';
import { leaveGroupDTOSchema, LeaveGroupCommand } from '../model/dto';
import { isOwnerMember } from "./group-permissions";

export class LeaveGroupHandler implements ICommandHandler<LeaveGroupCommand, void> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository
  ) {}

  async execute(command: LeaveGroupCommand): Promise<void> {

    const { success, data: validatedInput, error } = leaveGroupDTOSchema.safeParse(command);

    if (!success) {
      throw new Error('Invalid data');
    }

    const conversation = await this.conversationQueryRepo.get(validatedInput.conversationId);
    if (!conversation) {
      throw AppError.from(new Error('Conversation not found'), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error('Only group conversations can be left'), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.userId
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error('You are not a member of this group'), 404);
    }

    const isOwnerLeaving = isOwnerMember(member, conversation);
    let nextOwnerId: string | undefined;
    let nextAdmins = (conversation.admins || []).filter(id => id !== member.userId);
    let nextMembersCount = Math.max(0, (conversation.membersCount || 1) - 1);

    if (isOwnerLeaving) {
      if (!validatedInput.autoTransferOwner) {
        throw AppError.from(new Error("Owner cannot leave. Transfer ownership first."), 400);
      }

      const activeMembers = (await this.conversationMemberQueryRepo.listByConversationId(
        validatedInput.conversationId,
      ))
        .filter((m) =>
          m.userId !== member.userId &&
          !m.leftAt &&
          m.status === ConversationMemberStatus.ACTIVE,
        )
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

      const replacement =
        activeMembers.find((m) => m.role === ConversationMemberRole.ADMIN) ||
        activeMembers[0];

      if (replacement) {
        nextOwnerId = replacement.userId;
        nextAdmins = nextAdmins.filter((id) => id !== replacement.userId);
        await this.conversationMemberCommandRepo.update(replacement.id, {
          role: ConversationMemberRole.OWNER,
        });
      } else {
        nextAdmins = [];
        nextMembersCount = 0;
      }
    }

    const now = new Date();
    await this.conversationMemberCommandRepo.update(member.id, {
      leftAt: now,
      ...(isOwnerLeaving ? { role: ConversationMemberRole.ADMIN } : {}),
    });

    await this.conversationCommandRepo.update(validatedInput.conversationId, {
      ...(isOwnerLeaving && nextOwnerId ? { ownerId: nextOwnerId } : {}),
      admins: nextAdmins,
      membersCount: nextMembersCount
    });

    const messageId = v7();

    const user = await this.userQueryRepo.get(validatedInput.userId);
    const userDisplayName = user?.displayName || 'Unknown User';

    const systemMessageText = `${userDisplayName} đã rời khỏi nhóm`;

    const systemMessage: Message = {
      id: messageId,
      conversationId: validatedInput.conversationId,
      senderId: validatedInput.userId,
      type: MessageType.SYSTEM,
      text: systemMessageText,
      createdAt: now,
      pinned: false,
    };
    await this.messageCommandRepo.insert(systemMessage);

    await this.conversationCommandRepo.update(validatedInput.conversationId, {
      lastMessage: {
        messageId: messageId,
        senderId: validatedInput.userId,
        type: MessageType.SYSTEM,
        textPreview: systemMessageText,
        createdAt: now
      },
      lastMessageAt: now
    });

    await this.conversationMemberCommandRepo.touchActivityForConversation(validatedInput.conversationId, now);
  }
}
