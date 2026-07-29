import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  ConfirmUploadDTO,
  ConfirmUploadCommand,
  ConfirmUploadResponseDTO,
  ConfirmUploadDTOSchema,
  UploadStatus,
  uploadRegistry,
} from "../model/dto";
import {
  IPresignedStorageStrategy,
  IStorageStrategy,
} from "@share/middleware/upload/storage-interface";

class ConfirmUploadCmdHandler implements ICommandHandler<
  ConfirmUploadCommand,
  ConfirmUploadResponseDTO
> {
  constructor(private readonly storage: IStorageStrategy) {}

  async execute(command: ConfirmUploadCommand): Promise<ConfirmUploadResponseDTO> {
    const { userId, data } = command;

    const { success, data: validatedInput, error } =
      ConfirmUploadDTOSchema.safeParse(data);

    if (!success) {
      throw AppError.from(new Error(`Invalid request: ${error.message}`), 400);
    }

    const upload = uploadRegistry.get(validatedInput.fileId);

    if (!upload) {
      throw AppError.from(new Error("Upload file not found or expired"), 404);
    }

    if (upload.userId !== userId) {
      throw AppError.from(new Error("Unauthorized: You did not request this upload"), 403);
    }

    if (upload.expiresAt.getTime() < Date.now() && upload.status === UploadStatus.PENDING) {
      upload.status = UploadStatus.EXPIRED;
      uploadRegistry.get(validatedInput.fileId);
      throw AppError.from(new Error("Upload presigned URL has expired"), 410);
    }

    if (upload.status === UploadStatus.CONFIRMED) {
      throw AppError.from(new Error("Upload already confirmed"), 409);
    }

    if (!isPresignedStorage(this.storage)) {
      throw AppError.from(
        new Error("Presigned upload storage is not configured"),
        503,
      );
    }

    let metadata;
    try {
      metadata = await this.storage.getObjectMetadata(upload.filename);
    } catch (error: any) {
      const status = error?.$metadata?.httpStatusCode;
      if (
        status === 404 ||
        error?.name === "NotFound" ||
        error?.name === "NoSuchKey"
      ) {
        throw AppError.from(
          new Error("Upload has not completed in object storage"),
          409,
        );
      }
      throw AppError.from(new Error("Object storage is unavailable"), 503);
    }

    if (
      metadata.size !== upload.fileSize ||
      metadata.contentType !== upload.mimeType
    ) {
      try {
        await this.storage.deleteFile(upload.filename);
      } catch {
        // Preserve the validation error even if cleanup cannot complete.
      }
      throw AppError.from(
        new Error("Uploaded object metadata does not match the request"),
        409,
      );
    }

    uploadRegistry.markConfirmed(validatedInput.fileId);

    return {
      fileId: upload.fileId,
      url: upload.url,
      filename: upload.filename,
      mimetype: upload.mimeType,
      size: upload.fileSize,
      originalName: upload.originalName,
    };
  }
}

function isPresignedStorage(
  storage: IStorageStrategy,
): storage is IPresignedStorageStrategy {
  return (
    typeof (storage as IPresignedStorageStrategy).getObjectMetadata ===
    "function"
  );
}

export { ConfirmUploadCmdHandler };
