import { IAiProvider } from "../infras/provider/interface";
import {
  ModerateContentRequest,
  ModerateContentResponse,
  ModerationResult,
  ModerationCategory,
} from "../model/dto";

const SYSTEM_INSTRUCTION =
  "Ban la tro ly kiem tra noi dung nhạy cam. " +
  "Hãy phan tich noi dung duoi day theo cac danh muc: " +
  "toxicity (noi dung doc dao), hate_speech (lời noi thuong tan), " +
  "harassment (quấy rối), violence (bạo lực), sexual_content (nội dung khiêu dâm), " +
  "self_harm (tự hại), spam, misinformation (thông tin sai lam). " +
  "Tra ve ket qua danh gia cho tung danh muc.";

const CATEGORIES: ModerationCategory[] = [
  "toxicity",
  "hate_speech",
  "harassment",
  "violence",
  "sexual_content",
  "self_harm",
  "spam",
  "misinformation",
];

const WARNING_MESSAGES: Record<ModerationCategory, string> = {
  toxicity: "Nội dung có thể mang tính công kích. Vui lòng kiểm tra lại.",
  hate_speech: "Nội dung có thể chứa lời nói thù địch. Vui lòng kiểm tra lại.",
  harassment: "Nội dung có thể mang tính quấy rối. Vui lòng kiểm tra lại.",
  violence: "Nội dung có thể chứa bạo lực. Vui lòng kiểm tra lại.",
  sexual_content: "Nội dung có thể không phù hợp. Vui lòng kiểm tra lại.",
  self_harm: "Nội dung có thể liên quan đến tự hại. Vui lòng kiểm tra lại.",
  spam: "Nội dung có thể là thư rác. Vui lòng kiểm tra lại.",
  misinformation: "Nội dung có thể chứa thông tin sai lệch. Vui lòng kiểm tra lại.",
};

export class ModerationUseCase {
  constructor(private aiProvider: IAiProvider) {}

  async execute(request: ModerateContentRequest): Promise<ModerateContentResponse> {
    const { text } = request;

    if (!text || text.trim().length === 0) {
      return { isSafe: true, categories: [], confidence: 1 };
    }

    const prompt = `Hãy phan tich noi dung sau va tra ve ket qua danh gia cho tung danh muc:
{
  "results": [
    {
      "category": "ten_danh_muc",
      "isViolated": true/false,
      "confidence": 0.0 - 1.0
    }
  ]
}
Chi tra ve JSON hop le.\n\nNoi dung: "${text}"`;

    const raw = await this.aiProvider.generateContent(prompt, SYSTEM_INSTRUCTION);

    let rawResults: ModerationResult[] = [];
    try {
      const cleaned = this.extractJsonFromResponse(raw);
      const json = JSON.parse(cleaned);
      if (Array.isArray(json.results)) {
        rawResults = json.results.map((r: any) => ({
          category: CATEGORIES.includes(r.category as ModerationCategory)
            ? (r.category as ModerationCategory)
            : "toxicity",
          isViolated: Boolean(r.isViolated),
          confidence: Math.min(1, Math.max(0, Number(r.confidence) || 0)),
        }));
      }
    } catch {
      rawResults = [];
    }

    const violatedCategories = rawResults.filter((r) => r.isViolated);
    const isSafe = violatedCategories.length === 0;

    let warningMessage: string | undefined;
    if (!isSafe) {
      const topViolation = violatedCategories.sort(
        (a, b) => b.confidence - a.confidence
      )[0];
      warningMessage = WARNING_MESSAGES[topViolation.category] || WARNING_MESSAGES.toxicity;
    }

    const avgConfidence =
      rawResults.length > 0
        ? rawResults.reduce((sum, r) => sum + r.confidence, 0) / rawResults.length
        : 1;

    return {
      isSafe,
      categories: rawResults,
      confidence: avgConfidence,
      warningMessage,
    };
  }

  private extractJsonFromResponse(text: string): string {
    const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
    return match ? (match[1] || match[0]) : text;
  }
}
