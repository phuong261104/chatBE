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
import { ConversationMemberRole, Message, MessageType } from '../model/model';
import { removeMemberFromGroupDTOSchema, RemoveMemberFromGroupCommand } from '../model/dto';

export class RemoveMemberFromGroupHandler implements ICommandHandler<RemoveMemberFromGroupCommand, void> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository
  ) {}

  async execute(command: RemoveMemberFromGroupCommand): Promise<void> {

    const { success, data: validatedInput, error } = removeMemberFromGroupDTOSchema.safeParse(command);

    if (!success) {
      throw new Error('Invalid data');
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.requesterId
    });

    if (!requesterMember) {
      throw AppError.from(new Error('Unauthorized: You are not a member of this group'), 403);
    }

    const isAdmin = requesterMember.role === ConversationMemberRole.ADMIN;
    const isSelf = validatedInput.requesterId === validatedInput.targetUserId;

    if (!isAdmin && !isSelf) {
      throw AppError.from(new Error('Unauthorized: Only admins can remove other members'), 403);
    }

    const conversation = await this.conversationQueryRepo.get(validatedInput.conversationId);
    if (!conversation) {
      throw AppError.from(new Error('Conversation not found'), 404);
    }

    const targetMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.targetUserId
    });

    if (!targetMember) {
      throw AppError.from(new Error('Target user is not a member'), 404);
    }

    const now = new Date();
    await this.conversationMemberCommandRepo.update(targetMember.id, {
      leftAt: now
    });

    await this.conversationCommandRepo.update(validatedInput.conversationId, {
      membersCount: Math.max(0, (conversation.membersCount || 1) - 1)
    });

    const messageId = v7();

    const [requesterUser, targetUser] = await Promise.all([
      this.userQueryRepo.get(validatedInput.requesterId),
      this.userQueryRepo.get(validatedInput.targetUserId)
    ]);

    const requesterDisplayName = requesterUser?.displayName || 'Unknown User';
    const targetDisplayName = targetUser?.displayName || 'Unknown User';

    const systemMessageText = isSelf
      ? `${targetDisplayName} đã rời khỏi nhóm`
      : `${requesterDisplayName} đã xóa ${targetDisplayName} khỏi nhóm`;

    const systemMessage: Message = {
      id: messageId,
      conversationId: validatedInput.conversationId,
      senderId: validatedInput.requesterId,
      type: MessageType.SYSTEM,
      text: systemMessageText,
      createdAt: now,
      pinned: false,
    };
    await this.messageCommandRepo.insert(systemMessage);

    await this.conversationCommandRepo.update(validatedInput.conversationId, {
      lastMessage: {
        messageId: messageId,
        senderId: validatedInput.requesterId,
        type: MessageType.SYSTEM,
        textPreview: systemMessageText,
        createdAt: now
      },
      lastMessageAt: now
    });
  }
}
