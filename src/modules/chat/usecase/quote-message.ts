import { v7 } from "uuid";
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
import { Message, MessageMedia, MessageType, MessageClassification, ClassificationType, MediaType } from "@modules/chat/model/model";

function extractLinks(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(https?:\/\/[^\s]+)/g);
  return matches || [];
}

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
    if (!member) {
      throw new Error("User is not a member of this conversation");
    }

    const quotedPreview = quotedMessage.text
      ? quotedMessage.text.substring(0, 100)
      : "[Media]";

    const hasMedia = !!(command.media && command.media.length > 0);
    const hasText = !!command.text;
    const textLinks = hasText ? extractLinks(command.text || "") : [];
    const hasLinks = textLinks.length > 0;

    const now = new Date();
    const createdMessages: Message[] = [];

    if (shouldSplitByMedia(command.media)) {
      for (const m of command.media || []) {
        const isImg = m.mimetype.startsWith("image/");
        const msgType = isImg ? MessageType.IMAGE : MessageType.FILE;
        const hasTextAndNoLink = hasText && !hasLinks;
        const msg = this.buildMessage(
          msgType,
          hasTextAndNoLink ? command.text : undefined,
          mapMediaToDbFormat([m]),
          command.conversationId,
          command.senderId,
          false,
          undefined,
          undefined,
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
          false,
          undefined,
          undefined,
        );
        await this.messageCmdRepo.insert(linkMsg);
        createdMessages.push(linkMsg);
      }
    } else if (hasText && hasMedia && hasLinks) {
      const hasImage = command.media!.some((m: any) => m.mimetype.startsWith("image/"));
      const msgType = hasImage ? MessageType.IMAGE : MessageType.FILE;
      const mediaMsg = this.buildMessage(
        msgType,
        undefined,
        mapMediaToDbFormat(command.media),
        command.conversationId,
        command.senderId,
        false,
        undefined,
        undefined,
      );
      await this.messageCmdRepo.insert(mediaMsg);
      createdMessages.push(mediaMsg);

      const linkMsg = this.buildMessage(
        MessageType.LINK,
        command.text,
        undefined,
        command.conversationId,
        command.senderId,
        false,
        undefined,
        undefined,
      );
      await this.messageCmdRepo.insert(linkMsg);
      createdMessages.push(linkMsg);
    } else if (hasMedia) {
      const type = command.media!.some((m: any) => m.mimetype.startsWith("image/"))
        ? MessageType.IMAGE
        : MessageType.FILE;
      const msg = this.buildMessage(
        type,
        command.text,
        mapMediaToDbFormat(command.media),
        command.conversationId,
        command.senderId,
        false,
        undefined,
        undefined,
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
        type === MessageType.TEXT,
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
          const type = media.mediaType === "image" ? ClassificationType.IMAGE : ClassificationType.FILE;
          classifications.push({
            id: v7(),
            conversationId: command.conversationId,
            type,
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
    mediaType: m.mimetype.startsWith("image/") ? MediaType.IMAGE : MediaType.FILE,
    name: m.filename,
    size: m.size,
  }));
}
