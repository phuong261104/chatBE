import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageQueryRepository,
  MarkConversationStateResult,
  ConversationReadState,
} from '../interface';
import { ConversationMember, ConversationMemberStatus } from '../model/model';
import { markAsDeliveredDTOSchema, MarkAsDeliveredCommand } from '../model/dto';

export class MarkAsDeliveredHandler implements ICommandHandler<MarkAsDeliveredCommand, MarkConversationStateResult> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageQueryRepo: IMessageQueryRepository
  ) {}

  async execute(command: MarkAsDeliveredCommand): Promise<MarkConversationStateResult> {

    const { success, data: validatedInput } = markAsDeliveredDTOSchema.safeParse(command);

    if (!success) {
      throw new Error('Invalid data');
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.userId
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error('Unauthorized: You are not a member of this conversation'), 403);
    }

    const message = await this.messageQueryRepo.get(validatedInput.lastDeliveredMessageId);
    if (!message || message.conversationId !== validatedInput.conversationId) {
      throw AppError.from(new Error('Message not found'), 404);
    }

    if (message.deletedForUserIds?.includes(validatedInput.userId)) {
      throw AppError.from(new Error('Message not found'), 404);
    }

    if (member.lastDeliveredMessageId) {
      const currentDelivered = await this.messageQueryRepo.get(member.lastDeliveredMessageId);
      if (
        currentDelivered &&
        currentDelivered.conversationId === validatedInput.conversationId &&
        currentDelivered.createdAt.getTime() >= message.createdAt.getTime()
      ) {
        return { changed: false, state: this.toReadState(member) };
      }
    }

    const result = await this.conversationMemberCommandRepo.advanceDeliveredState({
      memberId: member.id,
      lastDeliveredMessageId: validatedInput.lastDeliveredMessageId,
      messageCreatedAt: message.createdAt,
      deliveredAt: new Date(),
    });

    return {
      changed: result.changed,
      state: this.toReadState(result.member || member),
    };
  }

  private toReadState(member: ConversationMember): ConversationReadState {
    return {
      conversationId: member.conversationId,
      userId: member.userId,
      lastSeenMessageId: member.lastSeenMessageId,
      lastReadMessageId: member.lastReadMessageId,
      lastDeliveredMessageId: member.lastDeliveredMessageId,
      lastSeenAt: member.lastSeenAt,
      lastReadAt: member.lastReadAt,
      lastDeliveredAt: member.lastDeliveredAt,
      lastSeenMessageCreatedAt: member.lastSeenMessageCreatedAt,
      lastReadMessageCreatedAt: member.lastReadMessageCreatedAt,
      lastDeliveredMessageCreatedAt: member.lastDeliveredMessageCreatedAt,
      unreadCount: member.unreadCount || 0,
      updatedAt: member.updatedAt,
    };
  }
}
