import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
} from "../interface";
import {
  ConversationMember,
  ConversationMemberRole,
  ConversationType,
  ConversationMemberStatus,
} from "../model/model";

export class ApproveMemberHandler implements ICommandHandler<{ groupId: string; userId: string }, ConversationMember> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: { groupId: string; userId: string }): Promise<ConversationMember> {
    const { groupId, userId } = command;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Only group conversations support member approval"), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("Member not found in this group"), 404);
    }

    if (member.status === ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("Member is already active"), 400);
    }

    if (member.status === ConversationMemberStatus.REJECTED) {
      throw AppError.from(new Error("Member was rejected and cannot be approved"), 400);
    }

    await this.conversationMemberCommandRepo.update(member.id, {
      status: ConversationMemberStatus.ACTIVE,
    });

    await this.conversationCommandRepo.update(groupId, {
      membersCount: (conversation.membersCount || 0) + 1,
    });

    const updatedMember = await this.conversationMemberQueryRepo.get(member.id);
    if (!updatedMember) {
      throw AppError.from(new Error("Failed to get updated member"), 500);
    }

    return updatedMember;
  }
}
