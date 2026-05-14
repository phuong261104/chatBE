import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageQueryRepository,
  IMessageCommandRepository,
  IMessageClassificationRepository,
} from "../interface";
import {
  ConversationMemberStatus,
  Message,
  MessageStatus,
  MessageType,
  MessageClassification,
  ClassificationType,
} from "../model/model";
import { forwardMessagesDTOSchema, ForwardMessagesCommand } from "../model/dto";
import {
  ErrConversationNotFound,
  ErrInvalidMessageType,
  ErrMessageNotFound,
  ErrMessageUnauthorized,
  ErrNotMember,
} from "../model/errors";

function extractLinks(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(https?:\/\/[^\s]+)/g);
  return matches || [];
}

export class ForwardMessagesHandler implements ICommandHandler<
  ForwardMessagesCommand,
  Message[]
> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly classificationRepo: IMessageClassificationRepository,
  ) {}

  async execute(command: ForwardMessagesCommand): Promise<Message[]> {
    const { success, data, error } =
      forwardMessagesDTOSchema.safeParse(command);

    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail(
        "validationErrors",
        error.errors,
      );
    }

    const sourceMessages = await this.loadAndValidateSourceMessages(
      data.userId,
      data.messageIds,
    );

    const uniqueTargetIds = Array.from(new Set(data.targetConversationIds));
    const result: Message[] = [];
    const now = new Date();

    for (const conversationId of uniqueTargetIds) {
      await this.ensureConversationMember(conversationId, data.userId);

      const messagesToInsert: Message[] = sourceMessages.map((sourceMessage) => {
        const type = sourceMessage.type === MessageType.TEXT && extractLinks(sourceMessage.text || "").length > 0
          ? MessageType.LINK
          : sourceMessage.type;
        return {
          id: v7(),
          conversationId,
          senderId: data.userId,
          type,
          text: sourceMessage.text,
          media: sourceMessage.media,
          links: type === MessageType.LINK ? extractLinks(sourceMessage.text || "") : undefined,
          forwardedFrom: sourceMessage.conversationId,
          forwardedFromMessageId: sourceMessage.id,
          createdAt: now,
          pinned: false,
        } as Message;
      });

      await this.messageCommandRepo.batchInsert(messagesToInsert);

      const classifications: MessageClassification[] = [];
      for (const msg of messagesToInsert) {
        if (msg.media && msg.media.length > 0) {
          for (const media of msg.media) {
            const type = media.mediaType === "image" ? ClassificationType.IMAGE : ClassificationType.FILE;
            classifications.push({
              id: v7(),
              conversationId,
              type,
              senderId: data.userId,
              url: media.url,
              name: media.name,
              messageId: msg.id,
              createdAt: now,
            });
          }
        }
        if (msg.type === MessageType.LINK && msg.links && msg.links.length > 0) {
          for (const url of msg.links) {
            classifications.push({
              id: v7(),
              conversationId,
              type: ClassificationType.LINK,
              senderId: data.userId,
              linkUrl: url,
              messageId: msg.id,
              createdAt: now,
            });
          }
        }
      }

      if (classifications.length > 0) {
        await this.classificationRepo.insertBatch(classifications);
      }

      const lastMessage = messagesToInsert[messagesToInsert.length - 1];
      await this.conversationCommandRepo.update(conversationId, {
        lastMessage: {
          messageId: lastMessage.id,
          senderId: data.userId,
          type: lastMessage.type,
          textPreview: this.getTextPreview(lastMessage),
          createdAt: now,
        },
        lastMessageAt: now,
      });

      await this.conversationMemberCommandRepo.incrementUnreadCountForConversation(conversationId, data.userId);

      result.push(...messagesToInsert);
    }

    return result;
  }

  private async loadAndValidateSourceMessages(
    userId: string,
    messageIds: string[],
  ): Promise<Message[]> {
    const uniqueMessageIds = Array.from(new Set(messageIds));
    const messages: Message[] = [];

    for (const messageId of uniqueMessageIds) {
      const message = await this.messageQueryRepo.get(messageId);
      if (!message) {
        throw AppError.from(ErrMessageNotFound, 404);
      }

      await this.ensureConversationMember(message.conversationId, userId);

      if (
        message.deletedAt ||
        message.messageStatus === MessageStatus.REVOKED ||
        message.deletedForUserIds?.includes(userId)
      ) {
        throw AppError.from(ErrMessageUnauthorized, 400);
      }

      if (
        ![MessageType.TEXT, MessageType.IMAGE, MessageType.FILE, MessageType.LINK].includes(
          message.type,
        )
      ) {
        throw AppError.from(ErrInvalidMessageType, 400);
      }

      messages.push(message);
    }

    return messages;
  }

  private async ensureConversationMember(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await this.conversationQueryRepo.get(conversationId);
    if (!conversation) {
      throw AppError.from(ErrConversationNotFound, 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrNotMember, 403);
    }
  }

  private getTextPreview(message: Message): string {
    if (message.text) {
      return message.text.substring(0, 100);
    }

    if (message.type === MessageType.IMAGE) {
      return "📷 Image";
    }

    if (message.type === MessageType.FILE) {
      return "📎 File";
    }

    return "Forwarded message";
  }

}
