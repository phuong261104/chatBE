import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationCommandRepository,
  IConversationMemberCommandRepository,
  IConversationMemberQueryRepository,
  IConversationQueryRepository,
} from "../interface";
import { Conversation, Message } from "../model/model";
import {
  SaveMessagesToMyDocumentCommand,
  saveMessagesToMyDocumentDTOSchema,
} from "../model/dto";
import { ForwardMessagesHandler } from "./forward-messages";
import {
  ensureSelfConversation,
  normalizeConversationListItem,
} from "./conversation-listing";

export type SaveMessagesToMyDocumentResult = {
  conversation: Conversation & {
    name: string;
    isSelfChat: true;
    pinned?: boolean;
    isPinned?: boolean;
    pinnedAt?: Date;
  };
  messages: Message[];
};

export class SaveMessagesToMyDocumentHandler implements ICommandHandler<
  SaveMessagesToMyDocumentCommand,
  SaveMessagesToMyDocumentResult
> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly forwardMessagesHandler: ForwardMessagesHandler,
  ) {}

  async execute(command: SaveMessagesToMyDocumentCommand): Promise<SaveMessagesToMyDocumentResult> {
    const { success, data, error } = saveMessagesToMyDocumentDTOSchema.safeParse(command);
    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail(
        "validationErrors",
        error.errors,
      );
    }

    const { conversation, member } = await ensureSelfConversation(
      data.userId,
      this.conversationQueryRepo,
      this.conversationCommandRepo,
      this.conversationMemberQueryRepo,
      this.conversationMemberCommandRepo,
    );

    const messages = await this.forwardMessagesHandler.execute({
      userId: data.userId,
      messageIds: data.messageIds,
      targetConversationIds: [conversation.id],
    });

    return {
      conversation: normalizeConversationListItem({
        ...conversation,
        pinned: !!member.pinned,
        isPinned: !!member.pinned,
        pinnedAt: member.pinnedAt || undefined,
        isSelfChat: true,
      }, data.userId) as SaveMessagesToMyDocumentResult["conversation"],
      messages,
    };
  }
}
