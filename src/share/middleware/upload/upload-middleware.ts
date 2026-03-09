import { Request, Response, NextFunction, Handler } from "express";
import multer from "multer";
import {
  IStorageStrategy,
  IUploadConfig,
  UploadedFile,
} from "./storage-interface";
import { LocalStorage } from "./local-storage";
import path from "path";

export class UploadMiddleware {
  private upload: multer.Multer;
  private storage: IStorageStrategy;
  private config: IUploadConfig;

  constructor(storage: IStorageStrategy, config: IUploadConfig) {
    this.storage = storage;
    this.config = config;

    this.upload = multer({
      storage: storage.getStorage(),
      limits: {
        fileSize: config.maxFileSize,
      },
      fileFilter: this.fileFilter.bind(this),
    });
  }

  private fileFilter(
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ): void {
    if (this.config.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Allowed types: ${this.config.allowedMimeTypes.join(", ")}`,
        ),
      );
    }
  }

  single(fieldName: string): Handler {
    return (req: Request, res: Response, next: NextFunction) => {
      const uploadHandler = this.upload.single(fieldName);

      uploadHandler(req, res, (err: any) => {
        if (err) {
          return this.handleError(err, res);
        }

        if (req.file) {
          const file = req.file as UploadedFile;
          file.url = this.storage.getFileUrl(file.filename);
        }

        next();
      });
    };
  }

  array(fieldName: string, maxCount: number = 10): Handler {
    return (req: Request, res: Response, next: NextFunction) => {
      const uploadHandler = this.upload.array(fieldName, maxCount);

      uploadHandler(req, res, (err: any) => {
        if (err) {
          return this.handleError(err, res);
        }

        if (req.files && Array.isArray(req.files)) {
          req.files.forEach((file: Express.Multer.File) => {
            (file as UploadedFile).url = this.storage.getFileUrl(file.filename);
          });
        }

        next();
      });
    };
  }

  fields(fields: { name: string; maxCount: number }[]): Handler {
    return (req: Request, res: Response, next: NextFunction) => {
      const uploadHandler = this.upload.fields(fields);

      uploadHandler(req, res, (err: any) => {
        if (err) {
          return this.handleError(err, res);
        }

        if (req.files && !Array.isArray(req.files)) {
          Object.keys(req.files).forEach((fieldName) => {
            const files = (
              req.files as { [fieldname: string]: Express.Multer.File[] }
            )[fieldName];
            files.forEach((file: Express.Multer.File) => {
              (file as UploadedFile).url = this.storage.getFileUrl(
                file.filename,
              );
            });
          });
        }

        next();
      });
    };
  }

  any(): Handler {
    return (req: Request, res: Response, next: NextFunction) => {
      const uploadHandler = this.upload.any();

      uploadHandler(req, res, (err: any) => {
        if (err) {
          return this.handleError(err, res);
        }

        if (req.files && Array.isArray(req.files)) {
          req.files.forEach((file: Express.Multer.File) => {
            (file as UploadedFile).url = this.storage.getFileUrl(file.filename);
          });
        }

        next();
      });
    };
  }

  private handleError(err: any, res: Response): void {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error: "File too large",
          message: `Maximum file size is ${this.config.maxFileSize / 1024 / 1024}MB`,
        });
      } else if (err.code === "LIMIT_FILE_COUNT") {
        res.status(400).json({
          error: "Too many files",
          message: err.message,
        });
      } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
        res.status(400).json({
          error: "Unexpected field",
          message: err.message,
        });
      } else {
        res.status(400).json({
          error: "Upload error",
          message: err.message,
        });
      }
    } else {
      res.status(400).json({
        error: "Upload error",
        message: err.message,
      });
    }
  }

  getStorage(): IStorageStrategy {
    return this.storage;
  }

  async deleteFile(filePath: string): Promise<void> {
    return this.storage.deleteFile(filePath);
  }
}

export function createUploadMiddleware(
  config?: Partial<IUploadConfig>,
  storage?: IStorageStrategy,
): UploadMiddleware {
  const defaultConfig: IUploadConfig = {
    maxFileSize: 10 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/mpeg",
      "video/quicktime",
      "audio/mpeg",
      "audio/wav",
      "application/pdf",
    ],
    destination: path.join(process.cwd(), "uploads"),
  };

  const finalConfig = { ...defaultConfig, ...config };

  const storageStrategy =
    storage ||
    new LocalStorage(
      finalConfig,
      process.env.UPLOAD_BASE_URL || "http://localhost:3000/uploads",
    );

  return new UploadMiddleware(storageStrategy, finalConfig);
}
