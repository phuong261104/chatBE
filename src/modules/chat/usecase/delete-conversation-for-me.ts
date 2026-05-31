import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberCommandRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import { ConversationMemberStatus } from "../model/model";

export type DeleteConversationForMeCommand = {
  conversationId: string;
  userId: string;
};

export type DeleteConversationForMeResult = {
  conversationId: string;
  deletedAt: Date;
};

export class DeleteConversationForMeHandler
  implements ICommandHandler<DeleteConversationForMeCommand, DeleteConversationForMeResult>
{
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: DeleteConversationForMeCommand): Promise<DeleteConversationForMeResult> {
    const member = await this.memberQueryRepo.findByCond({
      conversationId: command.conversationId,
      userId: command.userId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("Conversation not found"), 404);
    }

    const deletedAt = new Date();
    await this.memberCommandRepo.update(member.id, {
      deletedAt,
      unreadCount: 0,
      pinned: false,
      pinnedAt: null,
      archived: false,
    } as any);

    return {
      conversationId: command.conversationId,
      deletedAt,
    };
  }
}
