import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IPollQueryRepository } from "../interface";
import { Poll, ConversationMemberStatus, ConversationType } from "../model/model";
import { IConversationQueryRepository, IConversationMemberQueryRepository } from "../interface";
import { sanitizePollForViewer } from "./group-permissions";

export class GetPollsHandler implements IQueryHandler<{ conversationId: string; userId: string }, Poll[]> {
  constructor(
    private readonly pollQueryRepo: IPollQueryRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: { conversationId: string; userId: string }): Promise<Poll[]> {
    const { conversationId, userId } = query;

    const conversation = await this.conversationQueryRepo.get(conversationId);
    if (!conversation) {
      throw AppError.from(new Error("Conversation not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Polls are only available in group conversations"), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    const polls = await this.pollQueryRepo.findByConversationId(conversationId);
    return polls.map((poll) => sanitizePollForViewer(poll, member, conversation));
  }
}
