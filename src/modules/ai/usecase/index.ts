import { SummarizationUseCase } from "./summarization.usecase";
import { SmartReplyUseCase } from "./smart-reply.usecase";
import { ToneAdjustmentUseCase } from "./tone-adjustment.usecase";
import { TranslationUseCase } from "./translation.usecase";
import { TaskExtractionUseCase } from "./task-extraction.usecase";
import { ModerationUseCase } from "./moderation.usecase";
import { SmartSearchUseCase } from "./smart-search.usecase";

export { SummarizationUseCase };
export { SmartReplyUseCase };
export { ToneAdjustmentUseCase };
export { TranslationUseCase };
export { TaskExtractionUseCase };
export { ModerationUseCase };
export { SmartSearchUseCase };

export class AiUseCaseFacade {
  constructor(
    private readonly summarization: SummarizationUseCase,
    private readonly smartReply: SmartReplyUseCase,
    private readonly toneAdjustment: ToneAdjustmentUseCase,
    private readonly translation: TranslationUseCase,
    private readonly taskExtractionUC: TaskExtractionUseCase,
    private readonly moderationUC: ModerationUseCase,
    private readonly smartSearchUC: SmartSearchUseCase,
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

  extractTasks = (request: Parameters<TaskExtractionUseCase["execute"]>[0]) =>
    this.taskExtractionUC.execute(request);

  moderateContent = (request: Parameters<ModerationUseCase["execute"]>[0]) =>
    this.moderationUC.execute(request);

  smartSearch = (request: Parameters<SmartSearchUseCase["execute"]>[0]) =>
    this.smartSearchUC.execute(request);
}
