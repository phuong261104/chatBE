import { ICommandHandler, IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageQueryRepository,
  IMessageCommandRepository,
} from "../interface";

export class GetReadReceiptsHandler implements IQueryHandler<{ messageId: string; userId: string }, { userId: string; readAt: Date }[]> {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: { messageId: string; userId: string }): Promise<{ userId: string; readAt: Date }[]> {
    const { messageId, userId } = query;

    const message = await this.messageQueryRepo.get(messageId);
    if (!message) {
      throw AppError.from(new Error("Message not found"), 404);
    }

    const readBy = (message as any).readBy || [];
    return readBy
      .filter((receipt: any) => receipt.userId !== message.senderId)
      .map((receipt: any) => ({
        userId: receipt.userId,
        readAt: new Date(receipt.readAt),
      }));
  }
}

export class MarkMultipleAsReadHandler implements ICommandHandler<{
  conversationId: string;
  userId: string;
  messageIds: string[];
}, void> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
  ) {}

  async execute(command: {
    conversationId: string;
    userId: string;
    messageIds: string[];
  }): Promise<void> {
    const { conversationId, userId, messageIds } = command;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const now = new Date();
    let lastReadMessageId: string | undefined;
    let lastReadMessageCreatedAt: Date | undefined;

    for (const messageId of messageIds) {
      const message = await this.messageQueryRepo.get(messageId);
      if (!message) continue;
      if (message.conversationId !== conversationId) continue;
      if (message.senderId === userId) continue;

      const readBy = (message as any).readBy || [];
      const alreadyRead = readBy.some((r: any) => r.userId === userId);
      if (alreadyRead) continue;

      readBy.push({ userId, readAt: now.toISOString() });

      await this.messageCommandRepo.update(messageId, {
        readBy,
      } as any);

      const messageCreatedAt = new Date(message.createdAt);
      if (!lastReadMessageId || !lastReadMessageCreatedAt || messageCreatedAt > lastReadMessageCreatedAt) {
        lastReadMessageId = messageId;
        lastReadMessageCreatedAt = messageCreatedAt;
      }
    }

    if (lastReadMessageId) {
      await this.conversationMemberCommandRepo.update(member.id, {
        lastSeenMessageId: lastReadMessageId,
        unreadCount: 0,
      } as any);
    }
  }
}
