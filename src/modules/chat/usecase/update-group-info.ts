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
  Conversation,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageType,
} from '../model/model';
import { updateGroupInfoDTOSchema, ConversationUpdateDTO, UpdateGroupInfoCommand } from '../model/dto';
import { SystemMessageTemplate } from '../constants/system-messages';

export class UpdateGroupInfoHandler implements ICommandHandler<UpdateGroupInfoCommand, Conversation> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository
  ) {}

  async execute(command: UpdateGroupInfoCommand): Promise<Conversation> {

    const { success, data: validatedInput, error } = updateGroupInfoDTOSchema.safeParse(command);

    if (!success) {
      throw new Error('Invalid data');
    }

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.requesterId
    });

    if (
      !requesterMember ||
      requesterMember.leftAt ||
      requesterMember.status !== ConversationMemberStatus.ACTIVE ||
      requesterMember.role !== ConversationMemberRole.ADMIN
    ) {
      throw AppError.from(new Error('Unauthorized: Only admins can update group info'), 403);
    }

    const conversation = await this.conversationQueryRepo.get(validatedInput.conversationId);
    if (!conversation) {
      throw AppError.from(new Error('Conversation not found'), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error('Only group conversations can be updated'), 400);
    }

    const updateData: ConversationUpdateDTO = {};
    if (validatedInput.name !== undefined) {
      updateData.name = validatedInput.name;
    }
    if (validatedInput.avatarUrl !== undefined) {
      updateData.avatarUrl = validatedInput.avatarUrl;
    }

    await this.conversationCommandRepo.update(validatedInput.conversationId, updateData);

    const messages: Message[] = [];
    const now = new Date();

    const [requester] = await Promise.all([
      this.userQueryRepo.get(validatedInput.requesterId),
    ]);
    const actorDisplayName = requester?.displayName || 'Unknown User';

    const changedFields = new Set<string>();
    if (validatedInput.name !== undefined) changedFields.add("name");
    if (validatedInput.avatarUrl !== undefined) changedFields.add("avatarUrl");

    if (changedFields.has("name")) {
      const systemMsg: Message = {
        id: v7(),
        conversationId: validatedInput.conversationId,
        senderId: validatedInput.requesterId,
        type: MessageType.SYSTEM,
        text: SystemMessageTemplate.RENAME_GROUP(
          actorDisplayName,
          conversation.name || "(không có tên)",
          validatedInput.name!
        ),
        createdAt: now,
        pinned: false,
      };
      await this.messageCommandRepo.insert(systemMsg);
      messages.push(systemMsg);
    }

    if (changedFields.has("avatarUrl")) {
      const systemMsg: Message = {
        id: v7(),
        conversationId: validatedInput.conversationId,
        senderId: validatedInput.requesterId,
        type: MessageType.SYSTEM,
        text: SystemMessageTemplate.CHANGE_AVATAR(actorDisplayName),
        createdAt: now,
        pinned: false,
      };
      await this.messageCommandRepo.insert(systemMsg);
      messages.push(systemMsg);
    }

    if (messages.length > 0) {
      const lastSystemMsg = messages[messages.length - 1];
      await this.conversationCommandRepo.update(validatedInput.conversationId, {
        lastMessage: {
          messageId: lastSystemMsg.id,
          senderId: validatedInput.requesterId,
          type: MessageType.SYSTEM,
          textPreview: lastSystemMsg.text,
          createdAt: now
        },
        lastMessageAt: now
      });
      await this.conversationMemberCommandRepo.touchActivityForConversation(validatedInput.conversationId, now);
    }

    const updatedConversation = await this.conversationQueryRepo.get(validatedInput.conversationId);
    if (!updatedConversation) {
      throw AppError.from(new Error('Failed to get updated conversation'), 500);
    }

    return updatedConversation;
  }
}
