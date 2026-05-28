import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";
import { MediaType } from "../../model";

export const GetConversationMediaQuerySchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  userId: uuidV7("Invalid user ID"),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  type: z.enum(["all", "image", "file", "link", "video", "voice"]).default("all"),
  query: z.string().max(200).optional(),
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
