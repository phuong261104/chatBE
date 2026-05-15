import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { v7 } from 'uuid';
import {
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
  IUserQueryRepository
} from '../interface';
import {
  Conversation,
  ConversationType,
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  Message,
  MessageType,
} from '../model/model';
import { createGroupDTOSchema, CreateGroupCommand, CreateGroupResult } from '../model/dto';
import { ChatAccessPolicy } from './chat-access-policy';

export class CreateGroupHandler implements ICommandHandler<CreateGroupCommand, CreateGroupResult> {
  constructor(
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository,
    private readonly accessPolicy: ChatAccessPolicy,
  ) {}

  async execute(command: CreateGroupCommand): Promise<CreateGroupResult> {

    const { success, data: validatedData, error } = createGroupDTOSchema.safeParse(command.data);

    if (!success) {
      throw AppError.from(new Error('Invalid data'), 400).withDetail('validationErrors', error.errors);
    }

    const { name, memberIds, avatarUrl } = validatedData;
    const validatedMemberIds = await this.accessPolicy.validateCreateGroupMembers(command.creatorId, memberIds);
    const users = await this.userQueryRepo.findByIds([command.creatorId, ...validatedMemberIds]);
    const userMap = new Map(users.map((u) => [u.id, u]));

    const conversationId = v7();
    const now = new Date();

    const conversation: Conversation = {
      id: conversationId,
      type: ConversationType.GROUP,
      name: name,
      avatarUrl: avatarUrl,
      createdBy: command.creatorId,
      ownerId: command.creatorId,
      admins: [command.creatorId],
      membersCount: validatedMemberIds.length + 1,
      settings: {
        allowSendLink: true,
        requireApproval: false,
        allowMemberInvite: true,
        whoCanSendMessages: "all",
      },
      createdAt: now,
      updatedAt: now
    };

    const members: ConversationMember[] = [];
    const creatorMember: ConversationMember = {
      id: v7(),
      conversationId: conversationId,
      userId: command.creatorId,
      role: ConversationMemberRole.ADMIN,
      status: ConversationMemberStatus.ACTIVE,
      joinedAt: now,
      unreadCount: 0,
      pinned: false,
      archived: false,
      hiddenUserIds: [],
      lastActivityAt: now,
      updatedAt: now
    };
    members.push(creatorMember);

    for (const memberId of validatedMemberIds) {
      const member: ConversationMember = {
        id: v7(),
        conversationId: conversationId,
        userId: memberId,
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: now,
        unreadCount: 0,
        pinned: false,
        archived: false,
        hiddenUserIds: [],
        lastActivityAt: now,
        updatedAt: now
      };
      members.push(member);
    }

    const messageId = v7();
    const creator = userMap.get(command.creatorId);
    const creatorDisplayName = creator?.displayName || 'Unknown User';
    const systemMessageText = `${creatorDisplayName} đã tạo nhóm`;

    const systemMessage: Message = {
      id: messageId,
      conversationId: conversationId,
      senderId: command.creatorId,
      type: MessageType.SYSTEM,
      text: systemMessageText,
      createdAt: now,
      pinned: false,
    };

    try {
      await this.conversationCommandRepo.insert(conversation);
      for (const member of members) {
        await this.conversationMemberCommandRepo.insert(member);
      }
      await this.messageCommandRepo.insert(systemMessage);
      await this.conversationCommandRepo.update(conversationId, {
        lastMessage: {
          messageId: messageId,
          senderId: command.creatorId,
          type: MessageType.SYSTEM,
          textPreview: systemMessageText,
          createdAt: now
        },
        lastMessageAt: now
      });
    } catch (err) {
      await Promise.allSettled([
        this.messageCommandRepo.deleteByConversationId(conversationId),
        this.conversationMemberCommandRepo.deleteByConversationId(conversationId),
        this.conversationCommandRepo.delete(conversationId, true),
      ]);
      throw err;
    }

    return {
      conversation,
      members,
      systemMessage
    };
  }
}
