import { v7 } from "uuid";
import { AppError } from "@share/app-error";
import {
  IMessageReactionQueryRepository,
  IMessageReactionCommandRepository,
  IMessageQueryRepository,
  IConversationMemberQueryRepository,
  IUserQueryRepository,
} from "@modules/chat/interface";
import { AddReactionCommand, ReactionResult } from "@modules/chat/model/dto";
import { ConversationMemberStatus, MessageReaction, MessageStatus } from "@modules/chat/model/model";

export class AddReactionHandler {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly reactionQueryRepo: IMessageReactionQueryRepository,
    private readonly reactionCmdRepo: IMessageReactionCommandRepository,
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly userQueryRepo: IUserQueryRepository,
  ) {}

  async execute(command: AddReactionCommand): Promise<MessageReaction> {
    const message = await this.messageQueryRepo.get(command.messageId);
    if (!message) {
      throw AppError.from(new Error("Message not found"), 404);
    }
    if (
      message.messageStatus === MessageStatus.REVOKED ||
      message.deletedAt ||
      message.deletedForUserIds?.includes(command.userId)
    ) {
      throw AppError.from(new Error("Message cannot be reacted to"), 400);
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: message.conversationId,
      userId: command.userId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("User is not an active member of this conversation"), 403);
    }

    const user = await this.userQueryRepo.get(command.userId);

    const reaction: MessageReaction = {
      id: v7(),
      messageId: command.messageId,
      userId: command.userId,
      emoji: command.emoji,
      count: 1,
      createdAt: new Date(),
      user: user
        ? {
            id: user.id,
            avatarUrl: user.avatarUrl || undefined,
            displayName: user.displayName || "Unknown User",
          }
        : undefined,
    };

    const result = await this.reactionCmdRepo.upsertReaction(reaction);
    return result;
  }
}

export class RemoveReactionHandler {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly reactionCmdRepo: IMessageReactionCommandRepository,
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(messageId: string, userId: string, emoji?: string): Promise<number> {
    const message = await this.messageQueryRepo.get(messageId);
    if (!message) {
      throw AppError.from(new Error("Message not found"), 404);
    }
    if (
      message.messageStatus === MessageStatus.REVOKED ||
      message.deletedAt ||
      message.deletedForUserIds?.includes(userId)
    ) {
      throw AppError.from(new Error("Message cannot be reacted to"), 400);
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: message.conversationId,
      userId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("User is not an active member of this conversation"), 403);
    }

    if (emoji) {
      const success = await this.reactionCmdRepo.decrementReaction(messageId, userId, emoji);
      return success ? 1 : 0;
    }

    return this.reactionCmdRepo.decrementAllByUserAndMessage(messageId, userId);
  }
}

export class RemoveAllReactionsHandler {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly reactionCmdRepo: IMessageReactionCommandRepository,
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(messageId: string, userId: string): Promise<number> {
    const message = await this.messageQueryRepo.get(messageId);
    if (!message) {
      throw AppError.from(new Error("Message not found"), 404);
    }
    if (
      message.messageStatus === MessageStatus.REVOKED ||
      message.deletedAt ||
      message.deletedForUserIds?.includes(userId)
    ) {
      throw AppError.from(new Error("Message cannot be reacted to"), 400);
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: message.conversationId,
      userId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("User is not an active member of this conversation"), 403);
    }

    return this.reactionCmdRepo.deleteAllByUserAndMessage(messageId, userId);
  }
}

export class GetReactionsHandler {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly reactionQueryRepo: IMessageReactionQueryRepository,
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly userQueryRepo: IUserQueryRepository,
  ) {}

  async execute(messageId: string, userId: string): Promise<ReactionResult> {
    const message = await this.messageQueryRepo.get(messageId);
    if (!message) {
      throw AppError.from(new Error("Message not found"), 404);
    }
    if (message.deletedForUserIds?.includes(userId)) {
      throw AppError.from(new Error("Message not found"), 404);
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: message.conversationId,
      userId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("User is not an active member of this conversation"), 403);
    }

    const [reactions, grouped] = await Promise.all([
      this.reactionQueryRepo.findByMessageId(messageId),
      this.reactionQueryRepo.getReactionSummary(messageId),
    ]);

    // Nạp data user
    if (reactions) {
      await Promise.all(
        reactions.map(async (r) => {
          if (!r.user || !r.user.avatarUrl) {
            const user = await this.userQueryRepo.get(r.userId);
            if (user) {
              r.user = {
                id: user.id,
                avatarUrl: user.avatarUrl || undefined,
                displayName: user.displayName || "Unknown User",
              };
            }
          }
        }),
      );
    }

    return { reactions, grouped };
  }
}
