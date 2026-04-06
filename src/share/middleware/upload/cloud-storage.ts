import multer from "multer";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IStorageStrategy, IUploadConfig } from "./storage-interface";

export class CloudStorage implements IStorageStrategy {
  private config: IUploadConfig;
  private bucketName: string;
  private region: string;
  private s3Client: S3Client;

  constructor(
    config: IUploadConfig,
    bucketName: string,
    region: string,
  ) {
    this.config = config;
    this.bucketName = bucketName;
    this.region = region;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  getStorage(): multer.StorageEngine {
    return multer.memoryStorage();
  }

  getBaseUrl(): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;
  }

  async uploadToS3(
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filename,
      Body: buffer,
      ContentType: mimetype,
    });

    await this.s3Client.send(command);
    return this.getFileUrl(filename);
  }

  async deleteFile(filePath: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });

    await this.s3Client.send(command);
  }

  getFileUrl(filename: string): string {
    return `${this.getBaseUrl()}/${filename}`;
  }

  getPresignedUrl(filename: string, expiresIn: number = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filename,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
