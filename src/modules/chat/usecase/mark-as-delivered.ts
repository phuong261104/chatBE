import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageQueryRepository
} from '../interface';
import { markAsDeliveredDTOSchema, MarkAsDeliveredCommand } from '../model/dto';

export class MarkAsDeliveredHandler implements ICommandHandler<MarkAsDeliveredCommand, void> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageQueryRepo: IMessageQueryRepository
  ) {}

  async execute(command: MarkAsDeliveredCommand): Promise<void> {

    const { success, data: validatedInput, error } = markAsDeliveredDTOSchema.safeParse(command);

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

    const message = await this.messageQueryRepo.get(validatedInput.lastDeliveredMessageId);
    if (!message || message.conversationId !== validatedInput.conversationId) {
      throw AppError.from(new Error('Message not found'), 404);
    }

    await this.conversationMemberCommandRepo.update(member.id, {
      lastDeliveredMessageId: validatedInput.lastDeliveredMessageId
    });
  }
}
