import { Server } from "socket.io";
import { getGeminiProvider } from "./infras/provider/gemini-provider";
import { AiHttpService } from "./infras/transport/http-service";
import { AiSocketService } from "./infras/transport/socket/ai-socket-service";
import { IAiDeps } from "./infras/deps";
import {
  AiUseCaseFacade,
  SummarizationUseCase,
  SmartReplyUseCase,
  ToneAdjustmentUseCase,
  TranslationUseCase,
  TaskExtractionUseCase,
  ModerationUseCase,
  SmartSearchUseCase,
} from "./usecase";
import {
  IMessageQueryRepository,
  IConversationQueryRepository,
} from "@modules/chat/interface";

export function setupAiHexagon(deps: {
  messageRepo: IMessageQueryRepository;
  conversationRepo: IConversationQueryRepository;
  io?: Server;
}) {
  const geminiProvider = getGeminiProvider();

  const aiDeps: IAiDeps = {
    aiProvider: geminiProvider,
    messageRepo: deps.messageRepo,
    conversationRepo: deps.conversationRepo,
  };

  const summarization = new SummarizationUseCase(geminiProvider, aiDeps);
  const smartReply = new SmartReplyUseCase(geminiProvider, aiDeps);
  const toneAdjustment = new ToneAdjustmentUseCase(geminiProvider);
  const translation = new TranslationUseCase(geminiProvider);
  const taskExtractionUC = new TaskExtractionUseCase(geminiProvider, aiDeps);
  const moderationUC = new ModerationUseCase(geminiProvider);
  const smartSearchUC = new SmartSearchUseCase(geminiProvider, aiDeps);

  const aiFacade = new AiUseCaseFacade(
    summarization,
    smartReply,
    toneAdjustment,
    translation,
    taskExtractionUC,
    moderationUC,
    smartSearchUC,
  );

  const httpService = new AiHttpService(aiFacade);

  let socketService: AiSocketService | undefined;
  if (deps.io) {
    socketService = new AiSocketService(deps.io, aiFacade);
  }

  return {
    router: httpService.router,
    aiFacade,
    geminiProvider,
    socketService,
  };
}

export {
  AiUseCaseFacade,
  SummarizationUseCase,
  SmartReplyUseCase,
  ToneAdjustmentUseCase,
  TranslationUseCase,
  TaskExtractionUseCase,
  ModerationUseCase,
  SmartSearchUseCase,
};
export { AiHttpService } from "./infras/transport/http-service";
export { AiSocketService } from "./infras/transport/socket/ai-socket-service";
