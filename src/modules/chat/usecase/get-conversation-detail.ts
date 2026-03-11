import { IQueryHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { PagingDTO } from '@share/model/paging';
import { IConversationQueryRepository, IConversationMemberQueryRepository } from '../interface';
import { Conversation, ConversationMember, ConversationMemberRole } from '../model/model';
import { GetConversationDetailQuery, ConversationDetail } from '../model/dto';

export class GetConversationDetailQueryHandler implements IQueryHandler<
  GetConversationDetailQuery,
  ConversationDetail
> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository
  ) {}

  async query(query: GetConversationDetailQuery): Promise<ConversationDetail> {

    const conversation = await this.conversationQueryRepo.get(query.conversationId);
    if (!conversation) {
      throw AppError.from(new Error('Conversation not found'), 404);
    }

    const currentUserMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: query.conversationId,
      userId: query.userId
    });

    if (!currentUserMember || currentUserMember.leftAt) {
      throw AppError.from(new Error('Unauthorized: You are not a member of this conversation'), 403);
    }

    const allMembers = await this.conversationMemberQueryRepo.list(
      { conversationId: query.conversationId },
      { page: 1, limit: 1000 }
    );

    const activeMembers = allMembers.filter((member) => !member.leftAt);

    return {
      conversation,
      members: activeMembers,
      currentUserRole: currentUserMember.role
    };
  }
}
