import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
} from "../interface";
import {
  Conversation,
  ConversationMemberRole,
  ConversationType,
  ConversationMemberStatus,
} from "../model/model";
import { TransferOwnerCommand } from "../model/dto";

export class TransferOwnerHandler implements ICommandHandler<TransferOwnerCommand, Conversation> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: TransferOwnerCommand): Promise<Conversation> {
    const { groupId, requesterId, newOwnerId } = command;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Only group conversations can transfer ownership"), 400);
    }

    const currentOwnerId = conversation.ownerId || conversation.createdBy;
    if (!currentOwnerId) {
      throw AppError.from(new Error("No owner found for this group"), 400);
    }
    if (requesterId !== currentOwnerId) {
      throw AppError.from(new Error("Only group owner can transfer ownership"), 403);
    }

    const newOwnerMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: newOwnerId,
    });

    if (!newOwnerMember) {
      throw AppError.from(new Error("New owner is not a member of this group"), 404);
    }

    if (newOwnerMember.leftAt) {
      throw AppError.from(new Error("New owner has left the group"), 400);
    }

    const updateData: any = {
      ownerId: newOwnerId,
      admins: [...new Set([...(conversation.admins || []), currentOwnerId, newOwnerId])],
    };

    await this.conversationCommandRepo.update(groupId, updateData);

    await this.conversationMemberCommandRepo.update(newOwnerMember.id, {
      role: ConversationMemberRole.ADMIN,
    });

    const updatedConversation = await this.conversationQueryRepo.get(groupId);
    if (!updatedConversation) {
      throw AppError.from(new Error("Failed to get updated conversation"), 500);
    }

    return updatedConversation;
  }
}
