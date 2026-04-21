import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IMessageQueryRepository } from "../interface";
import { TranslateMessageDTO, TranslateMessageResult } from "../model/dto/translate-message-dto";

export class TranslateMessageHandler
  implements ICommandHandler<TranslateMessageDTO, TranslateMessageResult>
{
  constructor(
    private readonly messageQueryRepo: IMessageQueryRepository,
  ) {}

  async execute(query: TranslateMessageDTO): Promise<TranslateMessageResult> {
    const { messageId, userId, targetLanguage } = query;

    const message = await this.messageQueryRepo.get(messageId);

    if (!message) {
      throw AppError.from(new Error("Message not found"), 404);
    }

    if (!message.text) {
      throw AppError.from(new Error("Message has no text content to translate"), 400);
    }

    const originalText = message.text;

    const translatedText = await this.translateText(originalText, targetLanguage);
    const detectedLanguage = this.detectLanguage(originalText);

    return {
      originalText,
      translatedText,
      detectedLanguage,
      targetLanguage,
    };
  }

  private async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=|${targetLanguage}`
      );
      const data = await response.json() as any;
      return data.responseData?.translatedText || text;
    } catch {
      return text;
    }
  }

  private detectLanguage(text: string): string {
    const vietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    if (vietnamese.test(text)) return "vi";
    return "en";
  }
}
