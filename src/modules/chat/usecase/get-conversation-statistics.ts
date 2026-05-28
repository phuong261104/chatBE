import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationMemberQueryRepository,
  IMessageQueryRepository,
} from "../interface";
import { GetConversationStatisticsDTO, ConversationStatistics } from "../model/dto/conversation-statistics-dto";
import { ConversationMemberStatus } from "../model/model";

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

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const conversation = await this.conversationQueryRepo.get(conversationId);
    if (!conversation) {
      throw AppError.from(new Error("Conversation not found"), 404);
    }

    const allMembers = await this.conversationMemberQueryRepo.listByConversationId(conversationId);
    const activeMembers = allMembers.filter(
      (m) => m.status === ConversationMemberStatus.ACTIVE && !m.leftAt,
    );

    let lastActivity: Date | null = null;

    try {
      const messages = await this.messageQueryRepo.list(
        { conversationId },
        { page: 1, limit: 1 }
      );
      if (messages.length > 0) {
        lastActivity = messages[0].createdAt;
      }
    } catch {
      // Messages table may be empty
    }

    return {
      memberCount: allMembers.length,
      activeMemberCount: activeMembers.length,
      lastActivity,
      createdAt: conversation.createdAt,
    };
  }
}
