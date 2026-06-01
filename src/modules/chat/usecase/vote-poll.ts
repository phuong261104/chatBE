import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IConversationMemberQueryRepository,
  IMessageCommandRepository,
  IMessageQueryRepository,
  IPollQueryRepository,
  IPollCommandRepository,
} from "../interface";
import { ConversationMemberStatus, Message, MessageType, Poll, PollStatus } from "../model/model";
import { attachHiddenMessage, createConversationActivityMessage } from "./utility-messages";

const POLL_VOTE_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;

function uniqueStrings(values: string[] = []): string[] {
  return Array.from(new Set(values));
}

function normalizePollOptions(options: Poll["options"]): Poll["options"] {
  return options.map((option) => {
    const votedUserIds = uniqueStrings(option.votedUserIds);
    return {
      ...option,
      votedUserIds,
      voteCount: votedUserIds.length,
    };
  });
}

function countUniqueVoters(options: Poll["options"]): number {
  const voters = new Set<string>();
  for (const option of options) {
    for (const userId of option.votedUserIds) voters.add(userId);
  }
  return voters.size;
}

function getSelectedOptionIds(options: Poll["options"], userId: string): string[] {
  return options.filter((option) => option.votedUserIds.includes(userId)).map((option) => option.id);
}

function haveSameSelection(currentOptionIds: string[], requestedOptionIds: string[]): boolean {
  if (currentOptionIds.length !== requestedOptionIds.length) return false;
  const requested = new Set(requestedOptionIds);
  return currentOptionIds.every((optionId) => requested.has(optionId));
}

function attachVoteChanged<T extends Poll>(poll: T, voteChanged: boolean): T {
  Object.defineProperty(poll, "voteChanged", {
    value: voteChanged,
    enumerable: false,
    configurable: true,
  });
  return poll;
}

export class VotePollHandler implements ICommandHandler<{ pollId: string; userId: string; optionIds: string[] }, Poll> {
  constructor(
    private readonly pollQueryRepo: IPollQueryRepository,
    private readonly pollCommandRepo: IPollCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: { pollId: string; userId: string; optionIds: string[] }): Promise<Poll> {
    const { pollId, userId, optionIds } = command;
    const requestedOptionIds = uniqueStrings(optionIds);

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

    const normalizedOptions = normalizePollOptions(poll.options);
    const normalizedPoll: Poll = {
      ...poll,
      options: normalizedOptions,
      totalVotes: countUniqueVoters(normalizedOptions),
    };

    const optionIdsSet = new Set(normalizedOptions.map((o) => o.id));
    for (const optId of requestedOptionIds) {
      if (!optionIdsSet.has(optId)) {
        throw AppError.from(new Error(`Option ${optId} does not exist in this poll`), 400);
      }
    }

    if (!poll.isMultipleChoice && requestedOptionIds.length > 1) {
      throw AppError.from(new Error("Only one option can be selected for this poll"), 400);
    }

    const currentOptionIds = getSelectedOptionIds(normalizedOptions, userId);
    const userPreviouslyVoted = currentOptionIds.length > 0;
    const selectionChanged = !haveSameSelection(currentOptionIds, requestedOptionIds);

    if (!selectionChanged) {
      return attachVoteChanged(normalizedPoll, false);
    }

    if (userPreviouslyVoted && !poll.allowChangeVote) {
      throw AppError.from(new Error("You cannot change your vote on this poll"), 400);
    }

    const selectedOptionIds = new Set(requestedOptionIds);
    const updatedOptions = normalizedOptions.map((opt) => {
      const wasVoted = opt.votedUserIds.includes(userId);
      const willVote = selectedOptionIds.has(opt.id);

      let votedUserIds: string[];
      if (poll.isMultipleChoice) {
        if (willVote && !wasVoted) {
          votedUserIds = [...opt.votedUserIds, userId];
        } else if (!willVote && wasVoted) {
          votedUserIds = opt.votedUserIds.filter((id) => id !== userId);
        } else {
          votedUserIds = opt.votedUserIds;
        }
      } else {
        if (willVote) {
          votedUserIds = [...opt.votedUserIds.filter((id) => id !== userId), userId];
        } else {
          votedUserIds = opt.votedUserIds.filter((id) => id !== userId);
        }
      }

      return {
        ...opt,
        votedUserIds,
        voteCount: votedUserIds.length,
      };
    });

    const totalVotes = countUniqueVoters(updatedOptions);
    const activity = userPreviouslyVoted ? undefined : await this.writeVoteActivity(normalizedPoll, userId, totalVotes);

    await this.pollCommandRepo.update(pollId, {
      options: updatedOptions,
      totalVotes,
      ...(activity?.message && {
        lastVoteActivityAt: activity.message.createdAt,
        lastVoteActivityMessageId: activity.message.id,
        voteActivityCount: activity.count,
      }),
    });

    const updatedPoll = await this.pollQueryRepo.get(pollId);
    if (!updatedPoll) {
      throw AppError.from(new Error("Failed to get updated poll"), 500);
    }

    if (activity?.message) {
      attachHiddenMessage(updatedPoll, "activityMessage", activity.message);
      Object.defineProperty(updatedPoll, "activityMessageUpdated", {
        value: activity.updated,
        enumerable: false,
        configurable: true,
      });
    }

    return attachVoteChanged(updatedPoll, true);
  }

  private async writeVoteActivity(
    poll: Poll,
    userId: string,
    totalVotes: number,
  ): Promise<{ message: Message; updated: boolean; count: number } | undefined> {
    const now = new Date();
    const lastActivityAt = poll.lastVoteActivityAt ? new Date(poll.lastVoteActivityAt) : undefined;
    const canMerge =
      !!lastActivityAt &&
      !!poll.lastVoteActivityMessageId &&
      now.getTime() - lastActivityAt.getTime() <= POLL_VOTE_ACTIVITY_WINDOW_MS;

    if (canMerge) {
      const existing = await this.messageQueryRepo.get(poll.lastVoteActivityMessageId as string);
      if (existing) {
        const count = Math.min(totalVotes, Math.max(1, (poll.voteActivityCount || 1) + 1));
        const text = `${count} thành viên vừa bình chọn trong "${poll.question}"`;
        await this.messageCommandRepo.update(existing.id, { text });
        return {
          message: {
            ...existing,
            text,
          },
          updated: true,
          count,
        };
      }
    }

    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId: poll.conversationId,
      senderId: userId,
      type: MessageType.SYSTEM,
      text: `1 thành viên vừa bình chọn trong "${poll.question}"`,
      systemAction: "poll_vote_activity",
      systemRefId: poll.id,
      pollId: poll.id,
      createdAt: now,
    });

    return { message, updated: false, count: 1 };
  }
}
