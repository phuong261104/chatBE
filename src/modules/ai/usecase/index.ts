import { SummarizationUseCase } from "./summarization.usecase";
import { SmartReplyUseCase } from "./smart-reply.usecase";
import { ToneAdjustmentUseCase } from "./tone-adjustment.usecase";
import { TranslationUseCase } from "./translation.usecase";

export { SummarizationUseCase };
export { SmartReplyUseCase };
export { ToneAdjustmentUseCase };
export { TranslationUseCase };

export class AiUseCaseFacade {
  constructor(
    private readonly summarization: SummarizationUseCase,
    private readonly smartReply: SmartReplyUseCase,
    private readonly toneAdjustment: ToneAdjustmentUseCase,
    private readonly translation: TranslationUseCase
  ) {}

  summarize = (request: Parameters<SummarizationUseCase["execute"]>[0]) =>
    this.summarization.execute(request);

  getSmartReplies = (request: Parameters<SmartReplyUseCase["execute"]>[0]) =>
    this.smartReply.execute(request);

  adjustTone = (request: Parameters<ToneAdjustmentUseCase["execute"]>[0]) =>
    this.toneAdjustment.execute(request);

  translate = (request: Parameters<TranslationUseCase["translate"]>[0]) =>
    this.translation.translate(request);

  detectLanguage = (request: Parameters<TranslationUseCase["detectLanguage"]>[0]) =>
    this.translation.detectLanguage(request);
}
