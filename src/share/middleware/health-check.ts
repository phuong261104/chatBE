import { Request, Response } from "express";
import { RedisClient } from "@share/component/redis-pubsub/redis";
import { getDynamoDBClient } from "@share/repository/dynamodb/client";
import { ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { config } from "@share/component/config";
import { CloudStorage } from "@share/middleware/upload/cloud-storage";

export async function healthCheck(req: Request, res: Response) {
  const checks: Record<string, string> = {
    status: "ok",
    redis: "unknown",
    dynamodb: "unknown",
    storage: config.upload.cloud.enabled ? "unknown" : "disabled",
    timestamp: new Date().toISOString(),
  };

  try {
    const redis = RedisClient.getClient();
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
    checks.status = "degraded";
  }

  try {
    const client = getDynamoDBClient();
    await client.send(new ListTablesCommand({ Limit: 1 }));
    checks.dynamodb = "ok";
  } catch {
    checks.dynamodb = "error";
    checks.status = "degraded";
  }

  if (config.upload.cloud.enabled) {
    try {
      const storage = new CloudStorage(
        {
          maxFileSize: config.upload.maxFileSize,
          allowedMimeTypes: config.upload.allowedMimeTypes,
          destination: config.upload.destination,
          cloudEnabled: true,
          cloudProvider: config.upload.cloud.provider,
          cloudBucket: config.upload.cloud.bucketName,
          cloudRegion: config.upload.cloud.region,
          cloudEndpoint: config.upload.cloud.endpoint,
          cloudPublicEndpoint: config.upload.cloud.publicEndpoint,
          cloudPublicBaseUrl: config.upload.cloud.publicBaseUrl,
          cloudForcePathStyle: config.upload.cloud.forcePathStyle,
          cloudAccessKeyId: config.upload.cloud.accessKeyId,
          cloudSecretAccessKey: config.upload.cloud.secretAccessKey,
        },
        config.upload.cloud.bucketName,
        config.upload.cloud.region,
      );
      await storage.checkHealth();
      checks.storage = "ok";
    } catch {
      checks.storage = "error";
      checks.status = "degraded";
    }
  }

  const httpStatus = checks.status === "ok" ? 200 : 503;
  res.status(httpStatus).json(checks);
}
