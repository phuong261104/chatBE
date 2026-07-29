import { config } from "@share/component/config";
import { getGeminiProvider } from "@modules/ai/infras/provider/gemini-provider";
import { GroupReminderRepeatRule } from "../model/model";

export interface ParsedReminderRequest {
  shouldCreate: boolean;
  title?: string;
  description?: string;
  remindAt?: string;
  repeatRule?: GroupReminderRepeatRule;
  notifyBeforeMinutes?: number;
  reason?: string;
}

const BOT_MENTION_PATTERN = /(^|\s)@bot\b/i;
const REMINDER_INTENT_PATTERN =
  /(nhac\s*hen|nhac\s*ho|nhac\s*toi|nhac\s*minh|reminder|remind|hen|lich|deadline|todo)/i;

const REPEAT_RULES: Array<[RegExp, GroupReminderRepeatRule]> = [
  [/(hang\s*ngay|moi\s*ngay|daily|lap\s*lai\s*ngay)/i, GroupReminderRepeatRule.DAILY],
  [/(hang\s*tuan|moi\s*tuan|weekly|lap\s*lai\s*tuan)/i, GroupReminderRepeatRule.WEEKLY],
  [/(hang\s*thang|moi\s*thang|monthly|lap\s*lai\s*thang)/i, GroupReminderRepeatRule.MONTHLY],
];

function stripVietnameseMarks(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function isBotReminderRequest(text?: string): boolean {
  if (!text) return false;
  const normalized = stripVietnameseMarks(text);
  return BOT_MENTION_PATTERN.test(normalized) && REMINDER_INTENT_PATTERN.test(normalized);
}

export function removeBotMention(text: string): string {
  return text.replace(/(^|\s)@bot\b/gi, " ").replace(/\s+/g, " ").trim();
}

function getDatePart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function parseTime(text: string): { hour: number; minute: number } | null {
  const match =
    text.match(/\b(\d{1,2})\s*(?::|h|gio)\s*(\d{1,2})?\b/i) ||
    text.match(/\bluc\s+(\d{1,2})\b/i);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function parseExplicitDate(text: string, now: Date): Date | null {
  const match = text.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = match[3] ? Number(match[3]) : now.getFullYear();
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function parseRelativeDate(text: string, now: Date): Date | null {
  const normalized = stripVietnameseMarks(text).toLowerCase();
  const date = getDatePart(now);

  if (/\b(hom\s*nay|today)\b/.test(normalized)) return date;
  if (/\b(ngay\s*mai|mai|tomorrow)\b/.test(normalized)) {
    date.setDate(date.getDate() + 1);
    return date;
  }
  if (/\b(ngay\s*kia|kia)\b/.test(normalized)) {
    date.setDate(date.getDate() + 2);
    return date;
  }

  const inDays = normalized.match(/\b(?:sau|in)\s+(\d{1,3})\s*(?:ngay|day|days)\b/);
  if (inDays) {
    date.setDate(date.getDate() + Number(inDays[1]));
    return date;
  }

  return null;
}

function parseRepeatRule(text: string): GroupReminderRepeatRule {
  const normalized = stripVietnameseMarks(text);
  for (const [pattern, rule] of REPEAT_RULES) {
    if (pattern.test(normalized)) return rule;
  }
  return GroupReminderRepeatRule.NONE;
}

function cleanTitle(text: string): string {
  let title = removeBotMention(text);
  title = title
    .replace(/^(toi|tôi)?\s*(can|cần)?\s*(tao|tạo)?\s*(nhac\s*hen|nhắc\s*hẹn|nhac\s*ho|nhắc\s*hở|nhắc\s*nhở|reminder|remind)\s*/i, "")
    .replace(/\b(luc|lúc|vao|vào|ngay|ngày|hom nay|hôm nay|ngay mai|ngày mai|mai|lap lai|lặp lại|co lap lai|có lặp lại|hang ngay|hằng ngày|hàng ngày|hang tuan|hàng tuần|hang thang|hàng tháng|daily|weekly|monthly)\b.*$/i, "")
    .replace(/[,.]+$/g, "")
    .trim();

  return title || "Reminder";
}

function fallbackParse(text: string, now = new Date()): ParsedReminderRequest {
  if (!isBotReminderRequest(text)) {
    return { shouldCreate: false, reason: "No @bot reminder intent found" };
  }

  const cleanText = removeBotMention(text);
  const time = parseTime(cleanText);
  const date = parseExplicitDate(cleanText, now) || parseRelativeDate(cleanText, now);
  if (!time || !date) {
    return {
      shouldCreate: false,
      title: cleanTitle(cleanText),
      reason: "Missing reminder date or time",
    };
  }

  date.setHours(time.hour, time.minute, 0, 0);
  if (date <= now) {
    date.setDate(date.getDate() + 1);
  }

  return {
    shouldCreate: true,
    title: cleanTitle(cleanText),
    remindAt: date.toISOString(),
    repeatRule: parseRepeatRule(cleanText),
    notifyBeforeMinutes: 0,
  };
}

function normalizeParsed(value: ParsedReminderRequest, fallbackText: string): ParsedReminderRequest {
  if (!value?.shouldCreate) {
    return {
      shouldCreate: false,
      reason: value?.reason || "AI did not find enough reminder details",
    };
  }

  const remindAt = value.remindAt ? new Date(value.remindAt) : null;
  if (!remindAt || Number.isNaN(remindAt.getTime())) {
    return {
      shouldCreate: false,
      title: value.title || cleanTitle(fallbackText),
      reason: "Invalid reminder time",
    };
  }

  const repeatRule = Object.values(GroupReminderRepeatRule).includes(value.repeatRule as GroupReminderRepeatRule)
    ? value.repeatRule
    : GroupReminderRepeatRule.NONE;

  return {
    shouldCreate: true,
    title: (value.title || cleanTitle(fallbackText)).slice(0, 200),
    description: value.description?.slice(0, 1000),
    remindAt: remindAt.toISOString(),
    repeatRule,
    notifyBeforeMinutes: Math.max(0, Math.min(525600, Number(value.notifyBeforeMinutes || 0))),
  };
}

export async function parseReminderAgentRequest(text: string, now = new Date()): Promise<ParsedReminderRequest> {
  const fallback = fallbackParse(text, now);
  if (!isBotReminderRequest(text)) return fallback;

  if (!config.gemini.apiKey) return fallback;

  try {
    const provider = getGeminiProvider();
    const timezone = process.env.TZ || "Asia/Ho_Chi_Minh";
    const prompt = [
      "Parse this chat message into a group reminder creation request.",
      "Return only JSON with this shape:",
      '{"shouldCreate":boolean,"title":string,"description":string|null,"remindAt":string|null,"repeatRule":"none|daily|weekly|monthly","notifyBeforeMinutes":number,"reason":string|null}',
      `Current time ISO: ${now.toISOString()}`,
      `User timezone: ${timezone}`,
      "Rules:",
      "- Only create if the user explicitly asks @bot to create a reminder or reminder-like appointment.",
      "- remindAt must be an ISO datetime.",
      "- Infer Vietnamese relative dates such as hom nay, ngay mai, mai, ngay kia.",
      "- If date or time is missing, set shouldCreate false and explain reason.",
      "- repeatRule is none unless the user says it repeats.",
      `Message: ${text}`,
    ].join("\n");

    const parsed = await provider.generateStructuredContent<ParsedReminderRequest>(prompt);
    return normalizeParsed(parsed, text);
  } catch (error) {
    console.warn("Reminder agent AI parse failed, using fallback:", (error as Error).message);
    return fallback;
  }
}
