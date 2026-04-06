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
import { PagingDTO } from "@share/model/paging";

class DynamoFriendRequestQueryRepository extends BaseQueryRepositoryDynamoDB<
  FriendRequest,
  FriendRequestCondDTO,
  typeof TABLE_NAMES.FRIEND_REQUESTS
> {
  constructor() {
    super(TABLE_NAMES.FRIEND_REQUESTS, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): FriendRequest {
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    return {
      ...rest,
      fromUserId: rest.fromUserId || rest.senderId,
      toUserId: rest.toUserId || rest.receiverId,
    } as FriendRequest;
  }

  async list(cond: FriendRequestCondDTO, paging: PagingDTO): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const conditions: string[] = [];
    const values: Record<string, any> = {};
    const names: Record<string, string> = {};

    if (cond.fromUserId) {
      conditions.push("fromUserId = :fromUserId");
      values[":fromUserId"] = cond.fromUserId;
    }
    if (cond.toUserId) {
      conditions.push("toUserId = :toUserId");
      values[":toUserId"] = cond.toUserId;
    }
    if (cond.status) {
      conditions.push("#st = :status");
      names["#st"] = "status";
      values[":status"] = cond.status;
    }

    const filterExpr = conditions.length > 0 ? conditions.join(" AND ") : undefined;

    const result = await docClient.send(
      new ScanCommand({
        TableName: this.getTableName(),
        FilterExpression: filterExpr,
        ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
        ExpressionAttributeValues: Object.keys(values).length > 0 ? values : undefined,
        Limit: paging.limit || 50,
      }),
    ) as any;
    return (result.Items || []).map((item: any) => this.toEntity(item));
  }

  async findByCond(cond: FriendRequestCondDTO): Promise<FriendRequest | null> {
    const items = await this.list(cond, { page: 1, limit: 1 });
    return items.length > 0 ? items[0] : null;
  }

  async findPendingRequestsForUser(userId: string): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new ScanCommand({
        TableName: getTableName(TABLE_NAMES.FRIEND_REQUESTS),
        FilterExpression: "toUserId = :userId AND #st = :status",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":userId": userId,
          ":status": "pending",
        },
      }),
    ) as any;
    return (result.Items || []).map((item: any) => this.toEntity(item));
  }

  async listBySenderId(senderId: string): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new ScanCommand({
        TableName: getTableName(TABLE_NAMES.FRIEND_REQUESTS),
        FilterExpression: "fromUserId = :fromUserId",
        ExpressionAttributeValues: { ":fromUserId": senderId },
      }),
    ) as any;
    return (result.Items || []).map((item: any) => this.toEntity(item));
  }

  async listByReceiverId(receiverId: string): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new ScanCommand({
        TableName: getTableName(TABLE_NAMES.FRIEND_REQUESTS),
        FilterExpression: "toUserId = :receiverId",
        ExpressionAttributeValues: { ":receiverId": receiverId },
      }),
    ) as any;
    return (result.Items || []).map((item: any) => this.toEntity(item));
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

  async list(cond: FriendRequestCondDTO, paging: PagingDTO): Promise<FriendRequest[]> {
    return (this.queryRepo as DynamoFriendRequestQueryRepository).list(cond, paging);
  }
}
