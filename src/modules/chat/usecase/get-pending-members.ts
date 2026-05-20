import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IConversationQueryRepository, IConversationMemberQueryRepository } from "../interface";
import { ConversationMember, ConversationType, ConversationMemberStatus } from "../model/model";
import { isActiveMember, isGroupManager } from "./group-permissions";

export class GetPendingMembersHandler implements IQueryHandler<{ groupId: string; requesterId: string }, ConversationMember[]> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: { groupId: string; requesterId: string }): Promise<ConversationMember[]> {
    const { groupId, requesterId } = query;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Pending members are only for group conversations"), 400);
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: requesterId,
    });
    if (!isActiveMember(requesterMember) || !isGroupManager(requesterMember, conversation)) {
      throw AppError.from(new Error("Only owner or admins can view pending members"), 403);
    }

    const allMembers = await this.conversationMemberQueryRepo.list(
      { conversationId: groupId },
      { page: 1, limit: 1000 },
    );

    const pendingMembers = allMembers.filter(
      (member) => member.status === ConversationMemberStatus.PENDING,
    );

    return pendingMembers;
  }
}
