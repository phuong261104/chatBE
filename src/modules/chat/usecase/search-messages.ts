import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IMessageQueryRepository,
} from "../interface";
import { Message } from "../model";
import { SearchMessagesResult } from "../model/dto/search-dto";
import { ConversationMemberStatus } from "../model/model";
import { parseSearchDate, parseSearchEndDate } from "@modules/search/model";

export class SearchMessagesHandler
  implements IQueryHandler<{
    conversationId: string;
    query: string;
    cursor?: string;
    limit: number;
    userId: string;
    from?: string;
    to?: string;
    senderId?: string;
    contextLimit?: number;
  }, SearchMessagesResult>
{
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
  ) {}

  async query(query: {
    conversationId: string;
    query: string;
    cursor?: string;
    limit: number;
    userId: string;
    from?: string;
    to?: string;
    senderId?: string;
    contextLimit?: number;
  }): Promise<SearchMessagesResult> {
    const { conversationId, query: searchQuery, cursor, limit, userId } = query;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const from = parseSearchDate(query.from);
    const to = parseSearchEndDate(query.to);

    const result = await this.messageQueryRepo.searchMessages(
      conversationId,
      userId,
      searchQuery,
      cursor,
      limit,
      { from, to, hiddenAfter: member.hiddenAt, senderId: query.senderId },
    );

    const contextLimit = query.contextLimit ?? 1;
    if (contextLimit <= 0 || result.messages.length === 0) return result;

    const visibleMessages = (await this.messageQueryRepo.listWithCursor(
      conversationId,
      undefined,
      2000,
      userId,
    )).filter((message) => this.isVisibleMessage(message, userId, member.hiddenAt));

    return {
      ...result,
      messages: result.messages.map((message: Message) => {
        const index = visibleMessages.findIndex((item) => item.id === message.id);
        if (index < 0) return message;
        const after = visibleMessages
          .slice(Math.max(0, index - contextLimit), index)
          .reverse();
        const before = visibleMessages
          .slice(index + 1, index + 1 + contextLimit)
          .reverse();
        return {
          ...message,
          context: { before, after },
        };
      }),
    };
  }

  private isVisibleMessage(message: Message, userId: string, hiddenAt?: Date): boolean {
    if (message.messageStatus === "revoked" || message.deletedAt) return false;
    if (message.deletedForUserIds?.includes(userId)) return false;
    if (message.expireAtEpoch && message.expireAtEpoch <= Math.floor(Date.now() / 1000)) return false;
    if (hiddenAt && message.createdAt <= hiddenAt) return false;
    return true;
  }
}
