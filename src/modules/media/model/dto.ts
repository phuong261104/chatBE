import { z } from "zod";

export interface MediaUploadResponseDTO {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  path: string;
  uploadedAt: Date;
}

export interface MediaUploadMultipleResponseDTO {
  files: MediaUploadResponseDTO[];
  count: number;
}

export const DeleteMediaDTOSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
});

export type DeleteMediaDTO = z.infer<typeof DeleteMediaDTOSchema>;
