import { IAiProvider } from "../infras/provider/interface";
import { IAiDeps } from "../infras/deps";
import {
  ExtractTasksRequest,
  ExtractTasksResponse,
  ExtractedTask,
  ReminderSuggestion,
} from "../model/dto";

const SYSTEM_INSTRUCTION =
  "Ban la tro ly giup trich xuat cac cong viec tu cuoc tro chuyen chat. " +
  "Hãy phan tich tin nhan va trich xuat cac cong viec (task) co the nhan dien duoc: " +
  "nguoi phu_trach, noi_dung cong viec, va thoi_han (neu co). " +
  "Neu co deadline, hay de xuat tao nhac nho.";

const MAX_MESSAGES = 100;

export class TaskExtractionUseCase {
  constructor(
    private aiProvider: IAiProvider,
    private deps: IAiDeps
  ) {}

  async execute(request: ExtractTasksRequest): Promise<ExtractTasksResponse> {
    const { conversationId, maxMessages = MAX_MESSAGES } = request;

    const messages = await this.deps.messageRepo.listWithCursor(
      conversationId,
      undefined,
      maxMessages
    );

    if (!messages || messages.length === 0) {
      return {
        tasks: [],
        reminderSuggestions: [],
        originalCount: 0,
        conversationId,
      };
    }

    const conversationText = messages
      .slice()
      .reverse()
      .map((msg) => `User ${msg.senderId.slice(0, 8)}: ${msg.text || "[media]"}`)
      .join("\n");

    const prompt = `Hãy phan tich cuoc tro chuyen sau va trich xuat cac cong viec duoi dang JSON:
{
  "tasks": [
    {
      "description": "Mo ta cong viec",
      "assignee": "Ten nguoi phu_trach (neu co)",
      "deadline": "Thoi han (neu co, dinh dang ISO)",
      "status": "pending"
    }
  ],
  "reminderSuggestions": [
    {
      "title": "Ten cong viec",
      "remindAt": "Thoi gian nhac (ISO string)",
      "assignee": "Nguoi phu_trach",
      "sourceMessageId": "ID tin nhan nguon (neu gap)"
    }
  ]
}

Chi tra ve JSON hop le, khong giai thich them.\n\nCuoc tro chuyen:\n${conversationText}`;

    const raw = await this.aiProvider.generateContent(prompt, SYSTEM_INSTRUCTION);

    let parsed: { tasks: ExtractedTask[]; reminderSuggestions: ReminderSuggestion[] };
    try {
      const cleaned = this.extractJsonFromResponse(raw);
      const json = JSON.parse(cleaned);
      parsed = {
        tasks: Array.isArray(json.tasks) ? json.tasks : [],
        reminderSuggestions: Array.isArray(json.reminderSuggestions) ? json.reminderSuggestions : [],
      };
    } catch {
      parsed = { tasks: [], reminderSuggestions: [] };
    }

    return {
      tasks: parsed.tasks,
      reminderSuggestions: parsed.reminderSuggestions,
      originalCount: messages.length,
      conversationId,
    };
  }

  private extractJsonFromResponse(text: string): string {
    const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
    return match ? (match[1] || match[0]) : text;
  }
}
