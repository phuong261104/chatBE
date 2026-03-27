import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { Message } from "../model/model";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import {
  pinMessageDTOSchema,
  PinMessageCommand,
} from "../model/dto";
import { ErrMessageNotFound, ErrNotMember, ErrMessageAlreadyPinned } from "../model/errors";

const MAX_PINNED_MESSAGES_PER_CONVERSATION = 20;

export class PinMessageHandler
  implements ICommandHandler<PinMessageCommand, Message>
{
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(command: PinMessageCommand) {
    const { success, data, error } = pinMessageDTOSchema.safeParse(command);

    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail(
        "validationErrors",
        error.errors,
      );
    }

    const message = await this.messageQueryRepo.get(data.messageId);
    if (!message) {
      throw AppError.from(ErrMessageNotFound, 404);
    }

    if (message.deletedAt) {
      throw AppError.from(ErrMessageNotFound, 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: message.conversationId,
      userId: data.userId,
    });

    if (!member || member.leftAt) {
      throw AppError.from(ErrNotMember, 403);
    }

    if (message.pinned) {
      throw AppError.from(ErrMessageAlreadyPinned, 400);
    }

    const pinnedMessages = await this.messageQueryRepo.findPinnedMessages(
      message.conversationId,
    );

    if (pinnedMessages.length >= MAX_PINNED_MESSAGES_PER_CONVERSATION) {
      throw AppError.from(
        new Error(
          `Maximum ${MAX_PINNED_MESSAGES_PER_CONVERSATION} pinned messages per conversation`,
        ),
        400,
      );
    }

    const pinnedAt = new Date();
    await this.messageCommandRepo.update(message.id, {
      pinned: true,
      pinnedAt,
    });

    return {
      ...message,
      pinned: true,
      pinnedAt,
    };
  }
}
