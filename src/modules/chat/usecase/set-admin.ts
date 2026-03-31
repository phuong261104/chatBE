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
import { SetAdminCommand } from "../model/dto";

export class SetAdminHandler implements ICommandHandler<SetAdminCommand, Conversation> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: SetAdminCommand): Promise<Conversation> {
    const { groupId, targetUserId, isAdmin } = command;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Only group conversations can set admin"), 400);
    }

    const targetMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: targetUserId,
    });

    if (!targetMember) {
      throw AppError.from(new Error("Target user is not a member of this group"), 404);
    }

    if (targetMember.leftAt) {
      throw AppError.from(new Error("Target user has left the group"), 400);
    }

    await this.conversationMemberCommandRepo.update(targetMember.id, {
      role: isAdmin ? ConversationMemberRole.ADMIN : ConversationMemberRole.MEMBER,
    });

    const admins = conversation.admins || [];
    let newAdmins: string[];
    if (isAdmin) {
      newAdmins = [...new Set([...admins, targetUserId])];
    } else {
      newAdmins = admins.filter((id) => id !== targetUserId);
    }

    await this.conversationCommandRepo.update(groupId, { admins: newAdmins });

    const updatedConversation = await this.conversationQueryRepo.get(groupId);
    if (!updatedConversation) {
      throw AppError.from(new Error("Failed to get updated conversation"), 500);
    }

    return updatedConversation;
  }
}
