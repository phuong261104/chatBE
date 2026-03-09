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
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: (file as any).url || "",
      path: file.path,
      uploadedAt: new Date(),
    };

    return response;
  }
}
