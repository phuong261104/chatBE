import { v7 } from "uuid";
import {
  IMessageReactionQueryRepository,
  IMessageReactionCommandRepository,
  IMessageQueryRepository,
  IConversationMemberQueryRepository,
} from "@modules/chat/interface";
import {
  AddReactionCommand,
  ReactionResult,
} from "@modules/chat/model/dto";
import { MessageReaction } from "@modules/chat/model/model";

export class AddReactionHandler {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly reactionQueryRepo: IMessageReactionQueryRepository,
    private readonly reactionCmdRepo: IMessageReactionCommandRepository,
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(command: AddReactionCommand): Promise<MessageReaction> {
    const message = await this.messageQueryRepo.get(command.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: message.conversationId,
      userId: command.userId,
    });
    if (!member) {
      throw new Error("User is not a member of this conversation");
    }

    const reaction: MessageReaction = {
      id: v7(),
      messageId: command.messageId,
      userId: command.userId,
      emoji: command.emoji,
      count: 1,
      createdAt: new Date(),
    };

    const result = await this.reactionCmdRepo.upsertReaction(reaction);
    return result;
  }
}

export class RemoveReactionHandler {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly reactionCmdRepo: IMessageReactionCommandRepository,
  ) {}

  async execute(messageId: string, userId: string, emoji?: string): Promise<number> {
    const message = await this.messageQueryRepo.get(messageId);
    if (!message) {
      throw new Error("Message not found");
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
  ) {}

  async execute(messageId: string, userId: string): Promise<number> {
    const message = await this.messageQueryRepo.get(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    return this.reactionCmdRepo.deleteAllByUserAndMessage(messageId, userId);
  }
}

export class GetReactionsHandler {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly reactionQueryRepo: IMessageReactionQueryRepository,
  ) {}

  async execute(messageId: string): Promise<ReactionResult> {
    const message = await this.messageQueryRepo.get(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const [reactions, grouped] = await Promise.all([
      this.reactionQueryRepo.findByMessageId(messageId),
      this.reactionQueryRepo.getReactionSummary(messageId),
    ]);

    return { reactions, grouped };
  }
}
