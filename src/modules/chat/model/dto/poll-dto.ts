import { z } from "zod";

export const createPollDTOSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  question: z.string().min(1, "Question is required").max(500),
  options: z.array(z.string().min(1).max(200)).min(2, "At least 2 options required").max(10),
  isMultipleChoice: z.boolean().default(false),
  allowAddOption: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export type CreatePollDTO = z.infer<typeof createPollDTOSchema>;

export const votePollDTOSchema = z.object({
  pollId: z.string().uuid("Invalid poll ID"),
  optionIds: z.array(z.string()).min(1, "Select at least one option"),
});

export type VotePollDTO = z.infer<typeof votePollDTOSchema>;

export interface CreatePollCommand {
  conversationId: string;
  creatorId: string;
  question: string;
  options: string[];
  isMultipleChoice?: boolean;
  allowAddOption?: boolean;
  expiresAt?: string;
}

export interface VotePollCommand {
  pollId: string;
  userId: string;
  optionIds: string[];
}
