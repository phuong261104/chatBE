import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationMemberQueryRepository,
  IPollCommandRepository,
  IPollQueryRepository,
} from "../interface";
import {
  ConversationMemberStatus,
  Poll,
  PollStatus,
} from "../model/model";
import { AddPollOptionCommand, addPollOptionDTOSchema } from "../model/dto";

export class AddPollOptionHandler implements ICommandHandler<AddPollOptionCommand, Poll> {
  constructor(
    private readonly pollQueryRepo: IPollQueryRepository,
    private readonly pollCommandRepo: IPollCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(command: AddPollOptionCommand): Promise<Poll> {
    const { success, data, error } = addPollOptionDTOSchema.safeParse(command);
    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail("validationErrors", error.errors);
    }

    const poll = await this.pollQueryRepo.get(data.pollId);
    if (!poll) {
      throw AppError.from(new Error("Poll not found"), 404);
    }

    if (!poll.allowAddOption) {
      throw AppError.from(new Error("This poll does not allow adding options"), 403);
    }

    if (poll.status === PollStatus.CLOSED || (poll.expiresAt && new Date() > poll.expiresAt)) {
      throw AppError.from(new Error("Poll is closed"), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: poll.conversationId,
      userId: data.userId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    if (poll.options.some((option) => option.text.trim().toLowerCase() === data.text.trim().toLowerCase())) {
      throw AppError.from(new Error("Poll option already exists"), 409);
    }

    const options = [
      ...poll.options,
      {
        id: v7(),
        text: data.text.trim(),
        voteCount: 0,
        votedUserIds: [],
      },
    ];

    await this.pollCommandRepo.update(data.pollId, { options });
    const updated = await this.pollQueryRepo.get(data.pollId);
    if (!updated) {
      throw AppError.from(new Error("Failed to get updated poll"), 500);
    }
    return updated;
  }
}
