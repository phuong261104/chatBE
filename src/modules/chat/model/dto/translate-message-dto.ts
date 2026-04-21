import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";

export const translateMessageSchema = z.object({
  messageId: uuidV7("Invalid message ID"),
  userId: uuidV7("Invalid user ID"),
  targetLanguage: z.string().min(2).max(10).default("en"),
});

export type TranslateMessageDTO = z.infer<typeof translateMessageSchema>;

export interface TranslateMessageResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  targetLanguage: string;
}
