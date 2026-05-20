import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IConversationQueryRepository,
  IPollCommandRepository,
  IPollQueryRepository,
} from "../interface";
import {
  ConversationMemberStatus,
  Poll,
  PollStatus,
} from "../model/model";
import { PollActionCommand } from "../model/dto";
import { isGroupManager } from "./group-permissions";

abstract class PollManagerBase implements ICommandHandler<PollActionCommand, Poll> {
  constructor(
    protected readonly pollQueryRepo: IPollQueryRepository,
    protected readonly pollCommandRepo: IPollCommandRepository,
    protected readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    protected readonly conversationQueryRepo: IConversationQueryRepository,
  ) {}

  abstract execute(command: PollActionCommand): Promise<Poll>;

  protected async assertManager(pollId: string, userId: string): Promise<Poll> {
    const poll = await this.pollQueryRepo.get(pollId);
    if (!poll) {
      throw AppError.from(new Error("Poll not found"), 404);
    }

    const [conversation, member] = await Promise.all([
      this.conversationQueryRepo.get(poll.conversationId),
      this.conversationMemberQueryRepo.findByCond({
        conversationId: poll.conversationId,
        userId,
      }),
    ]);

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    if (!isGroupManager(member, conversation) && poll.createdBy !== userId) {
      throw AppError.from(new Error("Only poll creator, owner or admins can manage this poll"), 403);
    }

    return poll;
  }

  protected async reload(pollId: string): Promise<Poll> {
    const poll = await this.pollQueryRepo.get(pollId);
    if (!poll) {
      throw AppError.from(new Error("Failed to get updated poll"), 500);
    }
    return poll;
  }
}

export class ClosePollHandler extends PollManagerBase {
  async execute(command: PollActionCommand): Promise<Poll> {
    const poll = await this.assertManager(command.pollId, command.userId);
    if (poll.status === PollStatus.CLOSED) {
      return poll;
    }

    await this.pollCommandRepo.update(command.pollId, {
      status: PollStatus.CLOSED,
      closedAt: new Date(),
      closedBy: command.userId,
    });
    return this.reload(command.pollId);
  }
}

export class PinPollHandler extends PollManagerBase {
  async execute(command: PollActionCommand): Promise<Poll> {
    await this.assertManager(command.pollId, command.userId);
    await this.pollCommandRepo.update(command.pollId, {
      pinned: true,
      pinnedAt: new Date(),
      pinnedBy: command.userId,
    });
    return this.reload(command.pollId);
  }
}

export class UnpinPollHandler extends PollManagerBase {
  async execute(command: PollActionCommand): Promise<Poll> {
    await this.assertManager(command.pollId, command.userId);
    await this.pollCommandRepo.update(command.pollId, {
      pinned: false,
      pinnedAt: null as any,
      pinnedBy: null as any,
    });
    return this.reload(command.pollId);
  }
}
