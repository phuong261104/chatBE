import { getGeminiProvider } from "./infras/provider/gemini-provider";
import { AiHttpService } from "./infras/transport/http-service";
import { IAiDeps } from "./infras/deps";
import {
  AiUseCaseFacade,
  SummarizationUseCase,
  SmartReplyUseCase,
  ToneAdjustmentUseCase,
  TranslationUseCase,
} from "./usecase";
import {
  IMessageQueryRepository,
  IConversationQueryRepository,
} from "@modules/chat/interface";

export function setupAiHexagon(deps: {
  messageRepo: IMessageQueryRepository;
  conversationRepo: IConversationQueryRepository;
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

  const aiFacade = new AiUseCaseFacade(
    summarization,
    smartReply,
    toneAdjustment,
    translation,
  );

  const httpService = new AiHttpService(aiFacade);

  return {
    router: httpService.router,
    aiFacade,
    geminiProvider,
  };
}

export {
  AiUseCaseFacade,
  SummarizationUseCase,
  SmartReplyUseCase,
  ToneAdjustmentUseCase,
  TranslationUseCase,
};
export { AiHttpService } from "./infras/transport/http-service";
// export { seedAiTestData } from "./infras/ai-seed";
