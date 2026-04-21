import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationMemberQueryRepository,
  IMessageQueryRepository,
} from "../interface";
import { GetConversationStatisticsDTO, ConversationStatistics } from "../model/dto/conversation-statistics-dto";

export class GetConversationStatisticsQueryHandler
  implements IQueryHandler<GetConversationStatisticsDTO, ConversationStatistics>
{
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
  ) {}

  async query(query: GetConversationStatisticsDTO): Promise<ConversationStatistics> {
    const { conversationId, userId } = query;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const conversation = await this.conversationQueryRepo.get(conversationId);
    if (!conversation) {
      throw AppError.from(new Error("Conversation not found"), 404);
    }

    const allMembers = await this.conversationMemberQueryRepo.listByConversationId(conversationId);
    const activeMembers = allMembers.filter((m) => !m.leftAt);

    let messageCount = 0;
    let lastActivity: Date | null = null;

    try {
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const messages = await this.messageQueryRepo.list(
          { conversationId },
          { page, limit: 100 }
        );
        if (messages.length === 0) {
          hasMore = false;
        } else {
          messageCount += messages.length;
          if (page === 1 && messages.length > 0) {
            lastActivity = messages[0].createdAt;
          }
          hasMore = messages.length === 100;
          page++;
          if (page > 100) {
            hasMore = false;
          }
        }
      }
    } catch {
      // Messages table may be empty
    }

    return {
      messageCount,
      memberCount: allMembers.length,
      activeMemberCount: activeMembers.length,
      lastActivity,
      createdAt: conversation.createdAt,
    };
  }
}
