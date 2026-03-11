import { IQueryHandler } from '@share/interface';
import { PagingDTO } from '@share/model/paging';
import { IConversationMemberQueryRepository } from '../interface';
import { GetTotalUnreadCountQuery } from '../model/dto';

export class GetTotalUnreadCountQueryHandler implements IQueryHandler<GetTotalUnreadCountQuery, number> {
  constructor(private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository) {}

  async query(query: GetTotalUnreadCountQuery): Promise<number> {

    const members = await this.conversationMemberQueryRepo.list({ userId: query.userId }, { page: 1, limit: 1000 });

    const activeMembers = members.filter((member) => !member.leftAt && !member.archived);

    const totalUnread = activeMembers.reduce((sum, member) => sum + (member.unreadCount || 0), 0);

    return totalUnread;
  }
}
