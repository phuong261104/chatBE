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
import { ConversationType, ConversationMemberStatus, ConversationMemberRole, Message, MessageType } from "../model/model";
import { SystemMessageTemplate } from "../constants/system-messages";

export class RejectMemberHandler implements ICommandHandler<{ groupId: string; userId: string; requesterId: string }, void> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository,
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

    if (
      !requesterMember ||
      requesterMember.leftAt ||
      requesterMember.status !== ConversationMemberStatus.ACTIVE ||
      requesterMember.role !== ConversationMemberRole.ADMIN
    ) {
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
      text: SystemMessageTemplate.REJECT_MEMBER(requesterDisplayName, targetDisplayName),
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
  }
}
