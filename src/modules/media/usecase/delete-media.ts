import { ICommandHandler } from "@share/interface";
import { UploadMiddleware } from "@share/middleware/upload/upload-middleware";
import { ErrFileDeleteFailed } from "../model/errors";

export interface DeleteMediaCommand {
  filename: string;
}

export class DeleteMediaCmdHandler implements ICommandHandler<
  DeleteMediaCommand,
  void
> {
  constructor(private readonly uploadMiddleware: UploadMiddleware) {}

  async execute(command: DeleteMediaCommand): Promise<void> {
    const { filename } = command;

    try {
      await this.uploadMiddleware.deleteFile(filename);
    } catch (error: any) {
      throw ErrFileDeleteFailed;
    }
  }
}
