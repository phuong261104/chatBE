import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
  IMessageClassificationRepository,
} from "../interface";
import {
  ConversationType,
  ConversationMemberRole,
} from "../model/model";

export class DissolveGroupHandler implements ICommandHandler<{ groupId: string; requesterId: string }, void> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly classificationRepo: IMessageClassificationRepository,
  ) {}

  async execute(command: { groupId: string; requesterId: string }): Promise<void> {
    const { groupId, requesterId } = command;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Only group conversations can be dissolved"), 400);
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: requesterId,
    });

    if (!requesterMember || requesterMember.leftAt) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    const currentOwnerId = conversation.ownerId || conversation.createdBy;
    if (requesterMember.userId !== currentOwnerId && requesterMember.role !== ConversationMemberRole.ADMIN) {
      throw AppError.from(new Error("Only group owner or admin can dissolve the group"), 403);
    }

    const members = await this.conversationMemberQueryRepo.listByConversationId(groupId);

    for (const member of members) {
      await this.conversationMemberCommandRepo.delete(member.id, true);
    }

    await this.classificationRepo.deleteByConversationId(groupId);
    await this.messageCommandRepo.deleteByConversationId(groupId);
    await this.conversationCommandRepo.delete(groupId, true);
  }
}