import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
  IMessageClassificationRepository,
  IConversationQueryRepository,
  IConversationCommandRepository,
} from "../interface";
import { ConversationMemberStatus, Message, MessageStatus } from "../model/model";
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
    private readonly classificationRepo: IMessageClassificationRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
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

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrNotMember, 403);
    }

    if (message.senderId !== userId) {
      throw AppError.from(ErrMessageUnauthorized, 403);
    }

    if (message.deletedAt || message.messageStatus === MessageStatus.REVOKED) {
      throw AppError.from(new Error("Message is already deleted"), 400);
    }

    const createdAtMs = new Date(message.createdAt).getTime();
    const nowMs = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (nowMs - createdAtMs > ONE_DAY_MS) {
      throw AppError.from(ErrMessageRecallTimeExpired, 403);
    }

    const deletedAt = new Date();
    const tombstoneText = "Tin nhắn đã được thu hồi";

    await this.messageCommandRepo.update(messageId, {
      text: tombstoneText,
      media: [],
      links: [],
      messageStatus: MessageStatus.REVOKED,
      deletedBy: userId,
      revokedAt: deletedAt,
      deletedAt,
    });

    await this.classificationRepo.deleteByMessageId(messageId);

    const conversation = await this.conversationQueryRepo.get(message.conversationId);
    if (conversation?.lastMessage?.messageId === message.id) {
      await this.conversationCommandRepo.update(message.conversationId, {
        lastMessage: {
          messageId: message.id,
          senderId: message.senderId,
          type: message.type,
          textPreview: tombstoneText,
          createdAt: message.createdAt,
        },
        lastMessageAt: message.createdAt,
      });
    }

    return {
      ...message,
      text: tombstoneText,
      media: [],
      links: [],
      messageStatus: MessageStatus.REVOKED,
      deletedBy: userId,
      revokedAt: deletedAt,
      deletedAt,
    };
  }
}
