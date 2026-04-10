import { FriendRequest } from "@modules/friend-requests/model/model";
import { FriendRequestCondDTO, FriendRequestUpdateDTO } from "@modules/friend-requests/model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
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

  private async queryBySenderId(
    senderId: string,
    status?: string,
    limit?: number,
  ): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const values: Record<string, any> = { ":senderId": senderId };
    const filterParts: string[] = [];

    if (status) {
      filterParts.push("#status = :status");
      values[":status"] = status;
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: this.getTableName(),
        IndexName: "senderId-index",
        KeyConditionExpression: "#senderId = :senderId",
        ExpressionAttributeNames: { "#senderId": "senderId", ...(status ? { "#status": "status" } : {}) },
        FilterExpression: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
        ExpressionAttributeValues: values,
        Limit: limit,
      }),
    ) as any;
    return (result.Items || []).map((item: any) => this.toEntity(item));
  }

  private async queryByReceiverId(
    receiverId: string,
    status?: string,
    limit?: number,
  ): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const values: Record<string, any> = { ":receiverId": receiverId };
    const filterParts: string[] = [];

    if (status) {
      filterParts.push("#status = :status");
      values[":status"] = status;
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: this.getTableName(),
        IndexName: "receiverId-index",
        KeyConditionExpression: "#receiverId = :receiverId",
        ExpressionAttributeNames: { "#receiverId": "receiverId", ...(status ? { "#status": "status" } : {}) },
        FilterExpression: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
        ExpressionAttributeValues: values,
        Limit: limit,
      }),
    ) as any;
    return (result.Items || []).map((item: any) => this.toEntity(item));
  }

  async list(cond: FriendRequestCondDTO, paging: PagingDTO): Promise<FriendRequest[]> {
    const { $or, ...restCond } = cond as any;
    const limit = paging.limit || 50;

    if ($or && Array.isArray($or) && $or.length > 0) {
      const orResults = await Promise.all(
        $or.map((orCond: any) =>
          this.list({ ...orCond, ...restCond } as FriendRequestCondDTO, { ...paging, limit: 1000 }),
        ),
      );
      const merged = orResults.flat();
      const seen = new Set<string>();
      const unique: FriendRequest[] = [];
      for (const item of merged) {
        const id = (item as any).id;
        if (!seen.has(id)) {
          seen.add(id);
          unique.push(item);
        }
      }
      return unique.slice(0, limit);
    }

    if (restCond.fromUserId && !restCond.toUserId) {
      return this.queryBySenderId(restCond.fromUserId, restCond.status, limit);
    }

    if (restCond.toUserId && !restCond.fromUserId) {
      return this.queryByReceiverId(restCond.toUserId, restCond.status, limit);
    }

    const docClient = getDocClient();
    const conditions: string[] = [];
    const values: Record<string, any> = {};
    const names: Record<string, string> = {};

    if (restCond.fromUserId) {
      conditions.push("fromUserId = :fromUserId");
      values[":fromUserId"] = restCond.fromUserId;
    }
    if (restCond.toUserId) {
      conditions.push("toUserId = :toUserId");
      values[":toUserId"] = restCond.toUserId;
    }
    if (restCond.status) {
      conditions.push("#st = :status");
      names["#st"] = "status";
      values[":status"] = restCond.status;
    }

    const filterExpr = conditions.length > 0 ? conditions.join(" AND ") : undefined;

    const result = await docClient.send(
      new ScanCommand({
        TableName: this.getTableName(),
        FilterExpression: filterExpr,
        ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
        ExpressionAttributeValues: Object.keys(values).length > 0 ? values : undefined,
        Limit: limit,
      }),
    ) as any;
    return (result.Items || []).map((item: any) => this.toEntity(item));
  }

  async findByCond(cond: FriendRequestCondDTO): Promise<FriendRequest | null> {
    const items = await this.list(cond, { page: 1, limit: 1 });
    return items.length > 0 ? items[0] : null;
  }

  async findPendingRequestsForUser(userId: string): Promise<FriendRequest[]> {
    return this.queryByReceiverId(userId, "pending");
  }

  async listBySenderId(senderId: string): Promise<FriendRequest[]> {
    return this.queryBySenderId(senderId);
  }

  async listByReceiverId(receiverId: string): Promise<FriendRequest[]> {
    return this.queryByReceiverId(receiverId);
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
