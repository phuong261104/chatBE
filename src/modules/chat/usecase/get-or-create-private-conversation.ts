import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { v7 } from 'uuid';
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IUserQueryRepository
} from '../interface';
import { Conversation, ConversationType, ConversationMemberRole, ConversationMemberStatus, UserStatus } from '../model/model';
import { getOrCreatePrivateConversationDTOSchema, GetOrCreatePrivateConversationCommand } from '../model/dto';

export class GetOrCreatePrivateConversationHandler implements ICommandHandler<
  GetOrCreatePrivateConversationCommand,
  Conversation
> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository
  ) {}

  async execute(command: GetOrCreatePrivateConversationCommand): Promise<Conversation> {
    const { success, data: validatedInput, error } = getOrCreatePrivateConversationDTOSchema.safeParse(command);

    if (!success) {
      throw new Error('Invalid data');
    }

    const targetUser = await this.userQueryRepo.get(validatedInput.targetUserId);

    if (!targetUser) {
      throw AppError.from(new Error('Target user not found'), 404);
    }

    if (targetUser.status !== UserStatus.ACTIVE) {
      throw AppError.from(new Error('Target user is not active'), 400);
    }

    const pairKey = [validatedInput.currentUserId, validatedInput.targetUserId].sort().join('_');

    let conversation = await this.conversationQueryRepo.findByCond({
      type: ConversationType.PRIVATE,
      pairKey: pairKey
    });

    if (!conversation) {
      const conversationId = v7();
      const now = new Date();

      conversation = {
        id: conversationId,
        type: ConversationType.PRIVATE,
        pairKey: pairKey,
        membersCount: 2,
        createdAt: now,
        updatedAt: now
      };
      await this.conversationCommandRepo.insert(conversation);

      const member1 = {
        id: v7(),
        conversationId: conversationId,
        userId: validatedInput.currentUserId,
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: now,
        unreadCount: 0,
        pinned: false,
        archived: false,
        updatedAt: now
      };
      await this.conversationMemberCommandRepo.insert(member1);

      const member2 = {
        id: v7(),
        conversationId: conversationId,
        userId: validatedInput.targetUserId,
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: now,
        unreadCount: 0,
        pinned: false,
        archived: false,
        updatedAt: now
      };
      await this.conversationMemberCommandRepo.insert(member2);
    }

    return conversation;
  }
}
