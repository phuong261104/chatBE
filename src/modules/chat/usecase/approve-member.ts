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
  ConversationMember,
  ConversationType,
  ConversationMemberStatus,
  Message,
  MessageType,
} from "../model/model";
import { SystemMessageTemplate } from "../constants/system-messages";
import { isActiveMember, isGroupManager } from "./group-permissions";

export class ApproveMemberHandler implements ICommandHandler<{ groupId: string; userId: string; requesterId: string }, ConversationMember> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository,
  ) {}

  async execute(command: { groupId: string; userId: string; requesterId: string }): Promise<ConversationMember> {
    const { groupId, userId, requesterId } = command;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Only group conversations support member approval"), 400);
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: requesterId,
    });

    if (!isActiveMember(requesterMember) || !isGroupManager(requesterMember, conversation)) {
      throw AppError.from(new Error("Only owner or admins can approve members"), 403);
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

    const now = new Date();
    const [requester, targetUser] = await Promise.all([
      this.userQueryRepo.get(requesterId),
      this.userQueryRepo.get(userId),
    ]);
    const requesterDisplayName = requester?.displayName || "Unknown User";
    const targetDisplayName = targetUser?.displayName || "Unknown User";

    const systemMsg: Message = {
      id: v7(),
      conversationId: groupId,
      senderId: requesterId,
      type: MessageType.SYSTEM,
      text: SystemMessageTemplate.APPROVE_MEMBER(requesterDisplayName, targetDisplayName),
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

    const updatedMember = await this.conversationMemberQueryRepo.get(member.id);
    if (!updatedMember) {
      throw AppError.from(new Error("Failed to get updated member"), 500);
    }

    return updatedMember;
  }
}
