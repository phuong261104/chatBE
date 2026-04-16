import { ICommandHandler } from '@share/interface';
import { AppError } from '@share/app-error';
import { v7 } from 'uuid';
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
  IConversationCommandRepository,
  IMessageClassificationRepository,
} from '../interface';
import {
  ConversationMemberStatus,
  Message,
  MessageType,
  MediaAttachment,
  MediaType,
  MessageClassification,
  ClassificationType,
} from '../model/model';

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

export class SendMessageHandler implements ICommandHandler<any, Message[]> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly classificationRepo: IMessageClassificationRepository,
  ) {}

  async execute(command: any): Promise<Message[]> {
    const { conversationId, senderId, text, media } = command;

    if (!conversationId) throw new Error('conversationId is required');
    if (!senderId) throw new Error('senderId is required');
    if (!text && (!media || media.length === 0)) {
      throw AppError.from(new Error('Either text or media is required'), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId: senderId,
    });

    console.log(`[DEBUG] SendMessage: conversationId=${conversationId}, senderId=${senderId}, memberFound=${!!member}, memberStatus=${member?.status}, memberLeftAt=${member?.leftAt}`);

    if (!member) {
      throw AppError.from(new Error('Unauthorized: You are not a member of this conversation'), 403);
    }

    if (member.status !== ConversationMemberStatus.ACTIVE || member.leftAt !== undefined) {
      throw AppError.from(new Error('Unauthorized: You have left this conversation'), 403);
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
      for (const m of media) {
        const isImg = m.mimetype.startsWith('image/');
        const isVideo = m.mimetype.startsWith('video/');
        const isAudio = m.mimetype.startsWith('audio/');
        let msgType: MessageType;
        if (isImg) msgType = MessageType.IMAGE;
        else if (isVideo) msgType = MessageType.VIDEO;
        else if (isAudio) msgType = MessageType.VOICE;
        else msgType = MessageType.FILE;

        const hasTextAndNoLink = hasText && !hasLinks;
        const msg = this.buildMessage(msgType, hasTextAndNoLink ? text : undefined, mapMediaToDbFormat([m]), conversationId, senderId);
        await this.messageCommandRepo.insert(msg);
        createdMessages.push(msg);
        classifications.push(this.buildClassification(msg, isImg ? ClassificationType.IMAGE : ClassificationType.FILE, m));
      }
      if (hasText && hasLinks) {
        const linkMsg = this.buildMessage(MessageType.LINK, text, undefined, conversationId, senderId);
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
      const mediaMsg = this.buildMessage(msgType, undefined, mapMediaToDbFormat(media), conversationId, senderId);
      await this.messageCommandRepo.insert(mediaMsg);
      createdMessages.push(mediaMsg);
      for (const m of media) {
        classifications.push(this.buildClassification(mediaMsg, m.mimetype.startsWith('image/') ? ClassificationType.IMAGE : ClassificationType.FILE, m));
      }
      const linkMsg = this.buildMessage(MessageType.LINK, text, undefined, conversationId, senderId);
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
      const msg = this.buildMessage(msgType, text, mapMediaToDbFormat(media), conversationId, senderId);
      await this.messageCommandRepo.insert(msg);
      createdMessages.push(msg);
      for (const m of media) {
        classifications.push(this.buildClassification(msg, m.mimetype.startsWith('image/') ? ClassificationType.IMAGE : ClassificationType.FILE, m));
      }
    } else {
      const msgType = hasLinks ? MessageType.LINK : MessageType.TEXT;
      const msg = this.buildMessage(msgType, text, undefined, conversationId, senderId);
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

    const allMembers = await this.conversationMemberQueryRepo.list(
      { conversationId },
      { page: 1, limit: 10 },
    );

    const otherMember = allMembers.find((m) => m.userId !== senderId);
    if (otherMember) {
      await this.conversationMemberCommandRepo.update(otherMember.id, {
        unreadCount: (otherMember.unreadCount || 0) + 1,
      });
    }

    return createdMessages;
  }

  private buildMessage(
    type: MessageType,
    text: string | undefined,
    media: any[] | undefined,
    conversationId: string,
    senderId: string,
  ): Message {
    const id = v7();
    const now = new Date();
    return {
      id,
      conversationId,
      senderId,
      type,
      text,
      media,
      links: text ? extractLinks(text) : undefined,
      createdAt: now,
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
