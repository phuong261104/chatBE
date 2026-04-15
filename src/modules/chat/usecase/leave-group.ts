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
import { ConversationMember, ConversationMemberRole, ConversationType, Message, MessageType } from '../model/model';
import { leaveGroupDTOSchema, LeaveGroupCommand } from '../model/dto';

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

    if (!member || member.leftAt) {
      throw AppError.from(new Error('You are not a member of this group'), 404);
    }

    const currentOwnerId = conversation.ownerId || conversation.createdBy;
    if (member.userId === currentOwnerId) {
      throw AppError.from(new Error("Owner cannot leave. Transfer ownership first."), 400);
    }

    if (member.role === ConversationMemberRole.ADMIN) {
      const newAdmins = (conversation.admins || []).filter(id => id !== member.userId);
      await this.conversationCommandRepo.update(validatedInput.conversationId, { admins: newAdmins });
    }

    const now = new Date();
    await this.conversationMemberCommandRepo.update(member.id, {
      leftAt: now
    });

    await this.conversationCommandRepo.update(validatedInput.conversationId, {
      membersCount: Math.max(0, (conversation.membersCount || 1) - 1)
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
  }
}
