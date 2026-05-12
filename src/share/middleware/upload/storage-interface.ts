import { Request } from "express";
import multer from "multer";

export interface IStorageStrategy {
  getStorage(): multer.StorageEngine;
  getBaseUrl(): string;
  deleteFile(filePath: string): Promise<void>;
  getFileUrl(filename: string): string;
}

export interface IUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  destination: string;
  cloudBucket?: string;
  cloudRegion?: string;
  cloudAccessKeyId?: string;
  cloudSecretAccessKey?: string;
}

export interface UploadedFile extends Express.Multer.File {
  url?: string;
}
