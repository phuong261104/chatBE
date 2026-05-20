import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageStatus,
  MessageType,
} from "../model/model";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IConversationQueryRepository,
  IConversationCommandRepository,
  IUserQueryRepository,
} from "../interface";
import {
  pinMessageDTOSchema,
  PinMessageCommand,
} from "../model/dto";
import { ErrMessageNotFound, ErrNotMember, ErrMessageAlreadyPinned, ErrNotAdmin } from "../model/errors";
import { SystemMessageTemplate } from "../constants/system-messages";
import { isGroupManager } from "./group-permissions";

const MAX_PINNED_MESSAGES_PER_CONVERSATION = 20;

export class PinMessageHandler
  implements ICommandHandler<PinMessageCommand, Message>
{
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly userQueryRepo: IUserQueryRepository,
  ) {}

  async execute(command: PinMessageCommand) {
    const { success, data, error } = pinMessageDTOSchema.safeParse(command);

    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail(
        "validationErrors",
        error.errors,
      );
    }

    const message = await this.messageQueryRepo.get(data.messageId);
    if (!message) {
      throw AppError.from(ErrMessageNotFound, 404);
    }

    if (message.deletedAt || message.messageStatus === MessageStatus.REVOKED) {
      throw AppError.from(ErrMessageNotFound, 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: message.conversationId,
      userId: data.userId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrNotMember, 403);
    }

    const conversation = await this.conversationQueryRepo.get(message.conversationId);
    if (
      conversation?.type === ConversationType.GROUP &&
      !isGroupManager(member, conversation)
    ) {
      throw AppError.from(ErrNotAdmin, 403);
    }

    if (message.pinned) {
      throw AppError.from(ErrMessageAlreadyPinned, 400);
    }

    const pinnedMessages = await this.messageQueryRepo.findPinnedMessages(
      message.conversationId,
    );

    if (pinnedMessages.length >= MAX_PINNED_MESSAGES_PER_CONVERSATION) {
      throw AppError.from(
        new Error(
          `Maximum ${MAX_PINNED_MESSAGES_PER_CONVERSATION} pinned messages per conversation`,
        ),
        400,
      );
    }

    const pinnedAt = new Date();
    await this.messageCommandRepo.update(message.id, {
      pinned: true,
      pinnedAt,
    });

    const updatedMessage = {
      ...message,
      pinned: true,
      pinnedAt,
    };

    const actor = await this.userQueryRepo.get(data.userId);
    const actorDisplayName = actor?.displayName || "Unknown User";

    const systemMsg: Message = {
      id: v7(),
      conversationId: message.conversationId,
      senderId: data.userId,
      type: MessageType.SYSTEM,
      text: SystemMessageTemplate.PIN_MESSAGE(actorDisplayName),
      createdAt: pinnedAt,
      pinned: false,
    };
    await this.messageCommandRepo.insert(systemMsg);

    if (conversation) {
      await this.conversationCommandRepo.update(message.conversationId, {
        lastMessage: {
          messageId: systemMsg.id,
          senderId: data.userId,
          type: MessageType.SYSTEM,
          textPreview: systemMsg.text,
          createdAt: pinnedAt,
        },
        lastMessageAt: pinnedAt,
      });
      await this.conversationMemberCommandRepo.touchActivityForConversation(message.conversationId, pinnedAt);
    }

    return updatedMessage;
  }
}
