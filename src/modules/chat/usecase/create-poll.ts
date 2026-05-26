import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IConversationQueryRepository,
  IConversationMemberQueryRepository,
  IMessageCommandRepository,
} from "../interface";
import {
  ConversationMemberStatus,
  ConversationType,
  MessageType,
  PollOption,
  Poll,
  PollStatus,
} from "../model/model";
import { CreatePollCommand } from "../model/dto";
import { IPollCommandRepository } from "../interface";
import { canUseGroupUtility, normalizeGroupSettings } from "./group-permissions";
import { attachHiddenMessage, createConversationActivityMessage } from "./utility-messages";

export class CreatePollHandler implements ICommandHandler<CreatePollCommand, Poll> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly pollCommandRepo: IPollCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: CreatePollCommand): Promise<Poll> {
    const {
      conversationId,
      creatorId,
      question,
      options,
      isMultipleChoice,
      allowAddOption,
      showResultsBeforeClose,
      hideVoters,
      expiresAt,
    } = command;

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
      hideVoters: hideVoters || false,
      status: PollStatus.ACTIVE,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      pinned: false,
      totalVotes: 0,
      voteActivityCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId,
      senderId: creatorId,
      type: MessageType.POLL,
      text: `Bình chọn: ${question}`,
      pollId: poll.id,
      createdAt: now,
    });
    poll.messageId = message.id;

    await this.pollCommandRepo.insert(poll);

    return attachHiddenMessage(poll, "timelineMessage", message);
  }
}
