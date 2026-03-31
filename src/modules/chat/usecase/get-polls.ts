import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IPollQueryRepository } from "../interface";
import { Poll, ConversationType } from "../model/model";
import { IConversationQueryRepository, IConversationMemberQueryRepository } from "../interface";

export class GetPollsHandler implements IQueryHandler<{ conversationId: string }, Poll[]> {
  constructor(
    private readonly pollQueryRepo: IPollQueryRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: { conversationId: string }): Promise<Poll[]> {
    const { conversationId } = query;

    const conversation = await this.conversationQueryRepo.get(conversationId);
    if (!conversation) {
      throw AppError.from(new Error("Conversation not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Polls are only available in group conversations"), 400);
    }

    const polls = await this.pollQueryRepo.findByConversationId(conversationId);
    return polls;
  }
}
