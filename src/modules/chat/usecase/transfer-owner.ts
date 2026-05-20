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
import { TransferOwnerCommand } from "../model/dto";
import { SystemMessageTemplate } from "../constants/system-messages";
import { isActiveMember, isOwnerMember } from "./group-permissions";

export class TransferOwnerHandler implements ICommandHandler<TransferOwnerCommand, Conversation> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository,
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

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: requesterId,
    });
    if (!isActiveMember(requesterMember) || !isOwnerMember(requesterMember, conversation)) {
      throw AppError.from(new Error("Only group owner can transfer ownership"), 403);
    }

    const newOwnerMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: newOwnerId,
    });

    if (!newOwnerMember) {
      throw AppError.from(new Error("New owner is not a member of this group"), 404);
    }

    if (newOwnerMember.leftAt || newOwnerMember.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("New owner has left the group"), 400);
    }

    const updateData: any = {
      ownerId: newOwnerId,
      admins: [...new Set([...(conversation.admins || []).filter((id) => id !== newOwnerId), requesterId])],
    };

    await this.conversationCommandRepo.update(groupId, updateData);

    await this.conversationMemberCommandRepo.update(requesterMember.id, {
      role: ConversationMemberRole.ADMIN,
    });

    await this.conversationMemberCommandRepo.update(newOwnerMember.id, {
      role: ConversationMemberRole.OWNER,
    });

    const now = new Date();
    const [requester, newOwner] = await Promise.all([
      this.userQueryRepo.get(requesterId),
      this.userQueryRepo.get(newOwnerId),
    ]);
    const requesterDisplayName = requester?.displayName || "Unknown User";
    const newOwnerDisplayName = newOwner?.displayName || "Unknown User";

    const systemMsg: Message = {
      id: v7(),
      conversationId: groupId,
      senderId: requesterId,
      type: MessageType.SYSTEM,
      text: SystemMessageTemplate.TRANSFER_OWNER(requesterDisplayName, newOwnerDisplayName),
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

    return updatedConversation;
  }
}
