import { IAiProvider } from "../infras/provider/interface";
import { IAiDeps } from "../infras/deps";
import { SmartReplyRequest, SmartReplyResponse } from "../model/dto";

const SYSTEM_INSTRUCTION = "Ban la tro ly goi y tra loi nhanh cho tin nhan chat. Hay de xuat nhung cau tra loi tu nhien, than thien, da dang, phu hop voi van hoa va ngon ngu cua nguoi Viet Nam.";

const DEFAULT_REPLIES = ["U", "OK", "Biet roi"];

export class SmartReplyUseCase {
  constructor(
    private aiProvider: IAiProvider,
    private deps: IAiDeps
  ) {}

  async execute(request: SmartReplyRequest): Promise<SmartReplyResponse> {
    const { conversationId, userId } = request;

    const conversation = await this.deps.conversationRepo!.get(conversationId);
    if (!conversation || !conversation.lastMessage) {
      return { replies: DEFAULT_REPLIES, lastMessage: "", lastSenderName: undefined };
    }

    const { messageId, senderId, textPreview } = conversation.lastMessage;
    const lastMessageText = textPreview || "";

    if (!lastMessageText) {
      return { replies: DEFAULT_REPLIES, lastMessage: "", lastSenderName: undefined };
    }

    const contextMessages = await this.deps.messageRepo!.listWithCursor(conversationId, undefined, 15, undefined);

    const otherMessages = contextMessages
      .filter((m) => m.id !== messageId && m.text && m.text.trim().length > 0)
      .slice(0, 10);

    let promptText: string;
    if (otherMessages.length > 0) {
      const contextLines = otherMessages
        .map((m) => `[${m.senderId === userId ? "Toi" : "Nguoi khac"}]: "${m.text}"`)
        .join("\n");
      promptText = `Ban la tro ly goi y tra loi nhanh. Dua tren toan bo noi dung cuoi cung va cac tin nhan truoc do, hay de xuat 3 cach tra loi ngan gon, tu nhien, da dang, phu hop voi van hoa va ngon ngu cua nguoi Viet Nam (moi cau 5-15 tu).

Yeu cau:
- Cac cau tra loi phai khac nhau ve nghia va cach dien dat
- Co the la cau tra loi dong y, phan nan, dat cau hoi, hoac binh luan phu hop voi noi dung
- Tranh nhung cau tra loi nhu "OK", "U", "嗯" (chi dung neu thuc su phu hop)
- Cac cau tra loi phai tuan thu quy tac ngu phong Tieng Viet

Noi dung cac tin nhan gan day (tu cu len):
${contextLines}

Tin nhan cuoi can tra loi: "${lastMessageText}"

Chi tra ve 3 cau tra loi, moi cau 1 dong, khong danh so, khong ghi chu gi them.`;
    } else {
      promptText = `Ban la tro ly goi y tra loi nhanh. Dua tren tin nhan sau, hay de xuat 3 cach tra loi ngan gon, tu nhien, da dang, phu hop voi van hoa va ngon ngu cua nguoi Viet Nam (moi cau 5-15 tu).

Yeu cau:
- Cac cau tra loi phai khac nhau ve nghia va cach dien dat
- Co the la cau tra loi dong y, phan nan, dat cau hoi, hoac binh luan phu hop voi noi dung
- Tranh nhung cau tra loi nhu "OK", "U", "嗯" (chi dung neu thuc su phu hop)
- Cac cau tra loi phai tuan thu quy tac ngu phong Tieng Viet

"${lastMessageText}"

Chi tra ve 3 cau tra loi, moi cau 1 dong, khong danh so, khong ghi chu gi them.`;
    }

    try {
      const result = await this.aiProvider.generateContent(promptText, SYSTEM_INSTRUCTION);

      const replies = result
        .split(/\n/)
        .map((line: string) => line.replace(/^[\d\.、\-\•]+/, "").trim())
        .filter((line: string) => line.length > 0 && line.length < 80)
        .slice(0, 3);

      if (replies.length === 0) {
        return { replies: DEFAULT_REPLIES, lastMessage: lastMessageText, lastSenderName: undefined };
      }

      return {
        replies,
        lastMessage: lastMessageText,
        lastSenderName: undefined,
      };
    } catch {
      return { replies: DEFAULT_REPLIES, lastMessage: lastMessageText, lastSenderName: undefined };
    }
  }
}
