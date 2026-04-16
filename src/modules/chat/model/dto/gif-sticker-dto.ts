import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";

export const StickerPackageDTOSchema = z.object({
  id: uuidV7("Invalid sticker package ID"),
  name: z.string().min(1).max(100),
  thumbnailUrl: z.string().optional(),
  stickers: z.array(z.object({
    id: uuidV7("Invalid sticker ID"),
    url: z.string(),
    thumbnailUrl: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })).min(1),
  createdAt: z.date().optional(),
});

export type StickerPackageDTO = z.infer<typeof StickerPackageDTOSchema>;

export const SendStickerDTOSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  senderId: uuidV7("Invalid sender ID"),
  stickerUrl: z.string().url("Invalid sticker URL"),
  stickerId: z.string().optional(),
  packageId: z.string().optional(),
});

export type SendStickerDTO = z.infer<typeof SendStickerDTOSchema>;

export const SendGifDTOSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  senderId: uuidV7("Invalid sender ID"),
  gifUrl: z.string().url("Invalid GIF URL"),
  provider: z.enum(["giphy", "tenor", "local"]).default("giphy"),
});

export type SendGifDTO = z.infer<typeof SendGifDTOSchema>;

export const GifSearchDTOSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
  provider: z.enum(["giphy", "tenor"]).default("giphy"),
});

export type GifSearchDTO = z.infer<typeof GifSearchDTOSchema>;

export interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  title: string;
  width: number;
  height: number;
  provider: string;
}

export const GifSearchResultSchema = z.object({
  gifs: z.array(z.object({
    id: z.string(),
    url: z.string(),
    previewUrl: z.string(),
    title: z.string(),
    width: z.number(),
    height: z.number(),
    provider: z.string(),
  })),
  nextOffset: z.number(),
  hasMore: z.boolean(),
});

export type GifSearchResult = z.infer<typeof GifSearchResultSchema>;