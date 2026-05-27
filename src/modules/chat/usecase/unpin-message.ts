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
  unpinMessageDTOSchema,
  UnpinMessageCommand,
} from "../model/dto";
import { ErrMessageNotFound, ErrNotMember, ErrMessageNotPinned, ErrNotAdmin } from "../model/errors";
import { SystemMessageTemplate } from "../constants/system-messages";
import { isGroupManager, canPinMessages, normalizeGroupSettings } from "./group-permissions";

export class UnpinMessageHandler
  implements ICommandHandler<UnpinMessageCommand, Message>
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

  async execute(command: UnpinMessageCommand) {
    const { success, data, error } = unpinMessageDTOSchema.safeParse(command);

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

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: message.conversationId,
      userId: data.userId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrNotMember, 403);
    }

    if (message.deletedAt || message.messageStatus === MessageStatus.REVOKED) {
      throw AppError.from(ErrMessageNotFound, 404);
    }

    const conversation = await this.conversationQueryRepo.get(message.conversationId);
    if (
      conversation?.type === ConversationType.GROUP
    ) {
      const settings = normalizeGroupSettings(conversation.settings);
      if (!canPinMessages(settings, member, conversation)) {
        throw AppError.from(ErrNotAdmin, 403);
      }
    }

    if (!message.pinned) {
      throw AppError.from(ErrMessageNotPinned, 400);
    }

    await this.messageCommandRepo.update(message.id, {
      pinned: false,
    });

    const updatedMessage = {
      ...message,
      pinned: false,
    };

    const actor = await this.userQueryRepo.get(data.userId);
    const actorDisplayName = actor?.displayName || "Unknown User";

    const now = new Date();
    const systemMsg: Message = {
      id: v7(),
      conversationId: message.conversationId,
      senderId: data.userId,
      type: MessageType.SYSTEM,
      text: SystemMessageTemplate.UNPIN_MESSAGE(actorDisplayName),
      createdAt: now,
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
          createdAt: now,
        },
        lastMessageAt: now,
      });
      await this.conversationMemberCommandRepo.touchActivityForConversation(message.conversationId, now);
    }

    return updatedMessage;
  }
}
