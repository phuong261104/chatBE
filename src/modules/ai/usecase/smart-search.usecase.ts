import { IAiProvider } from "../infras/provider/interface";
import { IAiDeps } from "../infras/deps";
import {
  SmartSearchRequest,
  SmartSearchResponse,
  SmartSearchReference,
} from "../model/dto";

const SYSTEM_INSTRUCTION =
  "Ban la tro ly tim kiem thong minh. " +
  "Hãy tra loi cau hoi dua tren noi dung cuoc tro chuyen duoc cung cap. " +
  "Neu khong tim thay thong tin, hay tra loi rang khong co du lieu. " +
  "Neu co thong tin, hay tro chu thich nhung phan quan trong.";

const MAX_MESSAGES = 200;

export class SmartSearchUseCase {
  constructor(
    private aiProvider: IAiProvider,
    private deps: IAiDeps
  ) {}

  async execute(request: SmartSearchRequest): Promise<SmartSearchResponse> {
    const { query, conversationId } = request;

    if (!conversationId) {
      return {
        answer: "Vui long chon cuoc tro chuyen de tim kiem.",
        references: [],
      };
    }

    const messages = await this.deps.messageRepo.listWithCursor(
      conversationId,
      undefined,
      MAX_MESSAGES
    );

    if (!messages || messages.length === 0) {
      return {
        answer: "Khong tim thay thong tin trong cuoc tro chuyen de tra loi cau hoi nay.",
        references: [],
      };
    }

    const conversationText = messages
      .slice()
      .reverse()
      .map((msg) => `[${msg.senderId.slice(0, 8)}] ${msg.text || "[media]"}`)
      .join("\n");

    const prompt = `Dua tren noi dung cuoc tro chuyen sau, hay tra loi cau hoi:\n\n"Cau hoi: ${query}"\n\nNoi dung tro chuyen:\n${conversationText}\n\nHay tra loi dua tren noi dung tren, va neu co thi danh sach cac tin nhan tham chieu (chi bao gom messageId, conversationId, senderId, text, createdAt). Tra ve JSON:\n{\n  "answer": "Cau tra loi cua ban",\n  "references": [\n    { "messageId": "...", "conversationId": "...", "text": "...", "senderId": "...", "createdAt": "..." }\n  ]\n}\nChi tra ve JSON hop le.`;

    const raw = await this.aiProvider.generateContent(prompt, SYSTEM_INSTRUCTION);

    let answer = "Khong the phan tich noi dung.";
    const references: SmartSearchReference[] = [];

    try {
      const cleaned = this.extractJsonFromResponse(raw);
      const json = JSON.parse(cleaned);
      answer = json.answer || answer;
      if (Array.isArray(json.references)) {
        for (const ref of json.references) {
          if (ref.messageId || ref.conversationId) {
            references.push({
              messageId: ref.messageId || "",
              conversationId: ref.conversationId || conversationId || "",
              text: ref.text || "",
              senderId: ref.senderId || "",
              createdAt: ref.createdAt || "",
            });
          }
        }
      }
    } catch {
      answer = raw.trim();
    }

    return { answer, references };
  }

  private extractJsonFromResponse(text: string): string {
    const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
    return match ? (match[1] || match[0]) : text;
  }
}
