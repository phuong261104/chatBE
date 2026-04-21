import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";

export const getConversationStatisticsSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  userId: uuidV7("Invalid user ID"),
});

export type GetConversationStatisticsDTO = z.infer<typeof getConversationStatisticsSchema>;

export interface ConversationStatistics {
  messageCount: number;
  memberCount: number;
  activeMemberCount: number;
  lastActivity: Date | null;
  createdAt: Date;
}
