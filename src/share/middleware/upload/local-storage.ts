import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { IStorageStrategy, IUploadConfig } from "./storage-interface";

export class LocalStorage implements IStorageStrategy {
  private config: IUploadConfig;
  private baseUrl: string;

  constructor(config: IUploadConfig, baseUrl: string = "") {
    this.config = config;
    this.baseUrl = baseUrl;
    this.ensureDirectoryExists(config.destination);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  getStorage(): multer.StorageEngine {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        this.ensureDirectoryExists(this.config.destination);
        cb(null, this.config.destination);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = `${uuidv4()}-${Date.now()}`;
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        const filename = `${basename}-${uniqueSuffix}${ext}`;
        cb(null, filename);
      },
    });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async deleteFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.config.destination, filePath);

      fs.unlink(fullPath, (err) => {
        if (err) {
          if (err.code === "ENOENT") {
            resolve();
          } else {
            reject(err);
          }
        } else {
          resolve();
        }
      });
    });
  }

  getFileUrl(filename: string): string {
    return `${this.baseUrl}/${filename}`;
  }
}
