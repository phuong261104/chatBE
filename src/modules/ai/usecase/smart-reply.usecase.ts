import { IAiProvider } from "../infras/provider/interface";
import { IAiDeps } from "../infras/deps";
import { SmartReplyRequest, SmartReplyResponse } from "../model/dto";

const SYSTEM_INSTRUCTION = "Ban la tro ly goi y tra loi nhanh cho tin nhan chat. Hay de xuat nhung cau tra loi tu nhien, than thien.";

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
    let lastMessageText = textPreview || "";
    let contextMessageText = "";

    if (userId && senderId === userId) {
      const messages = await this.deps.messageRepo!.listWithCursor(conversationId, undefined, 2, userId);
      if (messages.length >= 2) {
        contextMessageText = messages[1].text || "";
      }
    }

    if (!lastMessageText) {
      return { replies: DEFAULT_REPLIES, lastMessage: "", lastSenderName: undefined };
    }

    const promptText = contextMessageText
      ? `Dua tren tin nhan truoc do: "${contextMessageText}" va tin nhan cuoi: "${lastMessageText}", hay de xuat dung 3 cach tra loi ngan gon, tu nhien bang tieng Viet (moi cau khong qua 10 tu).\n\nChi tra ve 3 cau tra loi, moi cau 1 dong, khong danh so.`
      : `Dua tren tin nhan sau, hay de xuat dung 3 cach tra loi ngan gon, tu nhien bang tieng Viet (moi cau khong qua 10 tu):\n\n"${lastMessageText}"\n\nChi tra ve 3 cau tra loi, moi cau 1 dong, khong danh so.`;

    try {
      const result = await this.aiProvider.generateContent(promptText, SYSTEM_INSTRUCTION);

      const replies = result
        .split(/\n/)
        .map((line: string) => line.replace(/^[\d\.、\-\•]+/, "").trim())
        .filter((line: string) => line.length > 0 && line.length < 50)
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
