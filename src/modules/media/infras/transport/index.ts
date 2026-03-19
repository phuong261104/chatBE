import {
  DeleteMediaCommand,
  UploadMediaCommand,
  UploadMultipleMediaCommand,
} from "@modules/media/interface";
import { ICommandHandler } from "@share/interface";
import {
  MediaUploadMultipleResponseDTO,
  MediaUploadResponseDTO,
} from "@modules/media/model/dto";
import { Request, Response } from "express";

/**
 * HTTP service for handling media upload endpoints
 */
export class MediaHttpService {
  constructor(
    private readonly uploadMediaHandler: ICommandHandler<
      UploadMediaCommand,
      MediaUploadResponseDTO
    >,
    private readonly uploadMultipleMediaHandler: ICommandHandler<
      UploadMultipleMediaCommand,
      MediaUploadMultipleResponseDTO
    >,
    private readonly deleteMediaHandler: ICommandHandler<
      DeleteMediaCommand,
      void
    >,
  ) {}

  /**
   * API endpoint for uploading a single file
   * Expected multipart/form-data with field name "file"
   */
  async uploadSingleAPI(req: Request, res: Response) {
    try {
      const cmd: UploadMediaCommand = { file: req.file };
      const result = await this.uploadMediaHandler.execute(cmd);

      res.status(201).json({
        data: result,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.code || "UPLOAD_ERROR",
        message: error.message || "Failed to upload file",
      });
    }
  }

  /**
   * API endpoint for uploading multiple files
   * Expected multipart/form-data with field name "files"
   */
  async uploadMultipleAPI(req: Request, res: Response) {
    try {
      const cmd: UploadMultipleMediaCommand = {
        files: req.files as Express.Multer.File[],
      };
      const result = await this.uploadMultipleMediaHandler.execute(cmd);

      res.status(201).json({
        data: result,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.code || "UPLOAD_ERROR",
        message: error.message || "Failed to upload files",
      });
    }
  }

  /**
   * API endpoint for deleting a file
   */
  async deleteAPI(req: Request, res: Response) {
    try {
      const filename = req.params.filename as string;
      const cmd: DeleteMediaCommand = { filename };

      await this.deleteMediaHandler.execute(cmd);

      res.status(204).send();
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.code || "DELETE_ERROR",
        message: error.message || "Failed to delete file",
      });
    }
  }
}
