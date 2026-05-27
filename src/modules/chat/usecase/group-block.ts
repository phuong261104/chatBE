import { ICommandHandler, IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IGroupBlockQueryRepository,
  IGroupBlockCommandRepository,
  IUserQueryRepository,
} from "../interface";
import {
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  GroupBlock,
  Message,
  MessageType,
} from "../model/model";
import {
  GetGroupBlocksQuery,
  BlockGroupMemberCommand,
  UnblockGroupMemberCommand,
} from "../model/dto";
import { SystemMessageTemplate } from "../constants/system-messages";
import { IMessageCommandRepository } from "../interface";

export interface GroupBlockWithUser {
  block: GroupBlock;
  userDisplayName: string;
}

export interface GroupBlockWithSystemMessage {
  block: GroupBlock;
  systemMessage?: Message;
}

export class GetGroupBlocksHandler
  implements IQueryHandler<GetGroupBlocksQuery, GroupBlockWithUser[]>
{
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly groupBlockQueryRepo: IGroupBlockQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly userQueryRepo: IUserQueryRepository,
  ) {}

  async query(query: GetGroupBlocksQuery): Promise<GroupBlockWithUser[]> {
    const conversation = await this.conversationQueryRepo.get(query.groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: query.groupId,
      userId: query.requesterId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }
    if (member.role !== ConversationMemberRole.OWNER && member.role !== ConversationMemberRole.ADMIN) {
      throw AppError.from(new Error("Only owner or admins can view blocked members"), 403);
    }

    const blocks = await this.groupBlockQueryRepo.listByConversationId(query.groupId);

    const result: GroupBlockWithUser[] = await Promise.all(
      blocks.map(async (block) => {
        const user = await this.userQueryRepo.get(block.userId);
        return {
          block,
          userDisplayName: user?.displayName || "Unknown User",
        };
      }),
    );

    return result;
  }
}

export class BlockGroupMemberHandler
  implements ICommandHandler<BlockGroupMemberCommand, GroupBlockWithSystemMessage>
{
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly groupBlockQueryRepo: IGroupBlockQueryRepository,
    private readonly groupBlockCommandRepo: IGroupBlockCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository,
  ) {}

  async execute(command: BlockGroupMemberCommand): Promise<GroupBlockWithSystemMessage> {
    const conversation = await this.conversationQueryRepo.get(command.groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Only group conversations support blocking"), 400);
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: command.groupId,
      userId: command.requesterId,
    });
    if (!requesterMember || requesterMember.leftAt || requesterMember.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }
    if (requesterMember.role !== ConversationMemberRole.OWNER && requesterMember.role !== ConversationMemberRole.ADMIN) {
      throw AppError.from(new Error("Only owner or admins can block members"), 403);
    }

    const targetMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: command.groupId,
      userId: command.targetUserId,
    });

    const [requesterUser, targetUser] = await Promise.all([
      this.userQueryRepo.get(command.requesterId),
      this.userQueryRepo.get(command.targetUserId),
    ]);
    const requesterDisplayName = requesterUser?.displayName || "Unknown User";
    const targetDisplayName = targetUser?.displayName || "Unknown User";

    const isBlocked = await this.groupBlockQueryRepo.isUserBlocked(command.groupId, command.targetUserId);
    if (isBlocked) {
      throw AppError.from(new Error("User is already blocked"), 400);
    }

    let systemMessage: Message | undefined;
    const now = new Date();

    if (targetMember && !targetMember.leftAt && targetMember.status === ConversationMemberStatus.ACTIVE) {
      if (targetMember.role === ConversationMemberRole.OWNER) {
        throw AppError.from(new Error("Cannot block the group owner"), 400);
      }

      await this.conversationMemberCommandRepo.update(targetMember.id, { leftAt: now });

      await this.conversationCommandRepo.update(command.groupId, {
        membersCount: Math.max(0, (conversation.membersCount || 1) - 1),
      });

      if (targetMember.role === ConversationMemberRole.ADMIN) {
        const newAdmins = (conversation.admins || []).filter(id => id !== command.targetUserId);
        await this.conversationCommandRepo.update(command.groupId, { admins: newAdmins });
      }

      const messageId = v7();
      const systemMessageText = SystemMessageTemplate.MEMBER_BLOCKED(requesterDisplayName, targetDisplayName);
      systemMessage = {
        id: messageId,
        conversationId: command.groupId,
        senderId: command.requesterId,
        type: MessageType.SYSTEM,
        text: systemMessageText,
        createdAt: now,
        pinned: false,
      };
      await this.messageCommandRepo.insert(systemMessage);

      await this.conversationCommandRepo.update(command.groupId, {
        lastMessage: {
          messageId: messageId,
          senderId: command.requesterId,
          type: MessageType.SYSTEM,
          textPreview: systemMessageText,
          createdAt: now,
        },
        lastMessageAt: now,
      });

      await this.conversationMemberCommandRepo.touchActivityForConversation(command.groupId, now);
    }

    const block: GroupBlock = {
      pk: `GROUP#${command.groupId}`,
      sk: `USER#${command.targetUserId}`,
      conversationId: command.groupId,
      userId: command.targetUserId,
      blockedBy: command.requesterId,
      createdAt: now,
    };
    await this.groupBlockCommandRepo.insert(block);

    return { block, systemMessage };
  }
}

export class UnblockGroupMemberHandler
  implements ICommandHandler<UnblockGroupMemberCommand, void>
{
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly groupBlockQueryRepo: IGroupBlockQueryRepository,
    private readonly groupBlockCommandRepo: IGroupBlockCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly userQueryRepo: IUserQueryRepository,
  ) {}

  async execute(command: UnblockGroupMemberCommand): Promise<void> {
    const conversation = await this.conversationQueryRepo.get(command.groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: command.groupId,
      userId: command.requesterId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }
    if (member.role !== ConversationMemberRole.OWNER && member.role !== ConversationMemberRole.ADMIN) {
      throw AppError.from(new Error("Only owner or admins can unblock members"), 403);
    }

    const isBlocked = await this.groupBlockQueryRepo.isUserBlocked(command.groupId, command.targetUserId);
    if (!isBlocked) {
      throw AppError.from(new Error("User is not blocked"), 400);
    }

    await this.groupBlockCommandRepo.deleteByConversationAndUser(command.groupId, command.targetUserId);
  }
}
