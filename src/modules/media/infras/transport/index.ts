import {
  DeleteMediaCommand,
  UploadMediaCommand,
  UploadMultipleMediaCommand,
} from "@modules/media/interface";
import { ICommandHandler } from "@share/interface";
import {
  MediaUploadMultipleResponseDTO,
  MediaUploadResponseDTO,
  RequestPresignedUrlCommand,
  ConfirmUploadCommand,
  RequestPresignedUrlDTO,
  ConfirmUploadDTO,
  RequestPresignedUrlResponseDTO,
  ConfirmUploadResponseDTO,
  MediaFileType,
} from "@modules/media/model/dto";
import { Request, Response } from "express";

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
    private readonly requestPresignedUrlHandler?: ICommandHandler<
      RequestPresignedUrlCommand,
      RequestPresignedUrlResponseDTO
    >,
    private readonly confirmUploadHandler?: ICommandHandler<
      ConfirmUploadCommand,
      ConfirmUploadResponseDTO
    >,
  ) {}

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

  async requestPresignedUrlAPI(req: Request, res: Response) {
    try {
      if (!this.requestPresignedUrlHandler) {
        throw new Error("Request presigned URL handler not configured");
      }

      const requester = res.locals["requester"] as any;
      const userId = requester?.sub || requester?.id || requester?.userId;

      if (!userId) {
        res.status(401).json({
          error: "UNAUTHORIZED",
          message: "User authentication required",
        });
        return;
      }

      const data: RequestPresignedUrlDTO = req.body;
      const cmd: RequestPresignedUrlCommand = { userId, data };
      const result = await this.requestPresignedUrlHandler.execute(cmd);

      res.status(200).json({
        data: result,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        error: error.code || "PRESIGNED_URL_ERROR",
        message: error.message || "Failed to generate presigned URL",
      });
    }
  }

  async confirmUploadAPI(req: Request, res: Response) {
    try {
      if (!this.confirmUploadHandler) {
        throw new Error("Confirm upload handler not configured");
      }

      const requester = res.locals["requester"] as any;
      const userId = requester?.sub || requester?.id || requester?.userId;

      if (!userId) {
        res.status(401).json({
          error: "UNAUTHORIZED",
          message: "User authentication required",
        });
        return;
      }

      const data: ConfirmUploadDTO = req.body;
      const cmd: ConfirmUploadCommand = { userId, data };
      const result = await this.confirmUploadHandler.execute(cmd);

      res.status(200).json({
        data: result,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        error: error.code || "CONFIRM_UPLOAD_ERROR",
        message: error.message || "Failed to confirm upload",
      });
    }
  }

  async getUploadMethodsAPI(req: Request, res: Response) {
    const fileTypeConfigs = {
      IMAGE: {
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        maxSizeBytes: 100 * 1024 * 1024,
        description: "Hình ảnh (jpg, png, gif, webp)",
      },
      VIDEO: {
        allowedMimeTypes: ["video/mp4", "video/mpeg", "video/quicktime", "video/webm"],
        maxSizeBytes: 1024 * 1024 * 1024,
        description: "Video (mp4, mpeg, mov, webm)",
      },
      AUDIO: {
        allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"],
        maxSizeBytes: 100 * 1024 * 1024,
        description: "Âm thanh (mp3, wav, ogg)",
      },
      DOCUMENT: {
        allowedMimeTypes: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        maxSizeBytes: 50 * 1024 * 1024,
        description: "Tài liệu (pdf, doc, docx)",
      },
    };

    const data = {
      recommendedMethod: "PRESIGNED_URL",
      fileTypes: fileTypeConfigs,
      presignedUrlConfig: {
        defaultExpirySeconds: 300,
        maxExpirySeconds: 3600,
        chunkedUploadThreshold: 100 * 1024 * 1024,
        chunkSize: 5 * 1024 * 1024,
      },
      compression: {
        image: {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.8,
        },
        video: {
          codec: "H.264",
          format: "MP4",
          maxBitrate: "5Mbps",
        },
      },
    };

    res.status(200).json({ data });
  }
}
