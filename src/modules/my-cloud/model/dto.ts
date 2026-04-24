import { z } from "zod";
import { CloudItemType } from "./model";

// --- Create DTO ---
export const CreateCloudItemDTOSchema = z.object({
  type: z.nativeEnum(CloudItemType),
  title: z.string().min(1).max(200),
  content: z.string().max(50000).optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.number().nonnegative().optional(),
  mimetype: z.string().optional(),
  thumbnailUrl: z.string().optional(),
}).refine(
  (data) => {
    if (
      [
        CloudItemType.FILE,
        CloudItemType.IMAGE,
        CloudItemType.VIDEO,
        CloudItemType.VOICE,
      ].includes(data.type)
    ) {
      return !!data.fileUrl;
    }
    return true;
  },
  { message: "fileUrl is required for file/image/video/voice types" }
);

export type CreateCloudItemDTO = z.infer<typeof CreateCloudItemDTOSchema>;

// --- Update DTO ---
export const UpdateCloudItemDTOSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
});

export type UpdateCloudItemDTO = z.infer<typeof UpdateCloudItemDTOSchema>;

// --- Query/Cond DTO ---
export const CloudItemCondDTOSchema = z.object({
  userId: z.string().optional(),
  type: z.nativeEnum(CloudItemType).optional(),
  isDeleted: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "fileSize", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CloudItemCondDTO = z.infer<typeof CloudItemCondDTOSchema>;

// --- Load Items DTO (cursor pagination) ---
export const LoadCloudItemsDTOSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["all", "image", "video", "voice", "file", "link", "note"]).default("all"),
  isPinned: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});

export type LoadCloudItemsDTO = z.infer<typeof LoadCloudItemsDTOSchema>;

// --- Stats ---
export interface CloudItemStats {
  totalItems: number;
  totalSize: number;
  pinnedCount: number;
  trashCount: number;
  byType: {
    image: { count: number; size: number };
    video: { count: number; size: number };
    voice: { count: number; size: number };
    file: { count: number; size: number };
    link: { count: number; size: number };
    note: { count: number; size: number };
  };
}

// --- Batch Delete ---
export const BatchDeleteCloudItemDTOSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(50),
});

export type BatchDeleteCloudItemDTO = z.infer<typeof BatchDeleteCloudItemDTOSchema>;

// --- Share ---
export const ShareCloudItemDTOSchema = z.object({
  itemId: z.string(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export type ShareCloudItemDTO = z.infer<typeof ShareCloudItemDTOSchema>;

export interface ShareResult {
  shareToken: string;
  shareUrl: string;
  expiresAt: Date;
}
