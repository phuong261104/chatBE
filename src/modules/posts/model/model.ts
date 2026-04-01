import { z } from "zod";

export enum PostPrivacy {
  PUBLIC = "public",
  FRIENDS = "friends",
  PRIVATE = "private",
}

export enum ReactionEmoji {
  LIKE = "like",
  LOVE = "love",
  HAHA = "haha",
  WOW = "wow",
  SAD = "sad",
  ANGRY = "angry",
}

export const PostMediaSchema = z.object({
  url: z.string(),
  type: z.enum(["image", "video"]),
  thumbnail: z.string().optional(),
});

export type PostMedia = z.infer<typeof PostMediaSchema>;

export const PostSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  content: z.string(),
  media: z.array(PostMediaSchema),
  privacy: z.nativeEnum(PostPrivacy),
  reactionsCount: z.number(),
  commentsCount: z.number(),
  sharesCount: z.number(),
  sharedPostId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Post = z.infer<typeof PostSchema>;

export const PostReactionSchema = z.object({
  id: z.string(),
  postId: z.string(),
  userId: z.string(),
  emoji: z.nativeEnum(ReactionEmoji),
  createdAt: z.date(),
});

export type PostReaction = z.infer<typeof PostReactionSchema>;

export const PostCommentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  userId: z.string(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PostComment = z.infer<typeof PostCommentSchema>;
