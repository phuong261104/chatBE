import { IQueryHandler } from '@share/interface';
import { PagingDTO } from '@share/model/paging';
import { IConversationMemberQueryRepository } from '../interface';
import { GetConversationMembersQuery } from '../model/dto';

export class GetConversationMembersQueryHandler implements IQueryHandler<GetConversationMembersQuery, string[]> {
  constructor(private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository) {}

  async query(query: GetConversationMembersQuery): Promise<string[]> {

    const members = await this.conversationMemberQueryRepo.list(
      { conversationId: query.conversationId },
      { page: 1, limit: 1000 }
    );

    const activeMembers = members.filter(
      (member) => !member.leftAt && (!query.excludeUserId || member.userId !== query.excludeUserId)
    );

    return activeMembers.map((member) => member.userId);
  }
}
