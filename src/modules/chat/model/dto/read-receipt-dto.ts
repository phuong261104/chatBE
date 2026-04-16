import { z } from "zod";

export const MessageReadReceiptSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  userId: z.string(),
  readAt: z.date(),
});

export type MessageReadReceipt = z.infer<typeof MessageReadReceiptSchema>;

export const GetReadReceiptsDTOSchema = z.object({
  messageId: z.string(),
});

export type GetReadReceiptsDTO = z.infer<typeof GetReadReceiptsDTOSchema>;

export const MarkMultipleAsReadDTOSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  messageIds: z.array(z.string()).min(1).max(100),
});

export type MarkMultipleAsReadDTO = z.infer<typeof MarkMultipleAsReadDTOSchema>;