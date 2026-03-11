import { IQueryHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { PagingDTO } from '@share/model/paging';
import { IConversationQueryRepository, IConversationMemberQueryRepository } from '../interface';
import { ConversationMember, ConversationType } from '../model/model';
import { getGroupMembersDTOSchema, GetGroupMembersQuery } from '../model/dto';

export class GetGroupMembersQueryHandler implements IQueryHandler<GetGroupMembersQuery, ConversationMember[]> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository
  ) {}

  async query(query: GetGroupMembersQuery): Promise<ConversationMember[]> {

    const { success, data: validatedInput, error } = getGroupMembersDTOSchema.safeParse(query);

    if (!success) {
      throw new Error('Invalid data');
    }

    const conversation = await this.conversationQueryRepo.get(validatedInput.conversationId);
    if (!conversation) {
      throw AppError.from(new Error('Conversation not found'), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error('Only group conversations have members'), 400);
    }

    const currentUserMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.userId
    });

    if (!currentUserMember || currentUserMember.leftAt) {
      throw AppError.from(new Error('Unauthorized: You are not a member of this group'), 403);
    }

    const allMembers = await this.conversationMemberQueryRepo.list(
      { conversationId: validatedInput.conversationId },
      { page: 1, limit: 1000 }
    );

    const activeMembers = allMembers.filter((member) => !member.leftAt);

    return activeMembers;
  }
}
