import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IConversationMemberQueryRepository, IConversationQueryRepository, IPollQueryRepository } from "../interface";
import { ConversationMemberStatus, Poll } from "../model/model";
import { sanitizePollForViewer } from "./group-permissions";

export class GetPollResultsHandler implements IQueryHandler<{ pollId: string; userId: string }, Poll> {
  constructor(
    private readonly pollQueryRepo: IPollQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
  ) {}

  async query(query: { pollId: string; userId: string }): Promise<Poll> {
    const { pollId, userId } = query;

    const poll = await this.pollQueryRepo.get(pollId);
    if (!poll) {
      throw AppError.from(new Error("Poll not found"), 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: poll.conversationId,
      userId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    const conversation = await this.conversationQueryRepo.get(poll.conversationId);
    return sanitizePollForViewer(poll, member, conversation);
  }
}
