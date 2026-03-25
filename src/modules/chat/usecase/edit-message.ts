import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import { Message } from "../model/model";
import { editMessageDTOSchema, EditMessageCommand } from "../model/dto";
import {
  ErrMessageNotFound,
  ErrMessageUnauthorized,
  ErrMessageAlreadyDeleted,
  ErrMessageCannotEdit,
  ErrMessageEditTimeExpired,
  ErrNotMember,
} from "../model/errors";

const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000;

export class EditMessageHandler
  implements ICommandHandler<EditMessageCommand, Message>
{
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(command: EditMessageCommand): Promise<Message> {
    const { success, data, error } = editMessageDTOSchema.safeParse(command);

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

    if (message.senderId !== data.userId) {
      throw AppError.from(ErrMessageUnauthorized, 403);
    }

    if (message.deletedAt) {
      throw AppError.from(ErrMessageAlreadyDeleted, 400);
    }

    if (message.type !== "text") {
      throw AppError.from(ErrMessageCannotEdit, 400);
    }

    const elapsed = Date.now() - message.createdAt.getTime();
    if (elapsed > EDIT_TIME_LIMIT_MS) {
      throw AppError.from(ErrMessageEditTimeExpired, 400);
    }

    const editedAt = new Date();

    await this.messageCommandRepo.update(message.id, {
      text: data.text,
      editedAt,
    });

    return {
      ...message,
      text: data.text,
      editedAt,
    };
  }
}
