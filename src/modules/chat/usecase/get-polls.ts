import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IPollQueryRepository, IConversationQueryRepository, IConversationMemberQueryRepository } from "../interface";
import { Poll, ConversationMemberStatus, ConversationType, PollStatus } from "../model/model";
import { sanitizePollForViewer } from "./group-permissions";

export class GetPollsHandler implements IQueryHandler<{
  conversationId: string;
  userId: string;
  cursor?: string;
  limit?: number;
  status?: string;
}, { polls: Poll[]; nextCursor?: string; hasMore: boolean }> {
  constructor(
    private readonly pollQueryRepo: IPollQueryRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: {
    conversationId: string;
    userId: string;
    cursor?: string;
    limit?: number;
    status?: string;
  }): Promise<{ polls: Poll[]; nextCursor?: string; hasMore: boolean }> {
    const { conversationId, userId, cursor, limit = 20, status } = query;

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

    let polls = await this.pollQueryRepo.findByConversationId(conversationId, cursor, limit + 1);

    if (status) {
      const now = new Date();
      if (status === "active") {
        polls = polls.filter(
          (p) =>
            p.status === PollStatus.ACTIVE &&
            (!p.expiresAt || new Date(p.expiresAt) > now),
        );
      } else if (status === "closed") {
        polls = polls.filter((p) => p.status === PollStatus.CLOSED);
      } else if (status === "expired") {
        polls = polls.filter(
          (p) => p.status === PollStatus.ACTIVE && !!p.expiresAt && new Date(p.expiresAt) <= now,
        );
      }
    }

    const hasMore = polls.length > limit;
    if (hasMore) polls = polls.slice(0, limit);

    const lastItem = polls[polls.length - 1];
    const nextCursor = hasMore && lastItem
      ? Buffer.from(JSON.stringify({ id: lastItem.id, createdAt: lastItem.createdAt })).toString("base64")
      : undefined;

    const sanitizedPolls = polls.map((poll) => sanitizePollForViewer(poll, member, conversation));
    return { polls: sanitizedPolls, nextCursor, hasMore };
  }
}

export class GetPollHandler implements IQueryHandler<{ pollId: string; userId: string }, Poll> {
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

    const conversation = await this.conversationQueryRepo.get(poll.conversationId);
    if (conversation?.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Polls are only available in group conversations"), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: poll.conversationId,
      userId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    return sanitizePollForViewer(poll, member, conversation);
  }
}
