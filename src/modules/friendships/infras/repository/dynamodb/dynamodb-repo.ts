import { Friendship, FriendshipStatus } from "@modules/friendships/model/model";
import { FriendshipCondDTO, FriendshipUpdateDTO } from "@modules/friendships/model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import {
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

class DynamoFriendshipQueryRepository extends BaseQueryRepositoryDynamoDB<
  Friendship,
  FriendshipCondDTO,
  typeof TABLE_NAMES.FRIENDSHIPS
> {
  constructor() {
    super(TABLE_NAMES.FRIENDSHIPS, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): Friendship {
    const { pk, sk, updatedAt, ...rest } = doc;
    return { ...rest } as Friendship;
  }

  protected buildFilterExpression(cond: FriendshipCondDTO): string | undefined {
    const conditions: string[] = [];
    if (cond.userA) conditions.push("userA = :userA");
    if (cond.userB) conditions.push("userB = :userB");
    return conditions.length > 0 ? conditions.join(" AND ") : undefined;
  }

  protected buildAttributeValues(cond: FriendshipCondDTO): Record<string, any> {
    const values: Record<string, any> = {};
    if (cond.userA) values[":userA"] = cond.userA;
    if (cond.userB) values[":userB"] = cond.userB;
    return values;
  }

  protected buildKeyCondition(_cond: FriendshipCondDTO): string | undefined {
    if (_cond.userA) return "userA = :userA";
    if (_cond.userB) return "userB = :userB";
    return undefined;
  }

  async findByCond(cond: FriendshipCondDTO): Promise<Friendship | null> {
    if (cond.userA && cond.userB) {
      const docClient = getDocClient();
      const result = await docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.FRIENDSHIPS),
          KeyConditionExpression: "userA = :userA AND userB = :userB",
          ExpressionAttributeValues: {
            ":userA": cond.userA,
            ":userB": cond.userB,
          },
        }),
      );
      return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
    }
    return super.findByCond(cond);
  }

  async findFriendshipsForUser(userId: string): Promise<Friendship[]> {
    const docClient = getDocClient();
    const [result1, result2] = await Promise.all([
      docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.FRIENDSHIPS),
          KeyConditionExpression: "userA = :userId",
          FilterExpression: "#status = :active",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":userId": userId,
            ":active": FriendshipStatus.ACTIVE,
          },
        }),
      ),
      docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.FRIENDSHIPS),
          IndexName: "userB-index",
          KeyConditionExpression: "userB = :userId",
          FilterExpression: "#status = :active",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":userId": userId,
            ":active": FriendshipStatus.ACTIVE,
          },
        }),
      ),
    ]);

    const items = [...(result1.Items || []), ...(result2.Items || [])];
    const seen = new Set<string>();
    const unique: Friendship[] = [];
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(this.toEntity(item));
      }
    }
    return unique;
  }

  async findFriendshipsWithCursor(
    userId: string,
    cursor: string | undefined,
    limit: number,
    sortBy: "newest" | "oldest",
  ): Promise<{ friendships: Friendship[]; nextCursor: string; hasMore: boolean }> {
    const docClient = getDocClient();
    const tableName = getTableName(TABLE_NAMES.FRIENDSHIPS);
    const scanForward = sortBy !== "newest";
    const limitWithExtra = limit + 1;

    let exclusiveStartKey1: Record<string, any> | undefined;
    let exclusiveStartKey2: Record<string, any> | undefined;

    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
      exclusiveStartKey1 = decoded.key1;
      exclusiveStartKey2 = decoded.key2;
    }

    const [result1, result2] = await Promise.all([
      docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "userA-createdAt-index",
          KeyConditionExpression: "userA = :userId",
          FilterExpression: "#status = :active",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":userId": userId,
            ":active": FriendshipStatus.ACTIVE,
          },
          Limit: limitWithExtra,
          ExclusiveStartKey: exclusiveStartKey1,
          ScanIndexForward: scanForward,
        }),
      ),
      docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "userB-index",
          KeyConditionExpression: "userB = :userId",
          FilterExpression: "#status = :active",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":userId": userId,
            ":active": FriendshipStatus.ACTIVE,
          },
          Limit: limitWithExtra,
          ExclusiveStartKey: exclusiveStartKey2,
          ScanIndexForward: scanForward,
        }),
      ),
    ]);

    const seen = new Set<string>();
    const allItems: Record<string, any>[] = [];
    for (const item of [...(result1.Items || []), ...(result2.Items || [])]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        allItems.push(item);
      }
    }

    allItems.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortBy === "newest" ? timeB - timeA : timeA - timeB;
    });

    const pageItems = allItems.slice(0, limit + 1);
    const hasMore = pageItems.length > limit;
    const returnItems = hasMore ? pageItems.slice(0, limit) : pageItems;

    let nextCursor = "";
    if (hasMore) {
      nextCursor = Buffer.from(
        JSON.stringify({
          key1: result1.LastEvaluatedKey,
          key2: result2.LastEvaluatedKey,
        }),
      ).toString("base64");
    }

    return {
      friendships: returnItems.map((item) => this.toEntity(item)),
      nextCursor,
      hasMore,
    };
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.findFriendshipsForUser(userId);
    return friendships.map((f) => (f.userA === userId ? f.userB : f.userA));
  }

  async getMutualFriendIds(userId1: string, userId2: string): Promise<string[]> {
    const [friends1, friends2] = await Promise.all([
      this.getFriendIds(userId1),
      this.getFriendIds(userId2),
    ]);
    const set2 = new Set(friends2);
    return friends1.filter((id) => set2.has(id));
  }
}

