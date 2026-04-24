import { z } from "zod";

export enum CloudItemType {
  FILE = "file",
  IMAGE = "image",
  VIDEO = "video",
  VOICE = "voice",
  LINK = "link",
  NOTE = "note",
}

export const CloudItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  collectionId: z.string().optional(),
  type: z.nativeEnum(CloudItemType),
  title: z.string(),
  content: z.string().optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  mimetype: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  isPinned: z.boolean().default(false),
  isDeleted: z.boolean().default(false),
  deletedAt: z.date().optional(),
  shareToken: z.string().optional(),
  shareExpiresAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CloudItem = z.infer<typeof CloudItemSchema>;

export const CollectionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  coverImageUrl: z.string().optional(),
  parentId: z.string().optional(),
  isDefault: z.boolean().default(false),
  isDeleted: z.boolean().default(false),
  itemCount: z.number().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Collection = z.infer<typeof CollectionSchema>;

export const CollectionItemSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  itemId: z.string(),
  userId: z.string(),
  addedAt: z.date(),
});

export type CollectionItem = z.infer<typeof CollectionItemSchema>;
