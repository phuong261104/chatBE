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
