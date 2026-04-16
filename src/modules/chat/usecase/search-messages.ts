import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IMessageQueryRepository,
} from "../interface";
import { Message } from "../model/model";
import { SearchMessagesResult } from "../model/dto/search-dto";

export class SearchMessagesHandler
  implements IQueryHandler<{ conversationId: string; query: string; cursor?: string; limit: number; userId: string }, SearchMessagesResult>
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
  }): Promise<SearchMessagesResult> {
    const { conversationId, query: searchQuery, cursor, limit, userId } = query;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const allMessages = await this.messageQueryRepo.list(
      { conversationId },
      { page: 1, limit: 1000 }
    );

    const lowerQuery = searchQuery.toLowerCase();
    const filteredMessages = allMessages.filter((msg) => {
      if (msg.deletedAt) return false;
      if (msg.deletedForUserIds?.includes(userId)) return false;
      if (msg.text && msg.text.toLowerCase().includes(lowerQuery)) return true;
      if (msg.senderId.toLowerCase().includes(lowerQuery)) return true;
      return false;
    });

    const sortedMessages = filteredMessages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    let startIndex = 0;
    if (cursor) {
      const decoded = Buffer.from(cursor, "base64").toString("utf-8");
      const cursorTime = new Date(decoded).getTime();
      const idx = sortedMessages.findIndex(
        (m) => m.createdAt.getTime() === cursorTime
      );
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    const pageMessages = sortedMessages.slice(startIndex, startIndex + limit + 1);
    const hasMore = pageMessages.length > limit;
    const results = hasMore ? pageMessages.slice(0, limit) : pageMessages;

    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastMsg = results[results.length - 1];
      nextCursor = Buffer.from(lastMsg.createdAt.toISOString()).toString("base64");
    }

    return {
      messages: results,
      nextCursor,
      hasMore,
      total: filteredMessages.length,
    };
  }
}
