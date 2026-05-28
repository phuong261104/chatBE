export interface SummarizeRequest {
  conversationId: string;
  maxMessages?: number;
}

export interface SummarizeResponse {
  summary: string[];
  originalCount: number;
  conversationId: string;
}

export interface SmartReplyRequest {
  conversationId: string;
  userId?: string;
}

export interface SmartReplyResponse {
  replies: string[];
  lastMessage: string;
  lastSenderName?: string;
}

export type ToneType = "formal" | "casual" | "funny" | "professional";

export interface ToneAdjustRequest {
  message: string;
  tone: ToneType;
}

export interface ToneAdjustResponse {
  original: string;
  adjusted: string;
  tone: ToneType;
}

export interface TranslateRequest {
  text: string;
  targetLang: string;
  sourceLang?: string;
}

export interface TranslateResponse {
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
}

export interface DetectLanguageRequest {
  text: string;
}

export interface DetectLanguageResponse {
  language: string;
}

// --- Smart Search ---
export interface SmartSearchRequest {
  query: string;
  conversationId?: string;
}

export interface SmartSearchReference {
  messageId: string;
  conversationId: string;
  text: string;
  senderId: string;
  createdAt: string;
}

export interface SmartSearchResponse {
  answer: string;
  references: SmartSearchReference[];
}

// --- Task Extraction ---
export interface ExtractedTask {
  description: string;
  assignee?: string;
  deadline?: string;
  status: "pending" | "in_progress" | "done";
}

export interface ReminderSuggestion {
  title: string;
  remindAt: string;
  assignee?: string;
  sourceMessageId?: string;
}

export interface ExtractTasksRequest {
  conversationId: string;
  maxMessages?: number;
}

export interface ExtractTasksResponse {
  tasks: ExtractedTask[];
  reminderSuggestions: ReminderSuggestion[];
  originalCount: number;
  conversationId: string;
}

// --- Content Moderation ---
export type ModerationCategory =
  | "toxicity"
  | "hate_speech"
  | "harassment"
  | "violence"
  | "sexual_content"
  | "self_harm"
  | "spam"
  | "misinformation";

export interface ModerationResult {
  category: ModerationCategory;
  isViolated: boolean;
  confidence: number;
}

export interface ModerateContentRequest {
  text: string;
  conversationId?: string;
}

export interface ModerateContentResponse {
  isSafe: boolean;
  categories: ModerationResult[];
  confidence: number;
  warningMessage?: string;
}
