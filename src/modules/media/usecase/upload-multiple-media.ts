import { ICommandHandler } from "@share/interface";
import {
  MediaUploadMultipleResponseDTO,
  MediaUploadResponseDTO,
} from "../model/dto";
import { ErrNoFileUploaded } from "../model/errors";

export interface UploadMultipleMediaCommand {
  files?: Express.Multer.File[];
}

export class UploadMultipleMediaCmdHandler implements ICommandHandler<
  UploadMultipleMediaCommand,
  MediaUploadMultipleResponseDTO
> {
  async execute(
    command: UploadMultipleMediaCommand,
  ): Promise<MediaUploadMultipleResponseDTO> {
    const { files } = command;

    if (!files || files.length === 0) {
      throw ErrNoFileUploaded;
    }

    const uploadedFiles: MediaUploadResponseDTO[] = files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: (file as any).url || "",
      path: file.path,
      uploadedAt: new Date(),
    }));

    return {
      files: uploadedFiles,
      count: uploadedFiles.length,
    };
  }
}
