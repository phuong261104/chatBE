import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";

export const copyConversationSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  requesterId: uuidV7("Invalid requester ID"),
  targetUserId: uuidV7("Invalid target user ID").optional(),
  memberIds: z.array(uuidV7("Invalid member ID")).optional(),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
}).refine(
  (data) => data.targetUserId !== undefined || (data.memberIds !== undefined && data.memberIds.length > 0),
  { message: "Either targetUserId or memberIds must be provided" }
);

export type CopyConversationDTO = z.infer<typeof copyConversationSchema>;
