import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { v7 } from 'uuid';
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
  IConversationCommandRepository,
  IConversationQueryRepository,
  IMessageClassificationRepository,
} from '../interface';
import {
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageType,
  MediaAttachment,
  MediaType,
  MessageClassification,
  ClassificationType,
} from '../model/model';
import { SendMessageCommand } from '../model/dto';
import { ChatAccessPolicy } from './chat-access-policy';

function mapMediaToDbFormat(media: MediaAttachment[]) {
  return media.map((m) => {
    let mediaType: MediaType;
    if (m.mimetype.startsWith('image/')) mediaType = MediaType.IMAGE;
    else if (m.mimetype.startsWith('video/')) mediaType = MediaType.VIDEO;
    else if (m.mimetype.startsWith('audio/')) mediaType = MediaType.AUDIO;
    else mediaType = MediaType.FILE;

    return {
      url: m.url,
      mediaType,
      name: m.filename,
      size: m.size,
    };
  });
}

function extractLinks(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(https?:\/\/[^\s]+)/g);
  return matches || [];
}

function mimetypeToClassificationType(mimetype: string): ClassificationType {
  if (mimetype.startsWith('image/')) return ClassificationType.IMAGE;
  if (mimetype.startsWith('video/')) return ClassificationType.VIDEO;
  if (mimetype.startsWith('audio/')) return ClassificationType.VOICE;
  return ClassificationType.FILE;
}

