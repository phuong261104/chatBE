import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";

export enum MediaFileType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  AUDIO = "AUDIO",
  DOCUMENT = "DOCUMENT",
}

export enum UploadMethod {
  PUT = "PUT",
  POST = "POST",
}

export enum UploadStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  EXPIRED = "EXPIRED",
}

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

export const RequestPresignedUrlDTOSchema = z.object({
  fileType: z.nativeEnum(MediaFileType),
  mimeType: z.string().min(1, "MIME type is required"),
  fileSize: z.number().positive("File size must be positive"),
  originalName: z.string().optional(),
  expiresIn: z.number().int().min(60).max(3600).optional().default(300),
  conversationId: uuidV7("Invalid conversation ID").optional(),
});

export type RequestPresignedUrlDTO = z.infer<typeof RequestPresignedUrlDTOSchema>;

export interface RequestPresignedUrlResponseDTO {
  fileId: string;
  filename: string;
  presignedUrl: string;
  uploadMethod: UploadMethod;
  expiresAt: Date;
  headers: Record<string, string>;
}

export const ConfirmUploadDTOSchema = z.object({
  fileId: uuidV7("Invalid file ID"),
  uploadedUrl: z.string().url("Invalid uploaded URL"),
});

export type ConfirmUploadDTO = z.infer<typeof ConfirmUploadDTOSchema>;

export interface ConfirmUploadResponseDTO {
  fileId: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  originalName?: string;
}

export interface RequestPresignedUrlCommand {
  userId: string;
  data: RequestPresignedUrlDTO;
}

export interface ConfirmUploadCommand {
  userId: string;
  data: ConfirmUploadDTO;
}

interface PendingUpload {
  fileId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  fileType: MediaFileType;
  originalName?: string;
  expiresAt: Date;
  status: UploadStatus;
  userId: string;
  conversationId?: string;
}

const pendingUploads = new Map<string, PendingUpload>();

export const uploadRegistry = {
  set(fileId: string, upload: PendingUpload): void {
    pendingUploads.set(fileId, upload);
  },
  get(fileId: string): PendingUpload | undefined {
    return pendingUploads.get(fileId);
  },
  has(fileId: string): boolean {
    return pendingUploads.has(fileId);
  },
  markConfirmed(fileId: string): void {
    const upload = pendingUploads.get(fileId);
    if (upload) {
      upload.status = UploadStatus.CONFIRMED;
    }
  },
  cleanup(): void {
    const now = Date.now();
    for (const [fileId, upload] of pendingUploads.entries()) {
      if (upload.expiresAt.getTime() < now && upload.status === UploadStatus.PENDING) {
        upload.status = UploadStatus.EXPIRED;
        pendingUploads.delete(fileId);
      }
    }
  },
};
