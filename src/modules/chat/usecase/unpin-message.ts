import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { Message } from "../model/model";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import {
  unpinMessageDTOSchema,
  UnpinMessageCommand,
} from "../model/dto";
import { ErrMessageNotFound, ErrNotMember, ErrMessageNotPinned } from "../model/errors";

export class UnpinMessageHandler
  implements ICommandHandler<UnpinMessageCommand, Message>
{
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(command: UnpinMessageCommand) {
    const { success, data, error } = unpinMessageDTOSchema.safeParse(command);

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

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: message.conversationId,
      userId: data.userId,
    });

    if (!member || member.leftAt) {
      throw AppError.from(ErrNotMember, 403);
    }

    if (!message.pinned) {
      throw AppError.from(ErrMessageNotPinned, 400);
    }

    await this.messageCommandRepo.update(message.id, {
      pinned: false,
    });

    return {
      ...message,
      pinned: false,
    };
  }
}
