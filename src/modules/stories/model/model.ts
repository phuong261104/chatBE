import { z } from "zod";

export enum StoryType {
  IMAGE = "image",
  VIDEO = "video",
  TEXT = "text",
}

export const StorySchema = z.object({
  id: z.string(),
  authorId: z.string(),
  type: z.nativeEnum(StoryType),
  content: z.string().optional(),
  mediaUrl: z.string().optional(),
  backgroundColor: z.string().optional(),
  textStyle: z.string().optional(),
  viewersCount: z.number(),
  expiresAt: z.date(),
  createdAt: z.date(),
});

export type Story = z.infer<typeof StorySchema>;

export const StoryViewSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  userId: z.string(),
  viewedAt: z.date(),
});

export type StoryView = z.infer<typeof StoryViewSchema>;
