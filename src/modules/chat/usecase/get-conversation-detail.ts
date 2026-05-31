import { IQueryHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { IConversationQueryRepository, IConversationMemberQueryRepository } from '../interface';
import { ConversationMemberStatus } from '../model/model';
import { GetConversationDetailQuery, ConversationDetail, getConversationDetailDTOSchema } from '../model/dto';
import { normalizeConversationListItem } from './conversation-listing';

export class GetConversationDetailQueryHandler implements IQueryHandler<
  GetConversationDetailQuery,
  ConversationDetail
> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository
  ) {}

  async query(query: GetConversationDetailQuery): Promise<ConversationDetail> {
    const { success, data: validatedQuery, error } = getConversationDetailDTOSchema.safeParse(query);
    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400);
    }

    const conversation = await this.conversationQueryRepo.get(validatedQuery.conversationId);
    if (!conversation) {
      throw AppError.from(new Error('Conversation not found'), 404);
    }

    const currentUserMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedQuery.conversationId,
      userId: validatedQuery.userId
    });

    if (
      !currentUserMember ||
      currentUserMember.leftAt !== undefined ||
      currentUserMember.status !== ConversationMemberStatus.ACTIVE
    ) {
      throw AppError.from(
        new Error("Unauthorized: You are not a member of this conversation"),
        403
      );
    }

    const allMembers = await this.conversationMemberQueryRepo.list(
      { conversationId: validatedQuery.conversationId },
      { page: 1, limit: 1000 }
    );

    const activeMembers = allMembers.filter(
      (member) => member.status === ConversationMemberStatus.ACTIVE && !member.leftAt
    );

    const conversationWithMembership = normalizeConversationListItem({
      ...conversation,
      unreadCount: currentUserMember.unreadCount || 0,
      role: currentUserMember.role,
      pinned: !!currentUserMember.pinned,
      isPinned: !!currentUserMember.pinned,
      pinnedAt: currentUserMember.pinnedAt,
      muted: !!currentUserMember.muteUntil,
      isMuted: !!currentUserMember.muteUntil,
      muteUntil: currentUserMember.muteUntil,
      archived: !!currentUserMember.archived,
      isArchived: !!currentUserMember.archived,
      wallpaperUrl: currentUserMember.wallpaper || null,
    }, validatedQuery.userId);

    return {
      conversation: conversationWithMembership as ConversationDetail["conversation"],
      members: activeMembers,
      currentUserRole: currentUserMember.role,
    };
  }
}
