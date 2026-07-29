import multer from "multer";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  IPresignedStorageStrategy,
  IUploadConfig,
  StoredObjectMetadata,
} from "./storage-interface";
import { v4 as uuidv4 } from "uuid";
import path from "path";

export class CloudStorage implements IPresignedStorageStrategy {
  private config: IUploadConfig;
  private bucketName: string;
  private region: string;
  private s3Client: S3Client;
  private signingClient: S3Client;

  constructor(
    config: IUploadConfig,
    bucketName: string,
    region: string,
  ) {
    this.config = config;
    this.bucketName = bucketName;
    this.region = region;

    const accessKeyId =
      config.cloudAccessKeyId || process.env.CLOUD_ACCESS_KEY_ID || "";
    const secretAccessKey = config.cloudSecretAccessKey || process.env.CLOUD_SECRET_ACCESS_KEY || "";

    const credentials =
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined;
    const commonConfig = {
      region: this.region,
      forcePathStyle: config.cloudForcePathStyle,
      ...(credentials ? { credentials } : {}),
    };

    this.s3Client = new S3Client({
      ...commonConfig,
      ...(config.cloudEndpoint ? { endpoint: config.cloudEndpoint } : {}),
    });
    this.signingClient = new S3Client({
      ...commonConfig,
      ...(config.cloudPublicEndpoint || config.cloudEndpoint
        ? { endpoint: config.cloudPublicEndpoint || config.cloudEndpoint }
        : {}),
    });
  }

  getStorage(): multer.StorageEngine {
    return multer.memoryStorage();
  }

  getBaseUrl(): string {
    if (this.config.cloudPublicBaseUrl) {
      return this.config.cloudPublicBaseUrl.replace(/\/+$/, "");
    }

    if (this.config.cloudPublicEndpoint) {
      const endpoint = this.config.cloudPublicEndpoint.replace(/\/+$/, "");
      return this.config.cloudForcePathStyle
        ? `${endpoint}/${this.bucketName}`
        : endpoint;
    }

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

  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
    expiresIn: number = 300,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filename,
      ContentType: contentType,
    });

    return getSignedUrl(this.signingClient, command, { expiresIn });
  }

  generateFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const basename = path.basename(originalName, ext);
    return `${basename}-${uuidv4()}${ext}`;
  }

  getPresignedUrl(filename: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filename,
    });

    return getSignedUrl(this.signingClient, command, { expiresIn });
  }

  async getObjectMetadata(filename: string): Promise<StoredObjectMetadata> {
    const result = await this.s3Client.send(
      new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
      }),
    );

    return {
      size: result.ContentLength,
      contentType: result.ContentType,
    };
  }

  async checkHealth(): Promise<void> {
    await this.s3Client.send(
      new HeadBucketCommand({
        Bucket: this.bucketName,
      }),
    );
  }

  isMimeTypeAllowed(mimeType: string): boolean {
    return this.config.allowedMimeTypes.includes(mimeType);
  }

  getAllowedMimeTypes(): string[] {
    return this.config.allowedMimeTypes;
  }
}
