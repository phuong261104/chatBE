import { z } from "zod";

export const globalSearchDTOSchema = z.object({
  q: z.string().min(1, "Search query is required").max(200),
  limit: z.number().min(1).max(50).default(10),
});

export type GlobalSearchDTO = z.infer<typeof globalSearchDTOSchema>;

export interface SearchResult {
  users: Array<{
    id: string;
    displayName?: string;
    avatarUrl?: string;
    username?: string;
  }>;
  conversations: Array<{
    id: string;
    type: string;
    name?: string;
    avatarUrl?: string;
    membersCount: number;
  }>;
  messages: Array<{
    id: string;
    conversationId: string;
    senderId: string;
    text?: string;
    createdAt: Date;
  }>;
}
