import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";

export const searchMessagesDTOSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  query: z.string().min(1, "Search query is required").max(200),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
});

export type SearchMessagesDTO = z.infer<typeof searchMessagesDTOSchema>;

export const SearchMessagesResultSchema = z.object({
  messages: z.array(z.any()),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
  total: z.number().default(0),
});

export type SearchMessagesResult = z.infer<typeof SearchMessagesResultSchema>;
