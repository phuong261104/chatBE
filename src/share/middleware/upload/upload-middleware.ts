import { Request, Response, NextFunction, Handler } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { IStorageStrategy, IUploadConfig, UploadedFile } from "./storage-interface";
import { LocalStorage } from "./local-storage";
import { CloudStorage } from "./cloud-storage";

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

  private fileFilter(req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
    if (this.config.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${this.config.allowedMimeTypes.join(", ")}`));
    }
  }

  private generateFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const basename = path.basename(originalName, ext);
    return `${basename}-${uuidv4()}-${Date.now()}${ext}`;
  }

  private async processFile(file: Express.Multer.File): Promise<string> {
    const cloudStorage = this.storage as CloudStorage;
    if (cloudStorage && typeof cloudStorage.uploadToS3 === "function") {
      const filename = this.generateFilename(file.originalname);
      return cloudStorage.uploadToS3(file.buffer, filename, file.mimetype);
    }
    return this.storage.getFileUrl(file.filename);
  }

  single(fieldName: string): Handler {
    return (req: Request, res: Response, next: NextFunction) => {
      const uploadHandler = this.upload.single(fieldName);

      uploadHandler(req, res, async (err: any) => {
        if (err) {
          return this.handleError(err, res);
        }

        if (req.file) {
          const file = req.file as UploadedFile;
          file.url = await this.processFile(file);
        }

        next();
      });
    };
  }

  array(fieldName: string, maxCount: number = 10): Handler {
    return (req: Request, res: Response, next: NextFunction) => {
      const uploadHandler = this.upload.array(fieldName, maxCount);

      uploadHandler(req, res, async (err: any) => {
        if (err) {
          return this.handleError(err, res);
        }

        if (req.files && Array.isArray(req.files)) {
          for (const file of req.files) {
            const uf = file as UploadedFile;
            uf.url = await this.processFile(file);
          }
        }

        next();
      });
    };
  }

  fields(fields: { name: string; maxCount: number }[]): Handler {
    return (req: Request, res: Response, next: NextFunction) => {
      const uploadHandler = this.upload.fields(fields);

      uploadHandler(req, res, async (err: any) => {
        if (err) {
          return this.handleError(err, res);
        }

        if (req.files && !Array.isArray(req.files)) {
          const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
          for (const fieldName of Object.keys(filesMap)) {
            for (const file of filesMap[fieldName]) {
              const uf = file as UploadedFile;
              uf.url = await this.processFile(file);
            }
          }
        }

        next();
      });
    };
  }

  any(): Handler {
    return (req: Request, res: Response, next: NextFunction) => {
      const uploadHandler = this.upload.any();

      uploadHandler(req, res, async (err: any) => {
        if (err) {
          return this.handleError(err, res);
        }

        if (req.files && Array.isArray(req.files)) {
          for (const file of req.files) {
            const uf = file as UploadedFile;
            uf.url = await this.processFile(file);
          }
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

export function createUploadMiddleware(config?: Partial<IUploadConfig>, storage?: IStorageStrategy): UploadMiddleware {
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
      "audio/mp4",
      "audio/x-m4a",
      "application/pdf",
    ],
    destination: path.join(process.cwd(), "uploads"),
  };

  const finalConfig = { ...defaultConfig, ...config };

  const storageStrategy =
    storage ||
    new CloudStorage(
      finalConfig,
      process.env.AWS_S3_BUCKET || "your-bucket-name",
      process.env.AWS_REGION || "us-east-1",
    );

  return new UploadMiddleware(storageStrategy, finalConfig);
}
