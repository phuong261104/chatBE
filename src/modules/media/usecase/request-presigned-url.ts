import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  RequestPresignedUrlDTO,
  RequestPresignedUrlResponseDTO,
  RequestPresignedUrlCommand,
  RequestPresignedUrlDTOSchema,
  MediaFileType,
  UploadMethod,
  UploadStatus,
  uploadRegistry,
} from "../model/dto";
import { CloudStorage } from "@share/middleware/upload/cloud-storage";
import { IStorageStrategy } from "@share/middleware/upload/storage-interface";

const MAX_FILE_SIZES: Record<MediaFileType, number> = {
  [MediaFileType.IMAGE]: 100 * 1024 * 1024,
  [MediaFileType.AUDIO]: 100 * 1024 * 1024,
  [MediaFileType.VIDEO]: 1024 * 1024 * 1024,
  [MediaFileType.DOCUMENT]: 50 * 1024 * 1024,
};

const MIME_TYPE_MAP: Record<MediaFileType, string[]> = {
  [MediaFileType.IMAGE]: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  [MediaFileType.VIDEO]: ["video/mp4", "video/mpeg", "video/quicktime", "video/webm"],
  [MediaFileType.AUDIO]: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3", "audio/mp4", "audio/x-m4a"],

  [MediaFileType.DOCUMENT]: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

class RequestPresignedUrlCmdHandler implements ICommandHandler<
  RequestPresignedUrlCommand,
  RequestPresignedUrlResponseDTO
> {
  constructor(private readonly storage: IStorageStrategy) { }

  async execute(command: RequestPresignedUrlCommand): Promise<RequestPresignedUrlResponseDTO> {
    const { userId, data } = command;

    const { success, data: validatedInput, error } = RequestPresignedUrlDTOSchema.safeParse(data);

    if (!success) {
      throw AppError.from(new Error(`Invalid request: ${error.message}`), 400);
    }

    const maxSize = MAX_FILE_SIZES[validatedInput.fileType];
    if (validatedInput.fileSize > maxSize) {
      throw AppError.from(
        new Error(`File size exceeds maximum allowed for ${validatedInput.fileType}: ${maxSize} bytes`),
        400,
      );
    }

    const allowedMimeTypes = MIME_TYPE_MAP[validatedInput.fileType];
    if (!allowedMimeTypes.includes(validatedInput.mimeType)) {
      throw AppError.from(
        new Error(`MIME type ${validatedInput.mimeType} is not allowed for ${validatedInput.fileType}`),
        400,
      );
    }

    const cloudStorage = this.storage as CloudStorage;
    if (cloudStorage && !cloudStorage.isMimeTypeAllowed(validatedInput.mimeType)) {
      throw AppError.from(new Error(`MIME type not allowed by server configuration`), 400);
    }

    const fileId = v7();
    const originalName = validatedInput.originalName || `file-${fileId}`;
    const ext = this.getExtension(validatedInput.mimeType);
    const filename = `${validatedInput.fileType.toLowerCase()}/${userId}/${fileId}${ext}`;

    const expiresIn = validatedInput.expiresIn || 300;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const presignedUrl = await cloudStorage.getPresignedUploadUrl(filename, validatedInput.mimeType, expiresIn);

    uploadRegistry.set(fileId, {
      fileId,
      filename,
      mimeType: validatedInput.mimeType,
      fileSize: validatedInput.fileSize,
      fileType: validatedInput.fileType,
      originalName: validatedInput.originalName,
      expiresAt,
      status: UploadStatus.PENDING,
      userId,
      conversationId: validatedInput.conversationId,
    });

    const headers: Record<string, string> = {
      "Content-Type": validatedInput.mimeType,
    };

    return {
      fileId,
      filename,
      presignedUrl,
      uploadMethod: UploadMethod.PUT,
      expiresAt,
      headers,
    };
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/mpeg": ".mpeg",
      "video/quicktime": ".mov",
      "video/webm": ".webm",
      "audio/mpeg": ".mp3",
      "audio/wav": ".wav",
      "audio/ogg": ".ogg",
      "application/pdf": ".pdf",
    };
    return map[mimeType] || "";
  }
}

export { RequestPresignedUrlCmdHandler };
