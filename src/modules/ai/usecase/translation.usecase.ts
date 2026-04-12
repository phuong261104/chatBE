import crypto from "crypto";
import { IAiProvider } from "../infras/provider/interface";
import { RedisClient } from "@share/component/redis-pubsub/redis";
import { TranslateRequest, TranslateResponse, DetectLanguageRequest } from "../model/dto";

const TRANSLATION_SYSTEM = "Bạn là trợ lý dịch thuật. Chỉ trả về bản dịch, không giải thích.";

const LANGUAGE_CACHE_TTL = 60 * 60 * 24 * 7;

export class TranslationUseCase {
  constructor(private aiProvider: IAiProvider) {}

  private getCacheKey(text: string, targetLang: string): string {
    const hash = crypto.createHash("md5").update(`${text}:${targetLang}`).digest("hex");
    return `ai:translation:${hash}`;
  }

  async translate(request: TranslateRequest): Promise<TranslateResponse> {
    const { text, targetLang, sourceLang } = request;

    if (!text || text.trim().length === 0) {
      return { original: text, translated: text, sourceLang: sourceLang || "unknown", targetLang };
    }

    const cacheKey = this.getCacheKey(text, targetLang);
    const cached = await this.getCachedTranslation(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const prompt = `Dịch tin nhắn sau sang tiếng ${targetLang}. Chỉ trả về bản dịch, không giải thích:\n\n"${text}"`;

    const translated = await this.aiProvider.generateContent(prompt, TRANSLATION_SYSTEM);
    const cleaned = translated.trim().replace(/^[""]|[""]$/g, "");

    const detectedLang = sourceLang || await this.detectLanguage({ text });

    const response: TranslateResponse = {
      original: text,
      translated: cleaned,
      sourceLang: detectedLang,
      targetLang,
    };

    await this.cacheTranslation(cacheKey, JSON.stringify(response));
    return response;
  }

  async detectLanguage(request: DetectLanguageRequest): Promise<string> {
    const { text } = request;

    if (!text || text.trim().length === 0) {
      return "không xác định";
    }

    const prompt = `Xác định ngôn ngữ của tin nhắn sau và chỉ trả về tên ngôn ngữ bằng tiếng Việt (ví dụ: tiếng Anh, tiếng Việt, tiếng Trung, tiếng Nhật, tiếng Hàn, tiếng Pháp, tiếng Đức, tiếng Tây Ban Nha, tiếng Ả Rập, tiếng Nga, không xác định):\n\n"${text.substring(0, 100)}"`;

    try {
      const result = await this.aiProvider.generateContent(prompt);
      return this.normalizeLanguageName(result.trim());
    } catch {
      return "không xác định";
    }
  }

  private normalizeLanguageName(name: string): string {
    const langMap: Record<string, string> = {
      english: "tiếng Anh",
      vietnamese: "tiếng Việt",
      chinese: "tiếng Trung",
      japanese: "tiếng Nhật",
      korean: "tiếng Hàn",
      french: "tiếng Pháp",
      german: "tiếng Đức",
      spanish: "tiếng Tây Ban Nha",
      arabic: "tiếng Ả Rập",
      russian: "tiếng Nga",
      thai: "tiếng Thái",
      indonesian: "tiếng Indonesia",
      malay: "tiếng Mã Lai",
      portuguese: "tiếng Bồ Đào Nha",
      italian: "tiếng Ý",
      dutch: "tiếng Hà Lan",
      unknown: "không xác định",
    };

    const lower = name.toLowerCase().replace(/^[""]|[""]$/g, "");
    return langMap[lower] || name;
  }

  private async getCachedTranslation(key: string): Promise<string | null> {
    try {
      const redis = RedisClient.getClient();
      return await redis.get(key);
    } catch {
      return null;
    }
  }

  private async cacheTranslation(key: string, value: string): Promise<void> {
    try {
      const redis = RedisClient.getClient();
      await redis.setEx(key, LANGUAGE_CACHE_TTL, value);
    } catch {
    }
  }
}
