import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";

export const createPollDTOSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  question: z.string().min(1, "Question is required").max(500),
  options: z.array(z.string().min(1).max(200)).min(2, "At least 2 options required").max(10),
  isMultipleChoice: z.boolean().default(false),
  allowAddOption: z.boolean().default(false),
  showResultsBeforeClose: z.boolean().default(false),
  hideVoters: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export type CreatePollDTO = z.infer<typeof createPollDTOSchema>;

export const votePollDTOSchema = z.object({
  pollId: uuidV7("Invalid poll ID"),
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
  showResultsBeforeClose?: boolean;
  hideVoters?: boolean;
  expiresAt?: string;
}

export interface VotePollCommand {
  pollId: string;
  userId: string;
  optionIds: string[];
}

export const pollActionDTOSchema = z.object({
  pollId: uuidV7("Invalid poll ID"),
  userId: uuidV7("Invalid user ID"),
});

export type PollActionDTO = z.infer<typeof pollActionDTOSchema>;

export interface PollActionCommand {
  pollId: string;
  userId: string;
}

export const addPollOptionDTOSchema = z.object({
  pollId: uuidV7("Invalid poll ID"),
  userId: uuidV7("Invalid user ID"),
  text: z.string().min(1, "Option text is required").max(200),
});

export type AddPollOptionDTO = z.infer<typeof addPollOptionDTOSchema>;

export interface AddPollOptionCommand {
  pollId: string;
  userId: string;
  text: string;
}