class DynamoFriendshipCommandRepository extends BaseCommandRepositoryDynamoDB<
  Friendship,
  FriendshipUpdateDTO,
  typeof TABLE_NAMES.FRIENDSHIPS
> {
  constructor() {
    super(TABLE_NAMES.FRIENDSHIPS, true);
  }

  protected beforeInsert(data: Friendship): Record<string, any> {
    const d = data as any;
    const now = d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString();
    const [userA, userB] = [d.userA, d.userB].sort();
    return {
      id: d.id,
      userA,
      userB,
      status: d.status || FriendshipStatus.ACTIVE,
      createdAt: now,
    };
  }

  protected beforeUpdate(id: string, data: FriendshipUpdateDTO): Record<string, any> {
    return {};
  }

  async softDeleteFriendship(userA: string, userB: string): Promise<boolean> {
    const [a, b] = [userA, userB].sort();
    const docClient = getDocClient();
    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(TABLE_NAMES.FRIENDSHIPS),
        Key: { userA: a, userB: b },
        UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": FriendshipStatus.DELETED,
          ":updatedAt": new Date().toISOString(),
        },
      }),
    );
    return true;
  }

  async restoreFriendship(userA: string, userB: string): Promise<boolean> {
    const [a, b] = [userA, userB].sort();
    const docClient = getDocClient();
    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(TABLE_NAMES.FRIENDSHIPS),
        Key: { userA: a, userB: b },
        UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": FriendshipStatus.ACTIVE,
          ":updatedAt": new Date().toISOString(),
        },
      }),
    );
    return true;
  }
}

export class DynamoFriendshipRepository extends BaseRepositoryDynamoDB<
  Friendship,
  FriendshipCondDTO,
  FriendshipUpdateDTO,
  typeof TABLE_NAMES.FRIENDSHIPS
> {
  constructor() {
    super(
      new DynamoFriendshipQueryRepository(),
      new DynamoFriendshipCommandRepository(),
    );
  }

  async findFriendshipsWithCursor(
    userId: string,
    cursor: string | undefined,
    limit: number,
    sortBy: "newest" | "oldest",
  ) {
    return (this.queryRepo as DynamoFriendshipQueryRepository).findFriendshipsWithCursor(
      userId,
      cursor,
      limit,
      sortBy,
    );
  }

  async findFriendshipsForUser(userId: string): Promise<Friendship[]> {
    return (this.queryRepo as DynamoFriendshipQueryRepository).findFriendshipsForUser(userId);
  }

  async getFriendIds(userId: string): Promise<string[]> {
    return (this.queryRepo as DynamoFriendshipQueryRepository).getFriendIds(userId);
  }

  async getMutualFriendIds(userId1: string, userId2: string): Promise<string[]> {
    return (this.queryRepo as DynamoFriendshipQueryRepository).getMutualFriendIds(userId1, userId2);
  }

  async deleteByCondition(cond: FriendshipCondDTO): Promise<boolean> {
    if (cond.userA && cond.userB) {
      return (this.cmdRepo as DynamoFriendshipCommandRepository).softDeleteFriendship(
        cond.userA,
        cond.userB,
      );
    }
    return false;
  }

  async softDeleteFriendship(userA: string, userB: string): Promise<boolean> {
    return (this.cmdRepo as DynamoFriendshipCommandRepository).softDeleteFriendship(userA, userB);
  }

  async restoreFriendship(userA: string, userB: string): Promise<boolean> {
    return (this.cmdRepo as DynamoFriendshipCommandRepository).restoreFriendship(userA, userB);
  }
}
