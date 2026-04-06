import { ICommandHandler } from "@share/interface";
import { MediaUploadResponseDTO } from "../model/dto";
import { ErrNoFileUploaded } from "../model/errors";

export interface UploadMediaCommand {
  file?: Express.Multer.File;
}

export class UploadMediaCmdHandler implements ICommandHandler<
  UploadMediaCommand,
  MediaUploadResponseDTO
> {
  async execute(command: UploadMediaCommand): Promise<MediaUploadResponseDTO> {
    const { file } = command;

    if (!file) {
      throw ErrNoFileUploaded;
    }

    const response: MediaUploadResponseDTO = {
      filename: file.filename || file.originalname,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: (file as any).url || "",
      path: (file as any).url || "",
      uploadedAt: new Date(),
    };

    return response;
  }
}
