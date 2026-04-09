import { z } from "zod";
import { MessageReaction } from "../model";

export const addReactionDTOSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
  userId: z.string().uuid("Invalid user ID"),
  emoji: z.string().min(1, "Emoji is required").max(10, "Emoji is too long"),
});

export type AddReactionDTO = z.infer<typeof addReactionDTOSchema>;

export const removeReactionDTOSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
  userId: z.string().uuid("Invalid user ID"),
});

export type RemoveReactionDTO = z.infer<typeof removeReactionDTOSchema>;

export const removeAllReactionsDTOSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
  userId: z.string().uuid("Invalid user ID"),
});

export type RemoveAllReactionsDTO = z.infer<typeof removeAllReactionsDTOSchema>;

export const getReactionsDTOSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
});

export type GetReactionsDTO = z.infer<typeof getReactionsDTOSchema>;

export interface AddReactionCommand {
  messageId: string;
  userId: string;
  emoji: string;
}

export interface RemoveReactionCommand {
  messageId: string;
  userId: string;
}

export interface GetReactionsQuery {
  messageId: string;
}

export interface ReactionResult {
  reactions: MessageReaction[];
  grouped: Record<string, number>;
}
