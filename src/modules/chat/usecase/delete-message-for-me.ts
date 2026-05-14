import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import {
  deleteMessageForMeDTOSchema,
  DeleteMessageForMeCommand,
} from "../model/dto";
import { ErrMessageNotFound, ErrNotMember } from "../model/errors";
import { ConversationMemberStatus, Message } from "../model/model";

export class DeleteMessageForMeHandler implements ICommandHandler<
  DeleteMessageForMeCommand,
  Message
> {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async getMessage(messageId: string): Promise<Message | null> {
    return this.messageQueryRepo.get(messageId);
  }

  async execute(command: DeleteMessageForMeCommand): Promise<Message> {
    const { success, data, error } =
      deleteMessageForMeDTOSchema.safeParse(command);

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

    const deletedForUserIds = new Set<string>(message.deletedForUserIds || []);

    if (!deletedForUserIds.has(data.userId)) {
      deletedForUserIds.add(data.userId);
      await this.messageCommandRepo.update(message.id, {
        deletedForUserIds: Array.from(deletedForUserIds),
      });
    }

    return message;
  }
}
