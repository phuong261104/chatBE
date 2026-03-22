import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import { Message, MessageType } from "../model/model";
import { revokeMessageDTOSchema, RevokeMessageCommand } from "../model/dto";
import {
  ErrMessageAlreadyDeleted,
  ErrMessageNotFound,
  ErrMessageUnauthorized,
  ErrNotMember,
} from "../model/errors";

export class RevokeMessageHandler implements ICommandHandler<
  RevokeMessageCommand,
  Message
> {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(command: RevokeMessageCommand): Promise<Message> {
    const { success, data, error } = revokeMessageDTOSchema.safeParse(command);

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

    if (message.senderId !== data.userId) {
      throw AppError.from(ErrMessageUnauthorized, 403);
    }

    if (message.deletedAt) {
      throw AppError.from(ErrMessageAlreadyDeleted, 400);
    }

    const revokedAt = new Date();

    await this.messageCommandRepo.update(message.id, {
      type: MessageType.SYSTEM,
      text: "Đã thu hồi",
      media: [],
      deletedAt: revokedAt,
    });

    return {
      ...message,
      type: MessageType.SYSTEM,
      text: "Đã thu hồi",
      media: [],
      deletedAt: revokedAt,
    };
  }
}
