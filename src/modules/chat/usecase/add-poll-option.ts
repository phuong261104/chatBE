import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IConversationCommandRepository,
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
import { AddPollOptionCommand, addPollOptionDTOSchema } from "../model/dto";
import { attachHiddenMessage, createConversationActivityMessage } from "./utility-messages";

export class AddPollOptionHandler implements ICommandHandler<AddPollOptionCommand, Poll> {
  constructor(
    private readonly pollQueryRepo: IPollQueryRepository,
    private readonly pollCommandRepo: IPollCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
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
        addedBy: data.userId,
      },
    ];

    await this.pollCommandRepo.update(data.pollId, { options });
    const updated = await this.pollQueryRepo.get(data.pollId);
    if (!updated) {
      throw AppError.from(new Error("Failed to get updated poll"), 500);
    }

    const message = await createConversationActivityMessage({
      messageCommandRepo: this.messageCommandRepo,
      conversationCommandRepo: this.conversationCommandRepo,
      conversationMemberCommandRepo: this.conversationMemberCommandRepo,
      conversationId: poll.conversationId,
      senderId: data.userId,
      type: MessageType.SYSTEM,
      text: `đã thêm phương án "${data.text.trim()}" vào bình chọn "${poll.question}"`,
      systemAction: "poll_option_added",
      systemRefId: poll.id,
      pollId: poll.id,
      incrementUnread: false,
    });

    return attachHiddenMessage(updated, "systemMessage", message);
  }
}
