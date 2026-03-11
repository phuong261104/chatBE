import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository
} from '../interface';
import { Conversation, ConversationMemberRole, ConversationType } from '../model/model';
import { updateGroupInfoDTOSchema, ConversationUpdateDTO, UpdateGroupInfoCommand } from '../model/dto';

export class UpdateGroupInfoHandler implements ICommandHandler<UpdateGroupInfoCommand, Conversation> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository
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

    if (!requesterMember || requesterMember.role !== ConversationMemberRole.ADMIN) {
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

    const updatedConversation = await this.conversationQueryRepo.get(validatedInput.conversationId);
    if (!updatedConversation) {
      throw AppError.from(new Error('Failed to get updated conversation'), 500);
    }

    return updatedConversation;
  }
}
