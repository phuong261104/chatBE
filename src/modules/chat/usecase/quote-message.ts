import { v7 } from "uuid";
import { AppError } from "@share/app-error";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
  IConversationCommandRepository,
  IMessageClassificationRepository,
} from "@modules/chat/interface";
import {
  QuoteMessageCommand,
} from "@modules/chat/model/dto";
import { ConversationMemberStatus, Message, MessageType, MessageClassification, ClassificationType, MediaType } from "@modules/chat/model/model";
import {
  assertMessageActiveForAction,
  classificationTypeForMediaType,
  extractLinks,
  getMessagePreview,
} from "./message-action-rules";

export class QuoteMessageHandler {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCmdRepo: IMessageCommandRepository,
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationCmdRepo: IConversationCommandRepository,
    private readonly classificationRepo: IMessageClassificationRepository,
  ) {}

  async execute(command: QuoteMessageCommand): Promise<Message[]> {
    const quotedMessage = await this.messageQueryRepo.get(command.quotedMessageId);
    if (!quotedMessage) {
      throw new Error("Quoted message not found");
    }

    if (quotedMessage.conversationId !== command.conversationId) {
      throw new Error("Quoted message is not in this conversation");
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: command.conversationId,
      userId: command.senderId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("User is not an active member of this conversation"), 403);
    }

    assertMessageActiveForAction(quotedMessage, command.senderId, "quote");

    const quotedPreview = getMessagePreview(quotedMessage);

    const hasMedia = !!(command.media && command.media.length > 0);
    const hasText = !!command.text;
    const textLinks = hasText ? extractLinks(command.text || "") : [];
    const hasLinks = textLinks.length > 0;

    const now = new Date();
    const createdMessages: Message[] = [];

    if (shouldSplitByMedia(command.media)) {
      for (const m of command.media || []) {
        const isImg = m.mimetype.startsWith("image/");
        const isVideo = m.mimetype.startsWith("video/");
        const isAudio = m.mimetype.startsWith("audio/");
        let msgType: MessageType;
        if (isImg) msgType = MessageType.IMAGE;
        else if (isVideo) msgType = MessageType.VIDEO;
        else if (isAudio) msgType = MessageType.VOICE;
        else msgType = MessageType.FILE;
        const hasTextAndNoLink = hasText && !hasLinks;
        const msg = this.buildMessage(
          msgType,
          hasTextAndNoLink ? command.text : undefined,
          mapMediaToDbFormat([m]),
          command.conversationId,
          command.senderId,
          true,
          command.quotedMessageId,
          quotedPreview,
        );
        await this.messageCmdRepo.insert(msg);
        createdMessages.push(msg);
      }
      if (hasText && hasLinks) {
        const linkMsg = this.buildMessage(
          MessageType.LINK,
          command.text,
          undefined,
          command.conversationId,
          command.senderId,
          true,
          command.quotedMessageId,
          quotedPreview,
        );
        await this.messageCmdRepo.insert(linkMsg);
        createdMessages.push(linkMsg);
      }
    } else if (hasText && hasMedia && hasLinks) {
      const hasImage = command.media!.some((m: any) => m.mimetype.startsWith("image/"));
      const hasVideo = command.media!.some((m: any) => m.mimetype.startsWith("video/"));
      const hasAudio = command.media!.some((m: any) => m.mimetype.startsWith("audio/"));
      let msgType: MessageType;
      if (hasImage) msgType = MessageType.IMAGE;
      else if (hasVideo) msgType = MessageType.VIDEO;
      else if (hasAudio) msgType = MessageType.VOICE;
      else msgType = MessageType.FILE;
      const mediaMsg = this.buildMessage(
        msgType,
        undefined,
        mapMediaToDbFormat(command.media),
        command.conversationId,
        command.senderId,
        true,
        command.quotedMessageId,
        quotedPreview,
      );
      await this.messageCmdRepo.insert(mediaMsg);
      createdMessages.push(mediaMsg);

      const linkMsg = this.buildMessage(
        MessageType.LINK,
        command.text,
        undefined,
        command.conversationId,
        command.senderId,
        true,
        command.quotedMessageId,
        quotedPreview,
      );
      await this.messageCmdRepo.insert(linkMsg);
      createdMessages.push(linkMsg);
    } else if (hasMedia) {
      const hasImage = command.media!.some((m: any) => m.mimetype.startsWith("image/"));
      const hasVideo = command.media!.some((m: any) => m.mimetype.startsWith("video/"));
      const hasAudio = command.media!.some((m: any) => m.mimetype.startsWith("audio/"));
      let type: MessageType;
      if (hasImage) type = MessageType.IMAGE;
      else if (hasVideo) type = MessageType.VIDEO;
      else if (hasAudio) type = MessageType.VOICE;
      else type = MessageType.FILE;
      const msg = this.buildMessage(
        type,
        command.text,
        mapMediaToDbFormat(command.media),
        command.conversationId,
        command.senderId,
        true,
        command.quotedMessageId,
        quotedPreview,
      );
      await this.messageCmdRepo.insert(msg);
      createdMessages.push(msg);
    } else {
      const type = hasLinks ? MessageType.LINK : MessageType.TEXT;
      const msg = this.buildMessage(
        type,
        command.text,
        undefined,
        command.conversationId,
        command.senderId,
        true,
        command.quotedMessageId,
        quotedPreview,
      );
      await this.messageCmdRepo.insert(msg);
      createdMessages.push(msg);
    }

    const classifications: MessageClassification[] = [];
    for (const msg of createdMessages) {
      if (msg.media && msg.media.length > 0) {
        for (const media of msg.media) {
          classifications.push({
            id: v7(),
            conversationId: command.conversationId,
            type: classificationTypeForMediaType(media.mediaType),
            senderId: command.senderId,
            url: media.url,
            name: media.name,
            messageId: msg.id,
            createdAt: msg.createdAt,
          });
        }
      }
      if (msg.type === MessageType.LINK && msg.links && msg.links.length > 0) {
        for (const url of msg.links) {
          classifications.push({
            id: v7(),
            conversationId: command.conversationId,
            type: ClassificationType.LINK,
            senderId: command.senderId,
            linkUrl: url,
            messageId: msg.id,
            createdAt: msg.createdAt,
          });
        }
      }
    }

    if (classifications.length > 0) {
      await this.classificationRepo.insertBatch(classifications);
    }

    const primaryMsg =
      createdMessages.find((m) => m.type === MessageType.TEXT) ||
      createdMessages.find((m) => m.type === MessageType.LINK) ||
      createdMessages.find((m) => m.type === MessageType.IMAGE) ||
      createdMessages[0];

    await this.conversationCmdRepo.update(command.conversationId, {
      lastMessage: {
        messageId: primaryMsg.id,
        senderId: command.senderId,
        type: primaryMsg.type,
        textPreview: primaryMsg.text?.substring(0, 100) || quotedPreview,
        createdAt: primaryMsg.createdAt,
      },
      lastMessageAt: primaryMsg.createdAt,
    });

    return createdMessages;
  }

  private buildMessage(
    type: MessageType,
    text: string | undefined,
    media: any[] | undefined,
    conversationId: string,
    senderId: string,
    hasQuote: boolean,
    quotedMessageId?: string,
    quotedMessagePreview?: string,
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
      quotedMessageId: hasQuote ? quotedMessageId : undefined,
      quotedMessagePreview: hasQuote ? quotedMessagePreview : undefined,
      createdAt: now,
      pinned: false,
    };
  }
}

function shouldSplitByMedia(media?: any[]): boolean {
  return !!(media && media.length > 1);
}

function mapMediaToDbFormat(media: any[] | undefined) {
  if (!media) return undefined;
  return media.map((m) => ({
    url: m.url,
    mediaType: getMediaType(m.mimetype),
    name: m.filename,
    size: m.size,
  }));
}

function getMediaType(mimetype: string): MediaType {
  if (mimetype.startsWith("image/")) return MediaType.IMAGE;
  if (mimetype.startsWith("video/")) return MediaType.VIDEO;
  if (mimetype.startsWith("audio/")) return MediaType.AUDIO;
  return MediaType.FILE;
}
