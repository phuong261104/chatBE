import { z } from "zod";
import { CloudItemType } from "./model";

export const createCloudItemDTOSchema = z
  .object({
    type: z.nativeEnum(CloudItemType),
    title: z.string().min(1, "Title is required").max(200, "Title is too long"),
    content: z.string().max(10000).optional(),
    fileUrl: z.string().optional(),
    fileName: z.string().optional(),
    fileSize: z.number().positive().optional(),
    mimetype: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === CloudItemType.FILE) return !!data.fileUrl;
      return true;
    },
    { message: "fileUrl is required for file type" },
  );

export type CreateCloudItemDTO = z.infer<typeof createCloudItemDTOSchema>;

export const CloudItemCondDTOSchema = z.object({
  userId: z.string().optional(),
  type: z.nativeEnum(CloudItemType).optional(),
});

export type CloudItemCondDTO = z.infer<typeof CloudItemCondDTOSchema>;

export const CloudItemUpdateDTOSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(10000).optional(),
});

export type CloudItemUpdateDTO = z.infer<typeof CloudItemUpdateDTOSchema>;
