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
import { markAsSeenDTOSchema, MarkAsSeenCommand } from '../model/dto';

export class MarkAsSeenHandler implements ICommandHandler<MarkAsSeenCommand, MarkConversationStateResult> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageQueryRepo: IMessageQueryRepository
  ) {}

  async execute(command: MarkAsSeenCommand): Promise<MarkConversationStateResult> {

    const { success, data: validatedInput } = markAsSeenDTOSchema.safeParse(command);

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

    const message = await this.messageQueryRepo.get(validatedInput.lastSeenMessageId);
    if (!message || message.conversationId !== validatedInput.conversationId) {
      throw AppError.from(new Error('Message not found'), 404);
    }

    if (message.deletedForUserIds?.includes(validatedInput.userId)) {
      throw AppError.from(new Error('Message not found'), 404);
    }

    if (member.lastSeenMessageId) {
      const currentSeen = await this.messageQueryRepo.get(member.lastSeenMessageId);
      if (
        currentSeen &&
        currentSeen.conversationId === validatedInput.conversationId &&
        currentSeen.createdAt.getTime() >= message.createdAt.getTime()
      ) {
        return { changed: false, state: this.toReadState(member) };
      }
    }

    const latestVisible = await this.messageQueryRepo.listWithCursor(
      validatedInput.conversationId,
      undefined,
      1,
      validatedInput.userId,
    );
    const shouldClearUnread =
      latestVisible.length === 0 ||
      message.createdAt.getTime() >= latestVisible[0].createdAt.getTime();

    const result = await this.conversationMemberCommandRepo.advanceSeenState({
      memberId: member.id,
      lastSeenMessageId: validatedInput.lastSeenMessageId,
      messageCreatedAt: message.createdAt,
      seenAt: new Date(),
      clearUnread: shouldClearUnread,
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
