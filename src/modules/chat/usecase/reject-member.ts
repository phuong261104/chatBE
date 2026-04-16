import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
} from "../interface";
import { ConversationType, ConversationMemberStatus, ConversationMemberRole } from "../model/model";

export class RejectMemberHandler implements ICommandHandler<{ groupId: string; userId: string; requesterId: string }, void> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: { groupId: string; userId: string; requesterId: string }): Promise<void> {
    const { groupId, userId, requesterId } = command;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Only group conversations support member rejection"), 400);
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: requesterId,
    });

    if (!requesterMember || requesterMember.role !== ConversationMemberRole.ADMIN) {
      throw AppError.from(new Error("Only admins can reject members"), 403);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("Member not found in this group"), 404);
    }

    if (member.status === ConversationMemberStatus.REJECTED) {
      throw AppError.from(new Error("Member is already rejected"), 400);
    }

    if (member.status === ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("Active members cannot be rejected"), 400);
    }

    await this.conversationMemberCommandRepo.update(member.id, {
      status: ConversationMemberStatus.REJECTED,
    });
  }
}
