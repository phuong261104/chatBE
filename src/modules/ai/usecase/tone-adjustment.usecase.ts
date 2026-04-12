import { IAiProvider } from "../infras/provider/interface";
import { ToneAdjustRequest, ToneAdjustResponse, ToneType } from "../model/dto";

const TONE_INSTRUCTIONS: Record<ToneType, string> = {
  formal: "Viết lại câu sau thành văn phong lịch sự, trang trọng, phù hợp trong công việc hoặc giao tiếp chuyên nghiệp.",
  casual: "Viết lại câu sau thành văn phong thân mật, gần gũi, thân thiện như đang trò chuyện với bạn bè.",
  funny: "Viết lại câu sau thành văn phong vui vẻ, hài hước, dí dởm.",
  professional: "Viết lại câu sau thành văn phong chuyên nghiệp, súc tích, phù hợp trong môi trường doanh nghiệp.",
};

export class ToneAdjustmentUseCase {
  constructor(private aiProvider: IAiProvider) {}

  async execute(request: ToneAdjustRequest): Promise<ToneAdjustResponse> {
    const { message, tone } = request;

    if (!message || message.trim().length === 0) {
      return { original: message, adjusted: message, tone };
    }

    if (!TONE_INSTRUCTIONS[tone]) {
      throw new Error(`Invalid tone type: ${tone}`);
    }

    const toneInstruction = TONE_INSTRUCTIONS[tone];
    const prompt = `${toneInstruction}\n\nCâu gốc: "${message}"\n\nChỉ trả về câu đã viết lại, không giải thích.`;

    const adjusted = await this.aiProvider.generateContent(prompt);
    const cleaned = adjusted.trim().replace(/^[""]|[""]$/g, "");

    return {
      original: message,
      adjusted: cleaned,
      tone,
    };
  }
}
