import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import { Message, MessageType } from "../model/model";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
  IConversationQueryRepository,
  IConversationCommandRepository,
  IUserQueryRepository,
} from "../interface";
import {
  unpinMessageDTOSchema,
  UnpinMessageCommand,
} from "../model/dto";
import { ErrMessageNotFound, ErrNotMember, ErrMessageNotPinned } from "../model/errors";
import { SystemMessageTemplate } from "../constants/system-messages";

export class UnpinMessageHandler
  implements ICommandHandler<UnpinMessageCommand, Message>
{
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
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

    if (!member || member.leftAt) {
      throw AppError.from(ErrNotMember, 403);
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

    const [actor, conversation] = await Promise.all([
      this.userQueryRepo.get(data.userId),
      this.conversationQueryRepo.get(message.conversationId),
    ]);
    const actorDisplayName = actor?.displayName || "Unknown User";

    const systemMsg: Message = {
      id: v7(),
      conversationId: message.conversationId,
      senderId: data.userId,
      type: MessageType.SYSTEM,
      text: SystemMessageTemplate.UNPIN_MESSAGE(actorDisplayName),
      createdAt: new Date(),
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
          createdAt: new Date(),
        },
        lastMessageAt: new Date(),
      });
    }

    return updatedMessage;
  }
}
