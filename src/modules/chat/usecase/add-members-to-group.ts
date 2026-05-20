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
} from '../model/model';
import { addMembersToGroupDTOSchema, AddMembersToGroupCommand } from '../model/dto';
import { ChatAccessPolicy } from './chat-access-policy';
import { isActiveMember, isGroupManager, normalizeGroupSettings } from "./group-permissions";

export class AddMembersToGroupHandler implements ICommandHandler<AddMembersToGroupCommand, ConversationMember[]> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository,
    private readonly accessPolicy: ChatAccessPolicy,
  ) {}

  async execute(command: AddMembersToGroupCommand): Promise<ConversationMember[]> {

    const { success, data: validatedInput, error } = addMembersToGroupDTOSchema.safeParse(command);

    if (!success) {
      throw AppError.from(new Error('Invalid data'), 400).withDetail('validationErrors', error.errors);
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.requesterId
    });

    const conversation = await this.conversationQueryRepo.get(validatedInput.conversationId);
    if (!conversation) {
      throw AppError.from(new Error('Conversation not found'), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error('Only group conversations can add members'), 400);
    }

    if (!isActiveMember(requesterMember)) {
      throw AppError.from(new Error('Unauthorized: You are not a member of this group'), 403);
    }

    const newMembers: ConversationMember[] = [];
    const now = new Date();
    const settings = normalizeGroupSettings(conversation.settings);

    if (settings.allowMemberInvite === false) {
      throw AppError.from(new Error("Member invites are disabled for this group"), 403);
    }

    if (settings.whoCanAddMembers === "admins" && !isGroupManager(requesterMember, conversation)) {
      throw AppError.from(new Error("Only owner or admins can add members"), 403);
    }

    const uniqueMemberIds = await this.accessPolicy.validateAddGroupMembers(
      validatedInput.requesterId,
      validatedInput.memberIds,
      conversation.membersCount || 0,
    );

    const users = await this.userQueryRepo.findByIds([validatedInput.requesterId, ...uniqueMemberIds]);
    const userMap = new Map(users.map((u) => [u.id, u]));

    const defaultStatus = settings.requireApproval
      ? ConversationMemberStatus.PENDING
      : ConversationMemberStatus.ACTIVE;

    const existingToRestore: ConversationMember[] = [];
    const membersToInsert: ConversationMember[] = [];
    const membersToUpdate: { existing: ConversationMember; updated: ConversationMember }[] = [];

    for (const memberId of uniqueMemberIds) {
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
          hiddenUserIds: [],
          lastActivityAt: now,
          updatedAt: now
        };
        membersToInsert.push(member);
      } else if (existingMember.leftAt !== undefined) {
        const reJoinedMember: ConversationMember = {
          ...existingMember,
          role: ConversationMemberRole.MEMBER,
          status: defaultStatus,
          joinedAt: now,
          leftAt: undefined,
          unreadCount: 0,
          archived: false,
          hidden: false,
          hiddenAt: undefined,
          hiddenPinHash: undefined,
          lastActivityAt: now,
          updatedAt: now,
        };
        existingToRestore.push(existingMember);
        membersToUpdate.push({ existing: existingMember, updated: reJoinedMember });
      } else {
        throw AppError.from(new Error(`User ${memberId} is already a member of this group`), 400)
          .withDetail("code", "duplicate");
      }
    }

    const activeAddedCount =
      membersToInsert.filter((m) => m.status === ConversationMemberStatus.ACTIVE).length +
      membersToUpdate.filter((m) => m.updated.status === ConversationMemberStatus.ACTIVE).length;

    const insertedMembers: ConversationMember[] = [];

    try {
      for (const member of membersToInsert) {
        await this.conversationMemberCommandRepo.insert(member);
        insertedMembers.push(member);
        newMembers.push(member);
      }
      for (const item of membersToUpdate) {
        await this.conversationMemberCommandRepo.update(item.existing.id, {
          role: ConversationMemberRole.MEMBER,
          status: defaultStatus,
          joinedAt: now,
          leftAt: null,
          unreadCount: 0,
          archived: false,
          hidden: false,
          hiddenAt: null,
          hiddenPinHash: null,
          lastActivityAt: now,
        } as any);
        newMembers.push(item.updated);
      }

      if (activeAddedCount > 0) {
        await this.conversationCommandRepo.update(validatedInput.conversationId, {
          membersCount: (conversation.membersCount || 0) + activeAddedCount
        });
      }

      if (newMembers.length === 0) {
        return [];
      }

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
      await this.conversationMemberCommandRepo.touchActivityForConversation(validatedInput.conversationId, now);
    } catch (err) {
      await Promise.allSettled([
        ...insertedMembers.map((member) => this.conversationMemberCommandRepo.delete(member.id, true)),
        ...existingToRestore.map((member) =>
          this.conversationMemberCommandRepo.update(member.id, {
            status: member.status,
            leftAt: member.leftAt,
            lastActivityAt: member.lastActivityAt,
          } as any),
        ),
      ]);
      throw err;
    }

    return newMembers;
  }
}
