import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationQueryRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import {
  ConversationMemberStatus,
  ConversationType,
  PollOption,
  Poll,
  PollStatus,
} from "../model/model";
import { CreatePollCommand } from "../model/dto";
import { IPollCommandRepository } from "../interface";
import { canUseGroupUtility, normalizeGroupSettings } from "./group-permissions";

export class CreatePollHandler implements ICommandHandler<CreatePollCommand, Poll> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly pollCommandRepo: IPollCommandRepository,
  ) {}

  async execute(command: CreatePollCommand): Promise<Poll> {
    const { conversationId, creatorId, question, options, isMultipleChoice, allowAddOption, showResultsBeforeClose, expiresAt } = command;

    const conversation = await this.conversationQueryRepo.get(conversationId);
    if (!conversation) {
      throw AppError.from(new Error("Conversation not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Polls can only be created in group conversations"), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId: creatorId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    const settings = normalizeGroupSettings(conversation.settings);
    if (!canUseGroupUtility(settings, "poll", member, conversation)) {
      throw AppError.from(new Error("Only owner or admins can create polls in this group"), 403);
    }

    const now = new Date();
    const pollOptions: PollOption[] = options.map((text) => ({
      id: v7(),
      text,
      voteCount: 0,
      votedUserIds: [],
    }));

    const poll: Poll = {
      id: v7(),
      conversationId,
      question,
      options: pollOptions,
      createdBy: creatorId,
      isMultipleChoice: isMultipleChoice || false,
      allowAddOption: allowAddOption || false,
      showResultsBeforeClose: showResultsBeforeClose ?? true,
      status: PollStatus.ACTIVE,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      pinned: false,
      totalVotes: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.pollCommandRepo.insert(poll);

    return poll;
  }
}
