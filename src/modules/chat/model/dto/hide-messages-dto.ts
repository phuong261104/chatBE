import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";

export const HideUserMessagesDTOSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  userId: uuidV7("Invalid user ID"),
  hiddenUserId: uuidV7("Invalid hidden user ID"),
});

export type HideUserMessagesDTO = z.infer<typeof HideUserMessagesDTOSchema>;

export const UnhideUserMessagesDTOSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  userId: uuidV7("Invalid user ID"),
  hiddenUserId: uuidV7("Invalid hidden user ID"),
});

export type UnhideUserMessagesDTO = z.infer<typeof UnhideUserMessagesDTOSchema>;

export const GetHiddenUsersDTOSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  userId: uuidV7("Invalid user ID"),
});

export type GetHiddenUsersDTO = z.infer<typeof GetHiddenUsersDTOSchema>;