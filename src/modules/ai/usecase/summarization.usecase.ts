import { IAiProvider } from "../infras/provider/interface";
import { IAiDeps } from "../infras/deps";
import { SummarizeRequest, SummarizeResponse } from "../model/dto";

const SYSTEM_INSTRUCTION = "Bạn là trợ lý tóm tắt cuộc trò chuyện. Hãy tóm tắt ngắn gọn, rõ ràng.";
const MAX_MESSAGES = 50;

export class SummarizationUseCase {
  constructor(
    private aiProvider: IAiProvider,
    private deps: IAiDeps
  ) {}

  async execute(request: SummarizeRequest): Promise<SummarizeResponse> {
    const { conversationId, maxMessages = MAX_MESSAGES } = request;

    const messages = await this.deps.messageRepo.listWithCursor(
      conversationId,
      undefined,
      maxMessages
    );

    if (!messages || messages.length === 0) {
      return { summary: [], originalCount: 0, conversationId };
    }

    const conversationText = messages
      .slice()
      .reverse()
      .map((msg) => `User ${msg.senderId.slice(0, 8)}: ${msg.text || "[media]"}`)
      .join("\n");

    const prompt = `Tóm tắt cuộc trò chuyện sau thành 3-5 gạch đầu dòng ngắn gọn bằng tiếng Việt:\n\n${conversationText}`;

    const result = await this.aiProvider.generateContent(prompt, SYSTEM_INSTRUCTION);

    const summary = result
      .split(/\n|•|-|\*/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && line.length < 200);

    return {
      summary,
      originalCount: messages.length,
      conversationId,
    };
  }
}
