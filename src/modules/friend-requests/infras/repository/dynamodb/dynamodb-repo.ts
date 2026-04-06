import { FriendRequest } from "@modules/friend-requests/model/model";
import { FriendRequestCondDTO, FriendRequestUpdateDTO } from "@modules/friend-requests/model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { PutCommand, QueryCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
class DynamoFriendRequestQueryRepository extends BaseQueryRepositoryDynamoDB<
  FriendRequest,
  FriendRequestCondDTO,
  typeof TABLE_NAMES.FRIEND_REQUESTS
> {
  constructor() {
    super(TABLE_NAMES.FRIEND_REQUESTS, { createdAt: -1 }, "senderId-index");
  }

  protected toEntity(doc: Record<string, any>): FriendRequest {
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    return { ...rest } as FriendRequest;
  }

  protected buildFilterExpression(cond: FriendRequestCondDTO): string {
    const conditions: string[] = [];
    if (cond.fromUserId) conditions.push("fromUserId = :fromUserId");
    if (cond.toUserId) conditions.push("toUserId = :toUserId");
    if (cond.status) conditions.push("#st = :status");
    return conditions.join(" AND ");
  }

  protected buildAttributeNames(cond: FriendRequestCondDTO): Record<string, string> {
    const names: Record<string, string> = {};
    if (cond.status) names["#st"] = "status";
    return names;
  }

  protected buildAttributeValues(cond: FriendRequestCondDTO): Record<string, any> {
    const values: Record<string, any> = {};
    if (cond.fromUserId) values[":fromUserId"] = cond.fromUserId;
    if (cond.toUserId) values[":toUserId"] = cond.toUserId;
    if (cond.status) values[":status"] = cond.status;
    return values;
  }

  protected buildKeyCondition(_cond: FriendRequestCondDTO): string | undefined {
    if (this.gsi && _cond.fromUserId) {
      return "fromUserId = :fromUserId";
    }
    if (this.gsi && _cond.toUserId) {
      return "toUserId = :toUserId";
    }
    return undefined;
  }

  async findByCond(cond: FriendRequestCondDTO): Promise<FriendRequest | null> {
    const docClient = getDocClient();
    let result;
    if (cond.fromUserId && this.gsi) {
      result = await docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.FRIEND_REQUESTS),
          IndexName: this.gsi,
          KeyConditionExpression: "fromUserId = :fromUserId",
          FilterExpression: cond.status ? "#st = :status" : undefined,
          ExpressionAttributeNames: cond.status ? { "#st": "status" } : undefined,
          ExpressionAttributeValues: {
            ":fromUserId": cond.fromUserId,
            ...(cond.status ? { ":status": cond.status } : {}),
          },
          Limit: 1,
        }),
      );
    } else if (cond.toUserId) {
      result = await docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.FRIEND_REQUESTS),
          IndexName: "receiverId-index",
          KeyConditionExpression: "receiverId = :receiverId",
          FilterExpression: cond.status ? "#st = :status" : undefined,
          ExpressionAttributeNames: cond.status ? { "#st": "status" } : undefined,
          ExpressionAttributeValues: {
            ":receiverId": cond.toUserId,
            ...(cond.status ? { ":status": cond.status } : {}),
          },
          Limit: 1,
        }),
      );
    } else {
      result = await docClient.send(
        new ScanCommand({
          TableName: getTableName(TABLE_NAMES.FRIEND_REQUESTS),
          FilterExpression: this.buildFilterExpression(cond),
          ExpressionAttributeNames: this.buildAttributeNames(cond),
          ExpressionAttributeValues: this.buildAttributeValues(cond),
          Limit: 1,
        }),
      );
    }
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async findPendingRequestsForUser(userId: string): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.FRIEND_REQUESTS),
        IndexName: "receiverId-index",
        KeyConditionExpression: "receiverId = :receiverId",
        FilterExpression: "#st = :pending",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":receiverId": userId,
          ":pending": "pending",
        },
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async listBySenderId(senderId: string): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.FRIEND_REQUESTS),
        IndexName: "senderId-index",
        KeyConditionExpression: "senderId = :senderId",
        ExpressionAttributeValues: { ":senderId": senderId },
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async listByReceiverId(receiverId: string): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.FRIEND_REQUESTS),
        IndexName: "receiverId-index",
        KeyConditionExpression: "receiverId = :receiverId",
        ExpressionAttributeValues: { ":receiverId": receiverId },
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }
}

class DynamoFriendRequestCommandRepository extends BaseCommandRepositoryDynamoDB<
  FriendRequest,
  FriendRequestUpdateDTO,
  typeof TABLE_NAMES.FRIEND_REQUESTS
> {
  constructor() {
    super(TABLE_NAMES.FRIEND_REQUESTS, true);
  }

  protected beforeInsert(data: FriendRequest): Record<string, any> {
    const d = data as any;
    const now = d.createdAt ? d.createdAt.toISOString() : new Date().toISOString();
    return {
      id: d.id,
      senderId: d.fromUserId || d.senderId,
      receiverId: d.toUserId || d.receiverId,
      fromUserId: d.fromUserId || d.senderId,
      toUserId: d.toUserId || d.receiverId,
      status: d.status,
      createdAt: now,
      respondedAt: d.respondedAt ? d.respondedAt.toISOString() : null,
    };
  }

  protected beforeUpdate(id: string, data: FriendRequestUpdateDTO): Record<string, any> {
    const d = data as any;
    const updateData: Record<string, any> = {};
    if (d.status !== undefined) updateData.status = d.status;
    if (d.respondedAt !== undefined) updateData.respondedAt = d.respondedAt.toISOString();
    return updateData;
  }
}

export class DynamoFriendRequestRepository extends BaseRepositoryDynamoDB<
  FriendRequest,
  FriendRequestCondDTO,
  FriendRequestUpdateDTO,
  typeof TABLE_NAMES.FRIEND_REQUESTS
> {
  constructor() {
    super(new DynamoFriendRequestQueryRepository(), new DynamoFriendRequestCommandRepository());
  }

  async listBySenderId(senderId: string): Promise<FriendRequest[]> {
    return (this.queryRepo as DynamoFriendRequestQueryRepository).listBySenderId(senderId);
  }

  async listByReceiverId(receiverId: string): Promise<FriendRequest[]> {
    return (this.queryRepo as DynamoFriendRequestQueryRepository).listByReceiverId(receiverId);
  }

  async findPendingRequestsForUser(userId: string): Promise<FriendRequest[]> {
    return (this.queryRepo as DynamoFriendRequestQueryRepository).findPendingRequestsForUser(userId);
  }
}
