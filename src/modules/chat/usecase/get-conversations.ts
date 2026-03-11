import { IQueryHandler } from '@share/interface';
import { PagingDTO } from '@share/model/paging';
import { IConversationQueryRepository, IConversationMemberQueryRepository } from '../interface';
import { Conversation, ConversationMemberRole } from '../model/model';
import { GetConversationsQuery, ConversationWithMetadata } from '../model/dto';

export class GetConversationsQueryHandler implements IQueryHandler<GetConversationsQuery, ConversationWithMetadata[]> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository
  ) {}

  async query(query: GetConversationsQuery): Promise<ConversationWithMetadata[]> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const members = await this.conversationMemberQueryRepo.list({ userId: query.userId }, { page, limit });

    const activeMembers = members.filter((member) => !member.leftAt);

    if (activeMembers.length === 0) {
      return [];
    }

    const conversationIds = activeMembers.map((member) => member.conversationId);

    const conversations: Conversation[] = await this.conversationQueryRepo.listByIds(conversationIds);

    const memberMap = new Map(activeMembers.map((m) => [m.conversationId, m]));

    const result: ConversationWithMetadata[] = conversations.map((conv) => {
      const member = memberMap.get(conv.id);
      return {
        ...conv,
        unreadCount: member?.unreadCount || 0,
        role: member?.role || ConversationMemberRole.MEMBER
      };
    });

    result.sort((a, b) => {
      const timeA = a.lastMessageAt?.getTime() || a.createdAt.getTime();
      const timeB = b.lastMessageAt?.getTime() || b.createdAt.getTime();
      return timeB - timeA;
    });

    return result;
  }
}
