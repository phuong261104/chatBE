import { FriendRequest } from "@modules/friend-requests/model/model";
import { FriendRequestCondDTO, FriendRequestUpdateDTO } from "@modules/friend-requests/model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
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

  async queryBySenderId(
    senderId: string,
    receiverId?: string,
    status?: string,
    limit?: number,
  ): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const values: Record<string, any> = { ":senderId": senderId };
    const names: Record<string, string> = { "#senderId": "senderId" };
    const filterParts: string[] = [];

    if (receiverId) {
      filterParts.push("#receiverId = :receiverId");
      values[":receiverId"] = receiverId;
      names["#receiverId"] = "receiverId";
    }

    if (status) {
      filterParts.push("#status = :status");
      values[":status"] = status;
      names["#status"] = "status";
    }

    const result = (await docClient.send(
      new QueryCommand({
        TableName: this.getTableName(),
        IndexName: "senderId-index",
        KeyConditionExpression: "#senderId = :senderId",
        FilterExpression: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        Limit: limit,
      }),
    )) as any;
    return (result.Items || []).map((item: any) => this.toEntity(item));
  }

  async queryByReceiverId(
    receiverId: string,
    status?: string,
    limit?: number,
  ): Promise<FriendRequest[]> {
    const docClient = getDocClient();
    const values: Record<string, any> = { ":receiverId": receiverId };
    const names: Record<string, string> = { "#receiverId": "receiverId" };
    const filterParts: string[] = [];

    if (status) {
      filterParts.push("#status = :status");
      values[":status"] = status;
      names["#status"] = "status";
    }

    const result = (await docClient.send(
      new QueryCommand({
        TableName: this.getTableName(),
        IndexName: "receiverId-index",
        KeyConditionExpression: "#receiverId = :receiverId",
        FilterExpression: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        Limit: limit,
      }),
    )) as any;
    return (result.Items || []).map((item: any) => this.toEntity(item));
  }

  async list(cond: FriendRequestCondDTO, paging: PagingDTO): Promise<FriendRequest[]> {
    const { $or, ...restCond } = cond as any;
    const limit = paging.limit || 50;

    if ($or && Array.isArray($or) && $or.length > 0) {
      const orResults = await Promise.all(
        $or.map((orCond: any) =>
          this.list({ ...orCond, ...restCond } as FriendRequestCondDTO, {
            ...paging,
            limit: 1000,
          }),
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

    if (restCond.fromUserId) {
      return this.queryBySenderId(restCond.fromUserId, restCond.toUserId, restCond.status, limit);
    }

    if (restCond.toUserId && !restCond.fromUserId) {
      return this.queryByReceiverId(restCond.toUserId, restCond.status, limit);
    }

    return [];
  }

  async findByCond(cond: FriendRequestCondDTO): Promise<FriendRequest | null> {
    if (cond.fromUserId && cond.toUserId) {
      const items = await this.queryBySenderId(cond.fromUserId, cond.toUserId, cond.status, 2);
      return items.length > 0 ? items[0] : null;
    }
    if (cond.fromUserId) {
      return (await this.queryBySenderId(cond.fromUserId, undefined, cond.status, 2))[0] || null;
    }
    if (cond.toUserId) {
      return (await this.queryByReceiverId(cond.toUserId, cond.status, 2))[0] || null;
    }
    return null;
  }

  async listBySenderIdWithCursor(
    senderId: string,
    status: string | undefined,
    cursor: string | undefined,
    limit: number,
  ): Promise<{ items: FriendRequest[]; nextCursor: string; hasMore: boolean }> {
    const docClient = getDocClient();
    let exclusiveStartKey: Record<string, any> | undefined;
    if (cursor) {
      exclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    }

    const values: Record<string, any> = { ":senderId": senderId };
    const names: Record<string, string> = {};

    let filterExpr: string | undefined;
    if (status) {
      values[":status"] = status;
      names["#status"] = "status";
      filterExpr = "#status = :status";
    }

    const result = (await docClient.send(
      new QueryCommand({
        TableName: this.getTableName(),
        IndexName: "senderId-createdAt-index",
        KeyConditionExpression: "senderId = :senderId",
        FilterExpression: filterExpr,
        ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
        ExpressionAttributeValues: values,
        Limit: limit + 1,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: false,
      }),
    )) as any;

    const items = (result.Items || []).map((item: any) => this.toEntity(item));
    const hasMore = items.length > limit;
    const returnItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
      : "";
    return { items: returnItems, nextCursor, hasMore };
  }

  async listByReceiverIdWithCursor(
    receiverId: string,
    status: string | undefined,
    cursor: string | undefined,
    limit: number,
  ): Promise<{ items: FriendRequest[]; nextCursor: string; hasMore: boolean }> {
    const docClient = getDocClient();
    let exclusiveStartKey: Record<string, any> | undefined;
    if (cursor) {
      exclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    }

    const values: Record<string, any> = { ":receiverId": receiverId };
    const names: Record<string, string> = {};

    let filterExpr: string | undefined;
    if (status) {
      values[":status"] = status;
      names["#status"] = "status";
      filterExpr = "#status = :status";
    }

    const result = (await docClient.send(
      new QueryCommand({
        TableName: this.getTableName(),
        IndexName: "receiverId-createdAt-index",
        KeyConditionExpression: "receiverId = :receiverId",
        FilterExpression: filterExpr,
        ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
        ExpressionAttributeValues: values,
        Limit: limit + 1,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: false,
      }),
    )) as any;

    const items = (result.Items || []).map((item: any) => this.toEntity(item));
    const hasMore = items.length > limit;
    const returnItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
      : "";
    return { items: returnItems, nextCursor, hasMore };
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
    const now = d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString();
    return {
      id: d.id,
      senderId: d.fromUserId || d.senderId,
      receiverId: d.toUserId || d.receiverId,
      fromUserId: d.fromUserId || d.senderId,
      toUserId: d.toUserId || d.receiverId,
      status: d.status,
      createdAt: now,
      respondedAt: d.respondedAt ? new Date(d.respondedAt).toISOString() : null,
    };
  }

  protected beforeUpdate(id: string, data: FriendRequestUpdateDTO): Record<string, any> {
    const d = data as any;
    const updateData: Record<string, any> = {};
    if (d.status !== undefined) updateData.status = d.status;
    if (d.respondedAt !== undefined) {
      updateData.respondedAt = d.respondedAt instanceof Date
        ? d.respondedAt.toISOString()
        : d.respondedAt;
    }
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
    super(
      new DynamoFriendRequestQueryRepository(),
      new DynamoFriendRequestCommandRepository(),
    );
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

  async listBySenderIdWithCursor(
    senderId: string,
    status: string | undefined,
    cursor: string | undefined,
    limit: number,
  ) {
    return (this.queryRepo as DynamoFriendRequestQueryRepository).listBySenderIdWithCursor(
      senderId,
      status,
      cursor,
      limit,
    );
  }

  async listByReceiverIdWithCursor(
    receiverId: string,
    status: string | undefined,
    cursor: string | undefined,
    limit: number,
  ) {
    return (this.queryRepo as DynamoFriendRequestQueryRepository).listByReceiverIdWithCursor(
      receiverId,
      status,
      cursor,
      limit,
    );
  }
}
