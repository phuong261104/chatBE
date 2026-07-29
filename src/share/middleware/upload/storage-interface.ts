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
  baseUrl?: string;
  cloudEnabled?: boolean;
  cloudProvider?: string;
  cloudBucket?: string;
  cloudRegion?: string;
  cloudEndpoint?: string;
  cloudPublicEndpoint?: string;
  cloudPublicBaseUrl?: string;
  cloudForcePathStyle?: boolean;
  cloudAccessKeyId?: string;
  cloudSecretAccessKey?: string;
}

export interface StoredObjectMetadata {
  size?: number;
  contentType?: string;
}

export interface IPresignedStorageStrategy extends IStorageStrategy {
  isMimeTypeAllowed(mimeType: string): boolean;
  getPresignedUploadUrl(
    filename: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<string>;
  getPresignedUrl(filename: string, expiresIn?: number): Promise<string>;
  getObjectMetadata(filename: string): Promise<StoredObjectMetadata>;
}

export interface UploadedFile extends Express.Multer.File {
  url?: string;
}
