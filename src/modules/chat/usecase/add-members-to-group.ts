import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { v7 } from 'uuid';
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
  IUserQueryRepository
} from '../interface';
import {
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageType,
  UserStatus
} from '../model/model';
import { addMembersToGroupDTOSchema, AddMembersToGroupCommand } from '../model/dto';

export class AddMembersToGroupHandler implements ICommandHandler<AddMembersToGroupCommand, ConversationMember[]> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository
  ) {}

  async execute(command: AddMembersToGroupCommand): Promise<ConversationMember[]> {

    const { success, data: validatedInput, error } = addMembersToGroupDTOSchema.safeParse(command);

    if (!success) {
      throw new Error('Invalid data');
    }

    const users = await this.userQueryRepo.findByIds(validatedInput.memberIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    for (const memberId of validatedInput.memberIds) {
      const user = userMap.get(memberId);
      if (!user) {
        throw AppError.from(new Error(`User ${memberId} not found`), 404);
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw AppError.from(new Error(`User ${memberId} is not active`), 400);
      }
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.requesterId
    });

    if (!requesterMember || requesterMember.role !== ConversationMemberRole.ADMIN) {
      throw AppError.from(new Error('Unauthorized: Only admins can add members'), 403);
    }

    const conversation = await this.conversationQueryRepo.get(validatedInput.conversationId);
    if (!conversation) {
      throw AppError.from(new Error('Conversation not found'), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error('Only group conversations can add members'), 400);
    }

    const newMembers: ConversationMember[] = [];
    const actuallyAddedCount = { count: 0 };
    const now = new Date();
    const settings = conversation.settings || {
      allowSendLink: true,
      requireApproval: false,
      allowMemberInvite: true,
    };
    const defaultStatus = settings.requireApproval
      ? ConversationMemberStatus.PENDING
      : ConversationMemberStatus.ACTIVE;

    for (const memberId of validatedInput.memberIds) {

      const existingMember = await this.conversationMemberQueryRepo.findByCond({
        conversationId: validatedInput.conversationId,
        userId: memberId
      });

      if (!existingMember) {
        const member: ConversationMember = {
          id: v7(),
          conversationId: validatedInput.conversationId,
          userId: memberId,
          role: ConversationMemberRole.MEMBER,
          status: defaultStatus,
          joinedAt: now,
          unreadCount: 0,
          pinned: false,
          archived: false,
          updatedAt: now
        };
        await this.conversationMemberCommandRepo.insert(member);
        newMembers.push(member);
        actuallyAddedCount.count++;
      } else if (existingMember.leftAt !== undefined) {
        await this.conversationMemberCommandRepo.update(existingMember.id, {
          status: ConversationMemberStatus.ACTIVE,
          joinedAt: now,
          leftAt: null,
          updatedAt: now,
        } as any);
        const reJoinedMember: ConversationMember = {
          ...existingMember,
          status: ConversationMemberStatus.ACTIVE,
          joinedAt: now,
          leftAt: undefined,
          updatedAt: now,
        };
        newMembers.push(reJoinedMember);
        actuallyAddedCount.count++;
      }
    }

    if (actuallyAddedCount.count > 0) {
      await this.conversationCommandRepo.update(validatedInput.conversationId, {
        membersCount: (conversation.membersCount || 0) + actuallyAddedCount.count
      });
    }

    if (newMembers.length > 0) {
      const messageId = v7();
      const requester = userMap.get(validatedInput.requesterId);
      const requesterDisplayName = requester?.displayName || 'Unknown User';

      const newMemberNames = newMembers
        .map((m) => {
          const user = userMap.get(m.userId);
          return user?.displayName || 'Unknown User';
        })
        .join(', ');

      const systemMessageText = `${requesterDisplayName} đã thêm ${newMemberNames} vào nhóm`;

      const systemMessage: Message = {
        id: messageId,
        conversationId: validatedInput.conversationId,
        senderId: validatedInput.requesterId,
        type: MessageType.SYSTEM,
        text: systemMessageText,
        createdAt: now,
        pinned: false,
      };
      await this.messageCommandRepo.insert(systemMessage);

      await this.conversationCommandRepo.update(validatedInput.conversationId, {
        lastMessage: {
          messageId: messageId,
          senderId: validatedInput.requesterId,
          type: MessageType.SYSTEM,
          textPreview: systemMessageText,
          createdAt: now
        },
        lastMessageAt: now
      });
    }

    return newMembers;
  }
}
