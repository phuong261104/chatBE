import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IGroupInviteLinkQueryRepository,
  IGroupInviteLinkCommandRepository,
  IGroupBlockQueryRepository,
  IMessageCommandRepository,
  IUserQueryRepository,
} from "../interface";
import {
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  GroupInviteLinkStatus,
  Message,
  MessageType,
} from "../model/model";
import { JoinGroupByInviteCommand } from "../model/dto";
import { SystemMessageTemplate } from "../constants/system-messages";
import { normalizeGroupSettings } from "./group-permissions";

export interface JoinGroupByInviteResult {
  member: ConversationMember;
  conversationId: string;
  isPending: boolean;
  alreadyMember: boolean;
  systemMessage?: Message;
}

export class JoinGroupByInviteHandler
  implements ICommandHandler<JoinGroupByInviteCommand, JoinGroupByInviteResult>
{
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly groupInviteLinkQueryRepo: IGroupInviteLinkQueryRepository,
    private readonly groupInviteLinkCommandRepo: IGroupInviteLinkCommandRepository,
    private readonly groupBlockQueryRepo: IGroupBlockQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository,
  ) {}

  async execute(command: JoinGroupByInviteCommand): Promise<JoinGroupByInviteResult> {
    const link = await this.groupInviteLinkQueryRepo.get(command.token);
    if (!link) {
      throw AppError.from(new Error("Invite link not found or has been revoked"), 404);
    }

    if (link.status === GroupInviteLinkStatus.REVOKED) {
      throw AppError.from(new Error("This invite link has been revoked"), 410);
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      throw AppError.from(new Error("This invite link has expired"), 410);
    }

    const conversation = await this.conversationQueryRepo.get(link.conversationId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Cannot join a private conversation via invite link"), 400);
    }

    const settings = normalizeGroupSettings(conversation.settings);
    if (!settings.allowMemberInvite) {
      throw AppError.from(new Error("Group invites are disabled"), 403);
    }

    const isBlocked = await this.groupBlockQueryRepo.isUserBlocked(link.conversationId, command.requesterId);
    if (isBlocked) {
      throw AppError.from(new Error("You are blocked from joining this group"), 403);
    }

    const existingMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: link.conversationId,
      userId: command.requesterId,
    });

    if (existingMember && existingMember.status === ConversationMemberStatus.ACTIVE && !existingMember.leftAt) {
      return {
        member: existingMember,
        conversationId: link.conversationId,
        isPending: false,
        alreadyMember: true,
      };
    }

    const requireApproval = settings.requireApproval ?? false;
    const newMemberCanViewHistory = settings.newMemberCanViewHistory ?? true;
    const now = new Date();

    if (requireApproval) {
      let pendingMember: ConversationMember;

      if (existingMember) {
        pendingMember = {
          ...existingMember,
          status: ConversationMemberStatus.PENDING,
          leftAt: null,
          hiddenUserIds: [],
          updatedAt: now,
        };
        await this.conversationMemberCommandRepo.update(existingMember.id, {
          status: ConversationMemberStatus.PENDING,
          leftAt: null,
          hiddenUserIds: [],
        });
      } else {
        pendingMember = {
          id: v7(),
          conversationId: link.conversationId,
          userId: command.requesterId,
          role: ConversationMemberRole.MEMBER,
          status: ConversationMemberStatus.PENDING,
          joinedAt: now,
          unreadCount: 0,
          hidden: false,
          hiddenUserIds: [],
          updatedAt: now,
          pinned: false,
          archived: false,
        };
        await this.conversationMemberCommandRepo.insert(pendingMember);
      }

      return {
        member: pendingMember,
        conversationId: link.conversationId,
        isPending: true,
        alreadyMember: false,
      };
    }

    let member: ConversationMember;
    const historyVisibleFrom = newMemberCanViewHistory ? undefined : now;

    if (existingMember) {
      member = {
        ...existingMember,
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: now,
        leftAt: null,
        unreadCount: 0,
        archived: false,
        hidden: false,
        hiddenAt: undefined,
        hiddenPinHash: undefined,
        hiddenUserIds: [],
        historyVisibleFrom,
        updatedAt: now,
      };
      await this.conversationMemberCommandRepo.update(existingMember.id, {
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: now,
        leftAt: null,
        unreadCount: 0,
        archived: false,
        hidden: false,
        hiddenAt: null,
        hiddenPinHash: null,
        hiddenUserIds: [],
        historyVisibleFrom,
      });
    } else {
      member = {
        id: v7(),
        conversationId: link.conversationId,
        userId: command.requesterId,
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: now,
        unreadCount: 0,
        hidden: false,
        hiddenUserIds: [],
        historyVisibleFrom,
        updatedAt: now,
        pinned: false,
        archived: false,
      };
      await this.conversationMemberCommandRepo.insert(member);
    }

    await this.conversationCommandRepo.update(link.conversationId, {
      membersCount: (conversation.membersCount || 0) + 1,
    });

    const user = await this.userQueryRepo.get(command.requesterId);
    const userDisplayName = user?.displayName || "Unknown User";
    const systemMessageText = SystemMessageTemplate.MEMBER_JOINED_BY_INVITE(userDisplayName);

    const systemMsg: Message = {
      id: v7(),
      conversationId: link.conversationId,
      senderId: command.requesterId,
      type: MessageType.SYSTEM,
      text: systemMessageText,
      createdAt: now,
      pinned: false,
    };
    await this.messageCommandRepo.insert(systemMsg);

    await this.conversationCommandRepo.update(link.conversationId, {
      lastMessage: {
        messageId: systemMsg.id,
        senderId: command.requesterId,
        type: MessageType.SYSTEM,
        textPreview: systemMessageText,
        createdAt: now,
      },
      lastMessageAt: now,
    });

    await this.conversationMemberCommandRepo.touchActivityForConversation(link.conversationId, now);

    return {
      member,
      conversationId: link.conversationId,
      isPending: false,
      alreadyMember: false,
      systemMessage: systemMsg,
    };
  }
}
