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
} from "../interface";
import { Message, MessageType } from "../model/model";
import { forwardMessagesDTOSchema, ForwardMessagesCommand } from "../model/dto";
import {
  ErrConversationNotFound,
  ErrInvalidMessageType,
  ErrMessageNotFound,
  ErrMessageUnauthorized,
  ErrNotMember,
} from "../model/errors";

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

    for (const conversationId of uniqueTargetIds) {
      await this.ensureConversationMember(conversationId, data.userId);

      for (const sourceMessage of sourceMessages) {
        const now = new Date();
        const newMessage: Message = {
          id: v7(),
          conversationId,
          senderId: data.userId,
          type: sourceMessage.type,
          text: sourceMessage.text,
          media: sourceMessage.media,
          createdAt: now,
          pinned: false,
        };

        await this.messageCommandRepo.insert(newMessage);

        await this.conversationCommandRepo.update(conversationId, {
          lastMessage: {
            messageId: newMessage.id,
            senderId: data.userId,
            type: newMessage.type,
            textPreview: this.getTextPreview(newMessage),
            createdAt: now,
          },
          lastMessageAt: now,
        });

        await this.increaseUnreadForOtherMembers(conversationId, data.userId);

        result.push(newMessage);
      }
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

      if (message.deletedAt) {
        throw AppError.from(ErrMessageUnauthorized, 400);
      }

      if (
        ![MessageType.TEXT, MessageType.IMAGE, MessageType.FILE].includes(
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

    if (!member || member.leftAt) {
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

  private async increaseUnreadForOtherMembers(
    conversationId: string,
    senderId: string,
  ): Promise<void> {
    const members = await this.conversationMemberQueryRepo.list(
      { conversationId },
      { page: 1, limit: 200 },
    );

    for (const member of members) {
      if (member.userId === senderId || member.leftAt) {
        continue;
      }

      await this.conversationMemberCommandRepo.update(member.id, {
        unreadCount: (member.unreadCount || 0) + 1,
      });
    }
  }
}
