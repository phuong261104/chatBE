import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IConversationMemberQueryRepository,
  IConversationQueryRepository,
  IMessageCommandRepository,
  IPollCommandRepository,
  IPollQueryRepository,
} from "../interface";
import {
  ConversationMemberStatus,
  MessageType,
  Poll,
  PollStatus,
} from "../model/model";
import { PollActionCommand } from "../model/dto";
import { isGroupManager } from "./group-permissions";
import { attachHiddenMessage, createConversationActivityMessage } from "./utility-messages";

abstract class PollManagerBase implements ICommandHandler<PollActionCommand, Poll> {
  constructor(
    protected readonly pollQueryRepo: IPollQueryRepository,
    protected readonly pollCommandRepo: IPollCommandRepository,
    protected readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    protected readonly conversationQueryRepo: IConversationQueryRepository,
    protected readonly messageCommandRepo: IMessageCommandRepository,
    protected readonly conversationCommandRepo: IConversationCommandRepository,
    protected readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
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
    const updated = await this.reload(command.pollId);
    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId: poll.conversationId,
      senderId: command.userId,
      type: MessageType.SYSTEM,
      text: `Đã khóa bình chọn "${poll.question}"`,
      systemAction: "poll_closed",
      systemRefId: poll.id,
      pollId: poll.id,
    });
    return attachHiddenMessage(updated, "systemMessage", message);
  }
}

export class PinPollHandler extends PollManagerBase {
  async execute(command: PollActionCommand): Promise<Poll> {
    const poll = await this.assertManager(command.pollId, command.userId);
    await this.pollCommandRepo.update(command.pollId, {
      pinned: true,
      pinnedAt: new Date(),
      pinnedBy: command.userId,
    });
    if (poll.messageId) {
      await this.messageCommandRepo.update(poll.messageId, {
        pinned: true,
        pinnedAt: new Date(),
      });
    }
    const updated = await this.reload(command.pollId);
    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId: poll.conversationId,
      senderId: command.userId,
      type: MessageType.SYSTEM,
      text: `Đã ghim bình chọn "${poll.question}"`,
      systemAction: "poll_pinned",
      systemRefId: poll.id,
      pollId: poll.id,
      incrementUnread: false,
    });
    return attachHiddenMessage(updated, "systemMessage", message);
  }
}

export class UnpinPollHandler extends PollManagerBase {
  async execute(command: PollActionCommand): Promise<Poll> {
    const poll = await this.assertManager(command.pollId, command.userId);
    await this.pollCommandRepo.update(command.pollId, {
      pinned: false,
      pinnedAt: null as any,
      pinnedBy: null as any,
    });
    if (poll.messageId) {
      await this.messageCommandRepo.update(poll.messageId, {
        pinned: false,
        pinnedAt: null as any,
      });
    }
    const updated = await this.reload(command.pollId);
    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId: poll.conversationId,
      senderId: command.userId,
      type: MessageType.SYSTEM,
      text: `Đã bỏ ghim bình chọn "${poll.question}"`,
      systemAction: "poll_unpinned",
      systemRefId: poll.id,
      pollId: poll.id,
      incrementUnread: false,
    });
    return attachHiddenMessage(updated, "systemMessage", message);
  }
}
