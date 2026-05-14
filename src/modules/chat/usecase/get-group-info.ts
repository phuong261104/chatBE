import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IConversationQueryRepository, IConversationMemberQueryRepository } from "../interface";
import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  GroupSettings,
} from "../model/model";

export class GetGroupInfoHandler implements IQueryHandler<{ groupId: string; userId: string }, {
  conversation: Conversation;
  members: ConversationMember[];
  currentUserRole: ConversationMemberRole;
  settings: GroupSettings;
}> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: { groupId: string; userId: string }): Promise<{
    conversation: Conversation;
    members: ConversationMember[];
    currentUserRole: ConversationMemberRole;
    settings: GroupSettings;
  }> {
    const { groupId, userId } = query;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    const allMembers = await this.conversationMemberQueryRepo.list(
      { conversationId: groupId },
      { page: 1, limit: 1000 },
    );

    const activeMembers = allMembers.filter(
      (m) => m.status === ConversationMemberStatus.ACTIVE && !m.leftAt,
    );

    const settings: GroupSettings = conversation.settings || {
      allowSendLink: true,
      requireApproval: false,
      allowMemberInvite: true,
    };

    return {
      conversation,
      members: activeMembers,
      currentUserRole: member.role,
      settings,
    };
  }
}
