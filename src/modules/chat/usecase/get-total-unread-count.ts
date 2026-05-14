import { IQueryHandler } from '@share/interface';
import { IConversationMemberQueryRepository } from '../interface';
import { GetTotalUnreadCountQuery } from '../model/dto';
import { ConversationMemberStatus } from '../model/model';

export class GetTotalUnreadCountQueryHandler implements IQueryHandler<GetTotalUnreadCountQuery, number> {
  constructor(private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository) {}

  async query(query: GetTotalUnreadCountQuery): Promise<number> {

    const members = await this.conversationMemberQueryRepo.list({ userId: query.userId }, { page: 1, limit: 1000 });

    const activeMembers = members.filter(
      (member) =>
        member.status === ConversationMemberStatus.ACTIVE &&
        !member.leftAt &&
        !member.archived,
    );

    const totalUnread = activeMembers.reduce((sum, member) => sum + (member.unreadCount || 0), 0);

    return totalUnread;
  }
}
