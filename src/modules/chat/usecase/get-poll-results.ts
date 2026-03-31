import { IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IPollQueryRepository } from "../interface";
import { Poll } from "../model/model";

export class GetPollResultsHandler implements IQueryHandler<{ pollId: string }, Poll> {
  constructor(
    private readonly pollQueryRepo: IPollQueryRepository,
  ) {}

  async query(query: { pollId: string }): Promise<Poll> {
    const { pollId } = query;

    const poll = await this.pollQueryRepo.get(pollId);
    if (!poll) {
      throw AppError.from(new Error("Poll not found"), 404);
    }

    return poll;
  }
}
