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
import { revokeMessageDTOSchema, RevokeMessageCommand } from "../model/dto";
import {
  ErrMessageAlreadyDeleted,
  ErrMessageNotFound,
  ErrMessageRecallTimeExpired,
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
    private readonly classificationRepo: IMessageClassificationRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
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

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrNotMember, 403);
    }

    if (message.senderId !== data.userId) {
      throw AppError.from(ErrMessageUnauthorized, 403);
    }

    if (message.deletedAt || message.messageStatus === MessageStatus.REVOKED) {
      throw AppError.from(ErrMessageAlreadyDeleted, 400);
    }

    const createdAt = new Date(message.createdAt).getTime();
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (now - createdAt > ONE_DAY_MS) {
      throw AppError.from(ErrMessageRecallTimeExpired, 403);
    }

    const revokedAt = new Date();
    const tombstoneText = "Tin nhắn đã được thu hồi";

    await this.messageCommandRepo.update(message.id, {
      text: tombstoneText,
      media: [],
      links: [],
      messageStatus: MessageStatus.REVOKED,
      deletedBy: data.userId,
      revokedAt,
      deletedAt: revokedAt,
    });

    await this.classificationRepo.deleteByMessageId(message.id);

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
      deletedBy: data.userId,
      revokedAt,
      deletedAt: revokedAt,
    };
  }
}
