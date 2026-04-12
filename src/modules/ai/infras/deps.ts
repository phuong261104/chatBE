import { IAiProvider } from "./provider/interface";
import { IMessageQueryRepository, IConversationQueryRepository } from "@modules/chat/interface";

export interface IAiDeps {
  aiProvider: IAiProvider;
  messageRepo: IMessageQueryRepository;
  conversationRepo?: IConversationQueryRepository;
}
