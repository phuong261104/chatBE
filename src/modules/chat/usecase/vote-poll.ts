import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IPollQueryRepository, IPollCommandRepository } from "../interface";
import { Poll, PollOption } from "../model/model";

export class VotePollHandler implements ICommandHandler<{ pollId: string; userId: string; optionIds: string[] }, Poll> {
  constructor(
    private readonly pollQueryRepo: IPollQueryRepository,
    private readonly pollCommandRepo: IPollCommandRepository,
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

    const updatedOptions = poll.options.map((opt) => {
      if (optionIds.includes(opt.id)) {
        if (!opt.votedUserIds.includes(userId)) {
          return {
            ...opt,
            voteCount: opt.voteCount + 1,
            votedUserIds: [...opt.votedUserIds, userId],
          };
        }
      }
      return opt;
    });

    const newTotalVotes = updatedOptions.reduce((sum, opt) => sum + opt.voteCount, 0);

    await this.pollCommandRepo.update(pollId, {
      options: updatedOptions,
      totalVotes: newTotalVotes,
    });

    const updatedPoll = await this.pollQueryRepo.get(pollId);
    if (!updatedPoll) {
      throw AppError.from(new Error("Failed to get updated poll"), 500);
    }

    return updatedPoll;
  }
}
