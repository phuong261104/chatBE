import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageCommandRepository,
  IConversationCommandRepository,
  IMessageClassificationRepository,
} from "../interface";
import {
  ConversationMemberStatus,
  Message,
  MessageType,
  ConversationType,
} from "../model/model";

export class SendStickerHandler implements ICommandHandler<{
  conversationId: string;
  senderId: string;
  stickerUrl: string;
  stickerId?: string;
  packageId?: string;
}, Message> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
  ) {}

  async execute(command: {
    conversationId: string;
    senderId: string;
    stickerUrl: string;
    stickerId?: string;
    packageId?: string;
  }): Promise<Message> {
    const { conversationId, senderId, stickerUrl, stickerId, packageId } = command;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId: senderId,
    });

    if (!member) {
      throw AppError.from(new Error("Unauthorized: You are not a member of this conversation"), 403);
    }

    if (member.status !== ConversationMemberStatus.ACTIVE || (member as any).leftAt !== undefined) {
      throw AppError.from(new Error("You have left the conversation"), 403);
    }

    const id = v7();
    const now = new Date();
    const message: Message = {
      id,
      conversationId,
      senderId,
      type: MessageType.STICKER,
      text: undefined,
      media: [{
        url: stickerUrl,
        mediaType: "image" as any,
        name: stickerId || packageId || "sticker",
      }],
      createdAt: now,
      pinned: false,
    };

    await this.messageCommandRepo.insert(message);

    await this.conversationCommandRepo.update(conversationId, {
      lastMessage: {
        messageId: id,
        senderId,
        type: MessageType.STICKER,
        textPreview: "[Sticker]",
        createdAt: now,
      },
      lastMessageAt: now,
    } as any);

    return message;
  }
}

export class SendGifHandler implements ICommandHandler<{
  conversationId: string;
  senderId: string;
  gifUrl: string;
  provider?: string;
}, Message> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
  ) {}

  async execute(command: {
    conversationId: string;
    senderId: string;
    gifUrl: string;
    provider?: string;
  }): Promise<Message> {
    const { conversationId, senderId, gifUrl, provider } = command;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId: senderId,
    });

    if (!member) {
      throw AppError.from(new Error("Unauthorized: You are not a member of this conversation"), 403);
    }

    if (member.status !== ConversationMemberStatus.ACTIVE || (member as any).leftAt !== undefined) {
      throw AppError.from(new Error("You have left the conversation"), 403);
    }

    const id = v7();
    const now = new Date();
    const message: Message = {
      id,
      conversationId,
      senderId,
      type: MessageType.GIF,
      text: undefined,
      media: [{
        url: gifUrl,
        mediaType: "image" as any,
        name: `GIF from ${provider || "unknown"}`,
      }],
      createdAt: now,
      pinned: false,
    };

    await this.messageCommandRepo.insert(message);

    await this.conversationCommandRepo.update(conversationId, {
      lastMessage: {
        messageId: id,
        senderId,
        type: MessageType.GIF,
        textPreview: "[GIF]",
        createdAt: now,
      },
      lastMessageAt: now,
    } as any);

    return message;
  }
}