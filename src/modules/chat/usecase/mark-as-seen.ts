import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageQueryRepository
} from '../interface';
import { markAsSeenDTOSchema, MarkAsSeenCommand } from '../model/dto';

export class MarkAsSeenHandler implements ICommandHandler<MarkAsSeenCommand, void> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageQueryRepo: IMessageQueryRepository
  ) {}

  async execute(command: MarkAsSeenCommand): Promise<void> {

    const { success, data: validatedInput, error } = markAsSeenDTOSchema.safeParse(command);

    if (!success) {
      throw new Error('Invalid data');
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.userId
    });

    if (!member || member.leftAt) {
      throw AppError.from(new Error('Unauthorized: You are not a member of this conversation'), 403);
    }

    const message = await this.messageQueryRepo.get(validatedInput.lastSeenMessageId);
    if (!message || message.conversationId !== validatedInput.conversationId) {
      throw AppError.from(new Error('Message not found'), 404);
    }

    const currentUnreadCount = member.unreadCount || 0;
    let newUnreadCount = 0;

    if (currentUnreadCount > 0) {
      const unreadAfterLastSeen = await this.messageQueryRepo.countUnreadAfter(
        validatedInput.conversationId,
        validatedInput.lastSeenMessageId,
      );
      newUnreadCount = unreadAfterLastSeen;
    }

    console.debug(`[markAsSeen] conversationId=${validatedInput.conversationId}, userId=${validatedInput.userId}, lastSeenMessageId=${validatedInput.lastSeenMessageId}, oldUnreadCount=${currentUnreadCount}, newUnreadCount=${newUnreadCount}`);

    await this.conversationMemberCommandRepo.update(member.id, {
      lastSeenMessageId: validatedInput.lastSeenMessageId,
      unreadCount: newUnreadCount,
    });
  }
}
