import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import { Message, MessageType } from "../model/model";
import { DeleteMessageForEveryoneDTO } from "../model/dto";
import {
  ErrMessageNotFound,
  ErrMessageRecallTimeExpired,
  ErrMessageUnauthorized,
  ErrNotMember,
} from "../model/errors";

export class DeleteMessageForEveryoneHandler implements ICommandHandler<
  DeleteMessageForEveryoneDTO,
  Message
> {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(dto: DeleteMessageForEveryoneDTO): Promise<Message> {
    const { messageId, userId } = dto;

    const message = await this.messageQueryRepo.get(messageId);
    if (!message) {
      throw AppError.from(ErrMessageNotFound, 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: message.conversationId,
      userId,
    });

    if (!member || member.leftAt) {
      throw AppError.from(ErrNotMember, 403);
    }

    if (message.senderId !== userId) {
      throw AppError.from(ErrMessageUnauthorized, 403);
    }

    if (message.deletedAt) {
      throw AppError.from(new Error("Message is already deleted"), 400);
    }

    const createdAtMs = new Date(message.createdAt).getTime();
    const nowMs = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (nowMs - createdAtMs > ONE_DAY_MS) {
      throw AppError.from(ErrMessageRecallTimeExpired, 403);
    }

    const deletedAt = new Date();

    await this.messageCommandRepo.update(messageId, {
      type: MessageType.SYSTEM,
      text: "Tin nhắn đã bị xóa",
      media: [],
      deletedAt,
    });

    return {
      ...message,
      type: MessageType.SYSTEM,
      text: "Tin nhắn đã bị xóa",
      media: [],
      deletedAt,
    };
  }
}
