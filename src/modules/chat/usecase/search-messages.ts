import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IMessageQueryRepository,
} from "../interface";
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

    return this.messageQueryRepo.searchMessages(
      conversationId,
      userId,
      searchQuery,
      cursor,
      limit,
    );
  }
}
