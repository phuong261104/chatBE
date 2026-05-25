import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";
import { MessageMedia, MessageMediaSchema } from "../model";

export const getDraftsSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  userId: uuidV7("Invalid user ID"),
});

export type GetDraftsDTO = z.infer<typeof getDraftsSchema>;

export interface Draft {
  id: string;
  conversationId: string;
  userId: string;
  text: string;
  media: MessageMedia[];
  createdAt: Date;
  updatedAt: Date;
}

export const DraftSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  userId: z.string(),
  text: z.string(),
  media: z.array(MessageMediaSchema).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DraftType = z.infer<typeof DraftSchema>;
