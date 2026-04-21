import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";

export const getSharedConversationsSchema = z.object({
  userId: uuidV7("Invalid user ID"),
  currentUserId: uuidV7("Invalid current user ID"),
});

export type GetSharedConversationsDTO = z.infer<typeof getSharedConversationsSchema>;
