import { v7 } from "uuid";
import {
  IMessageQueryRepository,
  IMessageCommandRepository,
  IConversationMemberQueryRepository,
  IConversationCommandRepository,
} from "@modules/chat/interface";
import {
  QuoteMessageCommand,
} from "@modules/chat/model/dto";
import { Message, MessageMedia, MessageType } from "@modules/chat/model/model";

export class QuoteMessageHandler {
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCmdRepo: IMessageCommandRepository,
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationCmdRepo: IConversationCommandRepository,
  ) {}

  async execute(command: QuoteMessageCommand): Promise<Message> {
    const quotedMessage = await this.messageQueryRepo.get(command.quotedMessageId);
    if (!quotedMessage) {
      throw new Error("Quoted message not found");
    }

    if (quotedMessage.conversationId !== command.conversationId) {
      throw new Error("Quoted message is not in this conversation");
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: command.conversationId,
      userId: command.senderId,
    });
    if (!member) {
      throw new Error("User is not a member of this conversation");
    }

    const quotedPreview = quotedMessage.text
      ? quotedMessage.text.substring(0, 100)
      : "[Media]";

    const messageId = v7();
    const message: Message = {
      id: messageId,
      conversationId: command.conversationId,
      senderId: command.senderId,
      type: command.media?.length ? MessageType.FILE : MessageType.TEXT,
      text: command.text,
      media: command.media as MessageMedia[] | undefined,
      quotedMessageId: command.quotedMessageId,
      quotedMessagePreview: quotedPreview,
      createdAt: new Date(),
      pinned: false,
    };

    await this.messageCmdRepo.insert(message);

    await this.conversationCmdRepo.update(command.conversationId, {
      lastMessage: {
        messageId,
        senderId: command.senderId,
        type: message.type,
        textPreview: command.text?.substring(0, 50),
        createdAt: new Date(),
      },
      lastMessageAt: new Date(),
    });

    return message;
  }
}
