import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
  IMessageClassificationRepository,
  IMessageReactionCommandRepository,
  IPollCommandRepository,
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
    private readonly reactionCommandRepo: IMessageReactionCommandRepository,
    private readonly classificationRepo: IMessageClassificationRepository,
    private readonly pollCommandRepo: IPollCommandRepository,
  ) {}

  async execute(command: { groupId: string; requesterId: string }): Promise<void> {
    const { groupId, requesterId } = command;

    const conversation = await this.conversationQueryRepo.get(groupId);
    console.log(`[DissolveGroupHandler] groupId=${groupId}, requesterId=${requesterId}, conv=${!!conversation}, ownerId=${conversation?.ownerId}, createdBy=${conversation?.createdBy}, requesterRole=${conversation?.admins?.includes(requesterId)}`);
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
    console.log(`[DissolveGroupHandler] findByCond: member=${!!requesterMember}, leftAt=${requesterMember?.leftAt}, role=${requesterMember?.role}, admins=${JSON.stringify(conversation?.admins)}`);

    if (!requesterMember || requesterMember.leftAt) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    const currentOwnerId = conversation.ownerId || conversation.createdBy;
    const isOwner = requesterMember.userId === currentOwnerId;
    const isAdmin = conversation.admins?.includes(requesterId);
    console.log(`[DissolveGroupHandler] ownerCheck: isOwner=${isOwner}, isAdmin=${isAdmin}`);
    if (!isOwner && !isAdmin) {
      throw AppError.from(new Error("Only group owner or admin can dissolve the group"), 403);
    }

    await this.messageCommandRepo.deleteByConversationId(groupId);
    await this.reactionCommandRepo.deleteByConversationId(groupId);
    await this.classificationRepo.deleteByConversationId(groupId);
    await this.pollCommandRepo.deleteByConversationId(groupId);
    await this.conversationMemberCommandRepo.deleteByConversationId(groupId);
    await this.conversationCommandRepo.delete(groupId, true);
  }
}