import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { v7 } from 'uuid';
import {
  IConversationQueryRepository,
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
  UserStatus
} from '../model/model';
import { createGroupDTOSchema, CreateGroupDTO, CreateGroupCommand, CreateGroupResult } from '../model/dto';

export class CreateGroupHandler implements ICommandHandler<CreateGroupCommand, CreateGroupResult> {
  constructor(
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository
  ) {}

  async execute(command: CreateGroupCommand): Promise<CreateGroupResult> {

    const { success, data: validatedData, error } = createGroupDTOSchema.safeParse(command.data);

    if (!success) {
      throw new Error('Invalid data');
    }

    const { name, memberIds, avatarUrl } = validatedData;

    if (!memberIds || memberIds.length < 2) {
      throw AppError.from(new Error('Group must have at least 3 members'), 400);
    }

    const users = await this.userQueryRepo.findByIds([command.creatorId, ...memberIds]);
    const userMap = new Map(users.map((u) => [u.id, u]));

    if (!userMap.has(command.creatorId)) {
      throw AppError.from(new Error('Creator not found'), 404);
    }

    for (const memberId of memberIds) {
      const user = userMap.get(memberId);
      if (!user) {
        throw AppError.from(new Error(`User ${memberId} not found`), 404);
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw AppError.from(new Error(`User ${memberId} is not active`), 400);
      }
    }

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
      membersCount: memberIds.length + 1,
      createdAt: now,
      updatedAt: now
    };

    await this.conversationCommandRepo.insert(conversation);

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
      updatedAt: now
    };
    members.push(creatorMember);
    await this.conversationMemberCommandRepo.insert(creatorMember);

    for (const memberId of memberIds) {
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
        updatedAt: now
      };
      members.push(member);
      await this.conversationMemberCommandRepo.insert(member);
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

    return {
      conversation,
      members,
      systemMessage
    };
  }
}
