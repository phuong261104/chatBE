import { Friendship } from "@modules/friendships/model/model";
import { FriendshipCondDTO, FriendshipUpdateDTO } from "@modules/friendships/model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { PutCommand, QueryCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
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
    const { pk, sk, ...rest } = doc;
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
    if (_cond.userA) {
      return "userA = :userA";
    }
    if (_cond.userB) {
      return "userB = :userB";
    }
    return undefined;
  }

  async findFriendshipsForUser(userId: string): Promise<Friendship[]> {
    const docClient = getDocClient();
    const [result1, result2] = await Promise.all([
      docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.FRIENDSHIPS),
          KeyConditionExpression: "userA = :userId",
          ExpressionAttributeValues: { ":userId": userId },
        }),
      ),
      docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.FRIENDSHIPS),
          IndexName: "userB-index",
          KeyConditionExpression: "userB = :userId",
          ExpressionAttributeValues: { ":userId": userId },
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
    const now = new Date().toISOString();
    const [userA, userB] = [d.userA, d.userB].sort();
    return {
      id: d.id,
      userA,
      userB,
      createdAt: d.createdAt ? d.createdAt.toISOString() : now,
    };
  }

  protected beforeUpdate(id: string, data: FriendshipUpdateDTO): Record<string, any> {
    return {};
  }

  async deleteByCondition(userA: string, userB: string): Promise<boolean> {
    const [a, b] = [userA, userB].sort();
    const docClient = getDocClient();
    await docClient.send(
      new DeleteCommand({
        TableName: getTableName(TABLE_NAMES.FRIENDSHIPS),
        Key: { userA: a, userB: b },
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
    super(new DynamoFriendshipQueryRepository(), new DynamoFriendshipCommandRepository());
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
      return (this.cmdRepo as DynamoFriendshipCommandRepository).deleteByCondition(cond.userA, cond.userB);
    }
    return false;
  }
}
