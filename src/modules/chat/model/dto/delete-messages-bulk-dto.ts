import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";

export const deleteMessagesBulkSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  userId: uuidV7("Invalid user ID"),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
  messageIds: z.array(uuidV7("Invalid message ID")).optional(),
}).refine(
  (data) => data.before !== undefined || data.after !== undefined || (data.messageIds !== undefined && data.messageIds.length > 0),
  { message: "At least one of before, after, or messageIds must be provided" }
);

export type DeleteMessagesBulkDTO = z.infer<typeof deleteMessagesBulkSchema>;
