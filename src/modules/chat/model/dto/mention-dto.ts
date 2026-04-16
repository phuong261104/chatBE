import { z } from "zod";

export const MentionSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string().optional(),
  startIndex: z.number(),
  endIndex: z.number(),
});

export type Mention = z.infer<typeof MentionSchema>;

export const MentionEventSchema = z.object({
  conversationId: z.string(),
  messageId: z.string(),
  senderId: z.string(),
  mentionedUserIds: z.array(z.string()),
  createdAt: z.date(),
});

export type MentionEvent = z.infer<typeof MentionEventSchema>;

export const GetMentionedMessagesDTOSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
});

export type GetMentionedMessagesDTO = z.infer<typeof GetMentionedMessagesDTOSchema>;