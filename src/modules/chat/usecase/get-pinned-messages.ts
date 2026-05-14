import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { ConversationMemberStatus, Message } from "../model/model";
import {
  IMessageQueryRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import {
  getPinnedMessagesDTOSchema,
  GetPinnedMessagesQuery,
} from "../model/dto";
import { ErrNotMember } from "../model/errors";

export class GetPinnedMessagesHandler
  implements IQueryHandler<GetPinnedMessagesQuery, Message[]>
{
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: GetPinnedMessagesQuery) {
    const { success, data, error } = getPinnedMessagesDTOSchema.safeParse(query);

    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail(
        "validationErrors",
        error.errors,
      );
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: data.conversationId,
      userId: data.userId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrNotMember, 403);
    }

    const messages = await this.messageQueryRepo.findPinnedMessages(
      data.conversationId,
    );

    return messages;
  }
}
