import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { v7 } from 'uuid';
import {
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository
} from '../interface';
import { Message, MessageType, MediaAttachment, MediaType } from '../model/model';
import { sendMessageDTOSchema, SendMessageCommand } from '../model/dto';

function mapMediaToDbFormat(media: MediaAttachment[]) {
  return media.map((m) => ({
    url: m.url,
    mediaType: m.mimetype.startsWith('image/') ? MediaType.IMAGE : MediaType.FILE,
    name: m.filename,
    size: m.size
  }));
}

export class SendMessageHandler implements ICommandHandler<SendMessageCommand, Message> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository
  ) {}

  async execute(command: SendMessageCommand): Promise<Message> {

    const { success, data: validatedInput, error } = sendMessageDTOSchema.safeParse(command);

    if (!success) {
      throw new Error('Invalid data');
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: validatedInput.conversationId,
      userId: validatedInput.senderId
    });

    if (!member) {
      throw AppError.from(new Error('Unauthorized: You are not a member of this conversation'), 403);
    }

    let messageType = MessageType.TEXT;
    if (validatedInput.media && validatedInput.media.length > 0) {

      const hasImage = validatedInput.media.some((m) => m.mimetype.startsWith('image/'));
      if (hasImage) {
        messageType = MessageType.IMAGE;
      } else {
        messageType = MessageType.FILE;
      }
    }

    const messageId = v7();
    const now = new Date();

    const message: Message = {
      id: messageId,
      conversationId: validatedInput.conversationId,
      senderId: validatedInput.senderId,
      type: messageType,
      text: validatedInput.text,
      media: validatedInput.media ? mapMediaToDbFormat(validatedInput.media as any) : undefined,
      createdAt: now,
      pinned: false,
    };
    await this.messageCommandRepo.insert(message);

    let textPreview = validatedInput.text || '';
    if (!textPreview && validatedInput.media && validatedInput.media.length > 0) {
      if (messageType === MessageType.IMAGE) {
        textPreview = `📷 Image`;
      } else {
        textPreview = `📎 File`;
      }
    }

    await this.conversationCommandRepo.update(validatedInput.conversationId, {
      lastMessage: {
        messageId: messageId,
        senderId: validatedInput.senderId,
        type: messageType,
        textPreview: textPreview.substring(0, 100),
        createdAt: now
      },
      lastMessageAt: now
    });

    const allMembers = await this.conversationMemberQueryRepo.list(
      { conversationId: validatedInput.conversationId },
      { page: 1, limit: 10 }
    );

    const otherMember = allMembers.find((m) => m.userId !== validatedInput.senderId);
    if (otherMember) {
      await this.conversationMemberCommandRepo.update(otherMember.id, {
        unreadCount: (otherMember.unreadCount || 0) + 1
      });
    }

    return message;
  }
}
