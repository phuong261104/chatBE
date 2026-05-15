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

class ConfirmUploadCmdHandler implements ICommandHandler<
  ConfirmUploadCommand,
  ConfirmUploadResponseDTO
> {
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

    uploadRegistry.markConfirmed(validatedInput.fileId);

    return {
      fileId: upload.fileId,
      url: validatedInput.uploadedUrl || upload.url,
      filename: upload.filename,
      mimetype: upload.mimeType,
      size: upload.fileSize,
      originalName: upload.originalName,
    };
  }
}

export { ConfirmUploadCmdHandler };
