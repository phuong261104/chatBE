import { z } from "zod";

export enum CloudItemType {
  FILE = "file",
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
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CloudItem = z.infer<typeof CloudItemSchema>;
