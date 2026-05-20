import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IConversationMemberQueryRepository, IPollQueryRepository, IPollCommandRepository } from "../interface";
import { ConversationMemberStatus, Poll, PollStatus } from "../model/model";

export class VotePollHandler implements ICommandHandler<{ pollId: string; userId: string; optionIds: string[] }, Poll> {
  constructor(
    private readonly pollQueryRepo: IPollQueryRepository,
    private readonly pollCommandRepo: IPollCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(command: { pollId: string; userId: string; optionIds: string[] }): Promise<Poll> {
    const { pollId, userId, optionIds } = command;

    const poll = await this.pollQueryRepo.get(pollId);
    if (!poll) {
      throw AppError.from(new Error("Poll not found"), 404);
    }

    if (poll.expiresAt && new Date() > poll.expiresAt) {
      throw AppError.from(new Error("Poll has expired"), 400);
    }

    if (poll.status === PollStatus.CLOSED) {
      throw AppError.from(new Error("Poll is closed"), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: poll.conversationId,
      userId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    if (!poll.options || poll.options.length === 0) {
      throw AppError.from(new Error("Poll has no options"), 400);
    }

    const optionIdsSet = new Set(poll.options.map((o) => o.id));
    for (const optId of optionIds) {
      if (!optionIdsSet.has(optId)) {
        throw AppError.from(new Error(`Option ${optId} does not exist in this poll`), 400);
      }
    }

    if (!poll.isMultipleChoice && optionIds.length > 1) {
      throw AppError.from(new Error("Only one option can be selected for this poll"), 400);
    }

    const selectedOptionIds = new Set(optionIds);
    const updatedOptions = poll.options.map((opt) => {
      const existingVotes = opt.votedUserIds.filter((id) => id !== userId);
      const votedUserIds = selectedOptionIds.has(opt.id)
        ? [...existingVotes, userId]
        : existingVotes;

      return {
        ...opt,
        votedUserIds,
        voteCount: votedUserIds.length,
      };
    });

    const uniqueVoters = new Set<string>();
    for (const option of updatedOptions) {
      for (const votedUserId of option.votedUserIds) {
        uniqueVoters.add(votedUserId);
      }
    }

    await this.pollCommandRepo.update(pollId, {
      options: updatedOptions,
      totalVotes: uniqueVoters.size,
    });

    const updatedPoll = await this.pollQueryRepo.get(pollId);
    if (!updatedPoll) {
      throw AppError.from(new Error("Failed to get updated poll"), 500);
    }

    return updatedPoll;
  }
}