export class SendMessageHandler implements ICommandHandler<SendMessageCommand, Message[]> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly classificationRepo: IMessageClassificationRepository,
    private readonly accessPolicy: ChatAccessPolicy,
  ) {}

  async execute(command: SendMessageCommand): Promise<Message[]> {
    const { conversationId, senderId, text, media, ttlSeconds } = command;

    if (!conversationId) throw new Error('conversationId is required');
    if (!senderId) throw new Error('senderId is required');
    if (!text && (!media || media.length === 0)) {
      throw AppError.from(new Error('Either text or media is required'), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId: senderId,
    });

    if (!member) {
      throw AppError.from(new Error('Unauthorized: You are not a member of this conversation'), 403);
    }

    if (member.status !== ConversationMemberStatus.ACTIVE || member.leftAt !== undefined) {
      throw AppError.from(new Error('Unauthorized: You have left this conversation'), 403);
    }

    const conversation = await this.conversationQueryRepo.get(conversationId);
    if (!conversation) {
      throw AppError.from(new Error('Conversation not found'), 404);
    }
    if (conversation.type === ConversationType.PRIVATE) {
      const members = await this.conversationMemberQueryRepo.list(
        { conversationId },
        { page: 1, limit: 10 },
      );
      const target = members.find((m) => m.userId !== senderId && m.status === ConversationMemberStatus.ACTIVE && !m.leftAt);
      if (target) {
        await this.accessPolicy.assertNotBlockedBetween(senderId, target.userId);
      }
    }

    const hasText = !!text;
    const hasMedia = !!(media && media.length > 0);
    const hasLinks = !!(hasText && extractLinks(text || "").length > 0);
    const mediaCount = media?.length || 0;
    const shouldSplitByMedia = mediaCount > 1;
    const shouldSplitTextMedia = hasText && hasMedia && hasLinks;

    const createdMessages: Message[] = [];
    const classifications: MessageClassification[] = [];

    if (shouldSplitByMedia) {
      for (const m of media!) {
        const isImg = m.mimetype.startsWith('image/');
        const isVideo = m.mimetype.startsWith('video/');
        const isAudio = m.mimetype.startsWith('audio/');
        let msgType: MessageType;
        if (isImg) msgType = MessageType.IMAGE;
        else if (isVideo) msgType = MessageType.VIDEO;
        else if (isAudio) msgType = MessageType.VOICE;
        else msgType = MessageType.FILE;

        const hasTextAndNoLink = hasText && !hasLinks;
        const msg = this.buildMessage(msgType, hasTextAndNoLink ? text : undefined, mapMediaToDbFormat([m]), conversationId, senderId, ttlSeconds);
        await this.messageCommandRepo.insert(msg);
        createdMessages.push(msg);
        classifications.push(this.buildClassification(msg, mimetypeToClassificationType(m.mimetype), m));
      }
      if (hasText && hasLinks) {
        const linkMsg = this.buildMessage(MessageType.LINK, text, undefined, conversationId, senderId, ttlSeconds);
        await this.messageCommandRepo.insert(linkMsg);
        createdMessages.push(linkMsg);
        for (const url of extractLinks(text)) {
          classifications.push(this.buildLinkClassification(linkMsg, url));
        }
      }
    } else if (shouldSplitTextMedia) {
      const hasImage = media.some((m: MediaAttachment) => m.mimetype.startsWith('image/'));
      const hasVideo = media.some((m: MediaAttachment) => m.mimetype.startsWith('video/'));
      const hasAudio = media.some((m: MediaAttachment) => m.mimetype.startsWith('audio/'));
      let msgType: MessageType;
      if (hasImage) msgType = MessageType.IMAGE;
      else if (hasVideo) msgType = MessageType.VIDEO;
      else if (hasAudio) msgType = MessageType.VOICE;
      else msgType = MessageType.FILE;
      const mediaMsg = this.buildMessage(msgType, undefined, mapMediaToDbFormat(media), conversationId, senderId, ttlSeconds);
      await this.messageCommandRepo.insert(mediaMsg);
      createdMessages.push(mediaMsg);
      for (const m of media) {
        classifications.push(this.buildClassification(mediaMsg, mimetypeToClassificationType(m.mimetype), m));
      }
      const linkMsg = this.buildMessage(MessageType.LINK, text, undefined, conversationId, senderId, ttlSeconds);
      await this.messageCommandRepo.insert(linkMsg);
      createdMessages.push(linkMsg);
      for (const url of extractLinks(text)) {
        classifications.push(this.buildLinkClassification(linkMsg, url));
      }
    } else if (hasMedia) {
      const hasImage = media.some((m: MediaAttachment) => m.mimetype.startsWith('image/'));
      const hasVideo = media.some((m: MediaAttachment) => m.mimetype.startsWith('video/'));
      const hasAudio = media.some((m: MediaAttachment) => m.mimetype.startsWith('audio/'));
      let msgType: MessageType;
      if (hasImage) msgType = MessageType.IMAGE;
      else if (hasVideo) msgType = MessageType.VIDEO;
      else if (hasAudio) msgType = MessageType.VOICE;
      else msgType = MessageType.FILE;
      const msg = this.buildMessage(msgType, text, mapMediaToDbFormat(media), conversationId, senderId, ttlSeconds);
      await this.messageCommandRepo.insert(msg);
      createdMessages.push(msg);
      for (const m of media) {
        classifications.push(this.buildClassification(msg, mimetypeToClassificationType(m.mimetype), m));
      }
    } else {
      const msgType = hasLinks ? MessageType.LINK : MessageType.TEXT;
      const msg = this.buildMessage(msgType, text, undefined, conversationId, senderId, ttlSeconds);
      await this.messageCommandRepo.insert(msg);
      createdMessages.push(msg);
      if (hasLinks) {
        for (const url of extractLinks(text)) {
          classifications.push(this.buildLinkClassification(msg, url));
        }
      }
    }

    if (classifications.length > 0) {
      await this.classificationRepo.insertBatch(classifications);
    }

    const primaryMsg =
      createdMessages.find((m) => m.type === MessageType.TEXT || m.type === MessageType.LINK) ||
      createdMessages.find((m) => m.type === MessageType.IMAGE) ||
      createdMessages[0];

    let textPreview = primaryMsg.text || '';
    if (!textPreview && primaryMsg.media && primaryMsg.media.length > 0) {
      if (primaryMsg.type === MessageType.IMAGE) textPreview = '📷 Image';
      else if (primaryMsg.type === MessageType.VIDEO) textPreview = '🎬 Video';
      else if (primaryMsg.type === MessageType.VOICE) textPreview = '🎤 Voice';
      else textPreview = '📎 File';
    }

    await this.conversationCommandRepo.update(conversationId, {
      lastMessage: {
        messageId: primaryMsg.id,
        senderId,
        type: primaryMsg.type,
        textPreview: textPreview.substring(0, 100),
        createdAt: primaryMsg.createdAt,
      },
      lastMessageAt: primaryMsg.createdAt,
    });

    await this.conversationMemberCommandRepo.incrementUnreadCountForConversation(
      conversationId,
      senderId,
    );

    return createdMessages;
  }

  private buildMessage(
    type: MessageType,
    text: string | undefined,
    media: any[] | undefined,
    conversationId: string,
    senderId: string,
    ttlSeconds?: number,
  ): Message {
    const id = v7();
    const now = new Date();
    const expiresAt = ttlSeconds ? new Date(now.getTime() + ttlSeconds * 1000) : undefined;
    return {
      id,
      conversationId,
      senderId,
      type,
      text,
      media,
      links: text ? extractLinks(text) : undefined,
      createdAt: now,
      expiresAt,
      expireAtEpoch: expiresAt ? Math.floor(expiresAt.getTime() / 1000) : undefined,
      pinned: false,
    };
  }

  private buildClassification(msg: Message, type: ClassificationType, m: MediaAttachment): MessageClassification {
    return {
      id: v7(),
      conversationId: msg.conversationId,
      type,
      senderId: msg.senderId,
      url: m.url,
      name: m.filename,
      messageId: msg.id,
      createdAt: msg.createdAt,
    };
  }

  private buildLinkClassification(msg: Message, url: string): MessageClassification {
    return {
      id: v7(),
      conversationId: msg.conversationId,
      type: ClassificationType.LINK,
      senderId: msg.senderId,
      linkUrl: url,
      messageId: msg.id,
      createdAt: msg.createdAt,
    };
  }
}
