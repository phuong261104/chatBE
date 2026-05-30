import { Request, Response } from "express";
import { RedisClient } from "@share/component/redis-pubsub/redis";
import { getDynamoDBClient } from "@share/repository/dynamodb/client";
import { ListTablesCommand } from "@aws-sdk/client-dynamodb";

export async function healthCheck(req: Request, res: Response) {
  const checks: Record<string, string> = {
    status: "ok",
    redis: "unknown",
    dynamodb: "unknown",
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

  const httpStatus = checks.status === "ok" ? 200 : 503;
  res.status(httpStatus).json(checks);
}
