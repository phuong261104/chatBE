import multer from "multer";
import { IStorageStrategy, IUploadConfig } from "./storage-interface";

export class CloudStorage implements IStorageStrategy {
  private config: IUploadConfig;
  private bucketName: string;
  private region: string;

  constructor(config: IUploadConfig, bucketName: string, region: string) {
    this.config = config;
    this.bucketName = bucketName;
    this.region = region;
  }

  getStorage(): multer.StorageEngine {
    throw new Error(
      "Cloud storage not implemented yet. Please implement this method.",
    );
  }

  getBaseUrl(): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;
  }

  async deleteFile(filePath: string): Promise<void> {
    throw new Error(
      "Cloud storage not implemented yet. Please implement this method.",
    );
  }

  getFileUrl(filename: string): string {
    return `${this.getBaseUrl()}/${filename}`;
  }
}
