import { z } from "zod";
import { MediaType } from "../../model";

export const GetConversationMediaQuerySchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  userId: z.string().uuid("Invalid user ID"),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  type: z.enum(["all", "image", "file", "link"]).default("all"),
});

export type GetConversationMediaQuery = z.infer<typeof GetConversationMediaQuerySchema>;

export interface MediaItem {
  messageId: string;
  url: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
  mediaType: MediaType;
  senderId: string;
  createdAt: Date;
}

export interface FileItem {
  messageId: string;
  url: string;
  name?: string;
  size?: number;
  mediaType: MediaType;
  senderId: string;
  createdAt: Date;
}

export interface LinkItem {
  messageId: string;
  url: string;
  senderId: string;
  createdAt: Date;
}

export interface GetConversationMediaResult {
  images: MediaItem[];
  files: FileItem[];
  links: LinkItem[];
  nextCursor: string;
  hasMore: boolean;
}
