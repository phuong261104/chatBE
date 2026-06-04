import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
  IUserQueryRepository,
} from "../interface";
import {
  Conversation,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageType,
} from "../model/model";
import { SetAdminCommand } from "../model/dto";
import { SystemMessageTemplate } from "../constants/system-messages";
import { isActiveMember, isOwnerMember } from "./group-permissions";
import { attachHiddenMessage } from "./utility-messages";

export class SetAdminHandler implements ICommandHandler<SetAdminCommand, Conversation> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository,
  ) {}

  async execute(command: SetAdminCommand): Promise<Conversation> {
    const { groupId, requesterId, targetUserId, isAdmin } = command;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Only group conversations can set admin"), 400);
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: requesterId,
    });
    if (!isActiveMember(requesterMember) || !isOwnerMember(requesterMember, conversation)) {
      throw AppError.from(new Error("Only group owner can set admin"), 403);
    }

    const targetMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: targetUserId,
    });

    if (!targetMember) {
      throw AppError.from(new Error("Target user is not a member of this group"), 404);
    }

    if (targetMember.leftAt || targetMember.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("Target user has left the group"), 400);
    }

    if (isOwnerMember(targetMember, conversation)) {
      throw AppError.from(new Error("Cannot change the group owner's admin role"), 400);
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

    const now = new Date();
    const [requester, targetUser] = await Promise.all([
      this.userQueryRepo.get(requesterId),
      this.userQueryRepo.get(targetUserId),
    ]);
    const requesterDisplayName = requester?.displayName || "Unknown User";
    const targetDisplayName = targetUser?.displayName || "Unknown User";

    const systemMsg: Message = {
      id: v7(),
      conversationId: groupId,
      senderId: requesterId,
      type: MessageType.SYSTEM,
      text: isAdmin
        ? SystemMessageTemplate.SET_ADMIN(requesterDisplayName, targetDisplayName)
        : SystemMessageTemplate.REMOVE_ADMIN(requesterDisplayName, targetDisplayName),
      createdAt: now,
      pinned: false,
    };
    await this.messageCommandRepo.insert(systemMsg);

    await this.conversationCommandRepo.update(groupId, {
      lastMessage: {
        messageId: systemMsg.id,
        senderId: requesterId,
        type: MessageType.SYSTEM,
        textPreview: systemMsg.text,
        createdAt: now,
      },
      lastMessageAt: now,
    });
    await this.conversationMemberCommandRepo.touchActivityForConversation(groupId, now);

    const updatedConversation = await this.conversationQueryRepo.get(groupId);
    if (!updatedConversation) {
      throw AppError.from(new Error("Failed to get updated conversation"), 500);
    }

    return attachHiddenMessage(updatedConversation, "systemMessage", systemMsg);
  }
}
