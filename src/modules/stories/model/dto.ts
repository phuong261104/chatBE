import { z } from "zod";
import { StoryType } from "./model";

export const createStoryDTOSchema = z
  .object({
    type: z.nativeEnum(StoryType),
    content: z.string().max(500).optional(),
    mediaUrl: z.string().optional(),
    backgroundColor: z.string().optional(),
    textStyle: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === StoryType.TEXT) return !!data.content;
      return !!data.mediaUrl;
    },
    { message: "Text story requires content, image/video story requires mediaUrl" },
  );

export type CreateStoryDTO = z.infer<typeof createStoryDTOSchema>;

export const replyStoryDTOSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type ReplyStoryDTO = z.infer<typeof replyStoryDTOSchema>;

export const storyCondDTOSchema = z.object({
  authorId: z.string().optional(),
});

export type StoryCondDTO = z.infer<typeof storyCondDTOSchema>;

export const storyUpdateDTOSchema = z.object({
  viewersCount: z.number().optional(),
});

export type StoryUpdateDTO = z.infer<typeof storyUpdateDTOSchema>;
