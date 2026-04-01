import { z } from "zod";
import { PostPrivacy, ReactionEmoji, PostMediaSchema } from "./model";

export const createPostDTOSchema = z
  .object({
    content: z.string().max(5000).default(""),
    media: z.array(PostMediaSchema).max(10).default([]),
    privacy: z.nativeEnum(PostPrivacy).default(PostPrivacy.FRIENDS),
  })
  .refine((data) => data.content.length > 0 || data.media.length > 0, {
    message: "Post must have content or media",
  });

export type CreatePostDTO = z.infer<typeof createPostDTOSchema>;

export const reactPostDTOSchema = z.object({
  emoji: z.nativeEnum(ReactionEmoji),
});

export type ReactPostDTO = z.infer<typeof reactPostDTOSchema>;

export const createCommentDTOSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000),
});

export type CreateCommentDTO = z.infer<typeof createCommentDTOSchema>;

export const sharePostDTOSchema = z.object({
  content: z.string().max(5000).default(""),
  privacy: z.nativeEnum(PostPrivacy).default(PostPrivacy.FRIENDS),
});

export type SharePostDTO = z.infer<typeof sharePostDTOSchema>;

export const postCondDTOSchema = z.object({
  authorId: z.string().optional(),
});

export type PostCondDTO = z.infer<typeof postCondDTOSchema>;

export const postUpdateDTOSchema = z.object({
  content: z.string().max(5000).optional(),
  privacy: z.nativeEnum(PostPrivacy).optional(),
  reactionsCount: z.number().optional(),
  commentsCount: z.number().optional(),
  sharesCount: z.number().optional(),
});

export type PostUpdateDTO = z.infer<typeof postUpdateDTOSchema>;
