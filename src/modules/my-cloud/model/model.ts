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
