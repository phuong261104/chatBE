import { ICommandHandler } from '@share/interface';
import { v7 } from 'uuid';
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
} from '../interface';
import { Conversation, ConversationType, ConversationMemberRole, ConversationMemberStatus } from '../model/model';
import { getOrCreatePrivateConversationDTOSchema, GetOrCreatePrivateConversationCommand } from '../model/dto';
import { ChatAccessPolicy } from './chat-access-policy';

export class GetOrCreatePrivateConversationHandler implements ICommandHandler<
  GetOrCreatePrivateConversationCommand,
  Conversation
> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly accessPolicy: ChatAccessPolicy,
    private readonly conversationMemberQueryRepo?: IConversationMemberQueryRepository,
  ) {}

  async execute(command: GetOrCreatePrivateConversationCommand): Promise<Conversation> {
    const { success, data: validatedInput, error } = getOrCreatePrivateConversationDTOSchema.safeParse(command);

    if (!success) {
      throw new Error('Invalid data');
    }

    const isSelfConversation = validatedInput.currentUserId === validatedInput.targetUserId;

    await this.accessPolicy.assertCanStartPrivateConversation(
      validatedInput.currentUserId,
      validatedInput.targetUserId,
    );

    const pairKey = isSelfConversation
      ? `self_${validatedInput.currentUserId}`
      : [validatedInput.currentUserId, validatedInput.targetUserId].sort().join('_');

    let conversation =
      (await (this.conversationQueryRepo as any).findByPairKey?.(pairKey, ConversationType.PRIVATE)) ||
      (await this.conversationQueryRepo.findByCond({
        type: ConversationType.PRIVATE,
        pairKey: pairKey
      }));

    if (!conversation) {
      const conversationId = v7();
      const now = new Date();

      conversation = {
        id: conversationId,
        type: ConversationType.PRIVATE,
        pairKey: pairKey,
        membersCount: isSelfConversation ? 1 : 2,
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
        hiddenUserIds: [],
        lastActivityAt: now,
        updatedAt: now
      };
      await this.conversationMemberCommandRepo.insert(member1);

      if (!isSelfConversation) {
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
          hiddenUserIds: [],
          lastActivityAt: now,
          updatedAt: now
        };
        await this.conversationMemberCommandRepo.insert(member2);
      }
    } else {
      await this.ensureCurrentMemberVisible(conversation.id, validatedInput.currentUserId);
    }

    return conversation;
  }

  private async ensureCurrentMemberVisible(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const memberQueryRepo =
      this.conversationMemberQueryRepo ||
      (typeof (this.conversationMemberCommandRepo as any).findByCond === "function"
        ? (this.conversationMemberCommandRepo as unknown as IConversationMemberQueryRepository)
        : null);

    if (!memberQueryRepo) {
      return;
    }

    const now = new Date();
    const existing = await memberQueryRepo.findByCond({ conversationId, userId });
    if (!existing) {
      await this.conversationMemberCommandRepo.insert({
        id: v7(),
        conversationId,
        userId,
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: now,
        unreadCount: 0,
        pinned: false,
        archived: false,
        hiddenUserIds: [],
        lastActivityAt: now,
        updatedAt: now,
      });
      return;
    }

    const update: Record<string, unknown> = {};
    if (existing.status !== ConversationMemberStatus.ACTIVE) {
      update.status = ConversationMemberStatus.ACTIVE;
    }
    if (existing.leftAt) {
      update.leftAt = null;
    }
    if (existing.archived) {
      update.archived = false;
    }
    if (existing.hidden) {
      update.hidden = false;
    }

    if (Object.keys(update).length > 0) {
      update.lastActivityAt = now;
      await this.conversationMemberCommandRepo.update(existing.id, update as any);
    }
  }
}
