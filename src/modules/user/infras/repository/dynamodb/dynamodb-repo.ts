import { User, UserStatus } from "@modules/user/model/model";
import { UserCondDTO, UserUpdateDTO } from "@modules/user/model/dto";
import { IUserLastSeenSyncPort } from "@modules/user/interface";
import { config } from "@share/component/config";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { PutCommand, QueryCommand, UpdateCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

class DynamoUserQueryRepository extends BaseQueryRepositoryDynamoDB<User, UserCondDTO, typeof TABLE_NAMES.USERS> {
  constructor() {
    super(TABLE_NAMES.USERS, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): User {
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    const dates = ["createdAt", "updatedAt", "lastLoginAt", "lastSeen", "emailVerifiedAt", "birthday"];
    for (const field of dates) {
      if (rest[field] && typeof rest[field] === "string") {
        rest[field] = new Date(rest[field]);
      }
    }
    return {
      ...rest,
      id: rest.id || doc.id,
    } as User;
  }

  async findByCond(cond: UserCondDTO): Promise<User | null> {
    if (cond.phone) {
      const user = await this.findByPhone(cond.phone);
      if (!user) return null;
      if (cond.status && user.status !== cond.status) return null;
      if ((cond as any)["verified.email"] !== undefined && user.verified?.email !== (cond as any)["verified.email"])
        return null;
      if ((cond as any)["verified.phone"] !== undefined && user.verified?.phone !== (cond as any)["verified.phone"])
        return null;
      if (
        (cond as any)["privacy.searchableByPhone"] !== undefined &&
        user.privacy?.searchableByPhone !== (cond as any)["privacy.searchableByPhone"]
      )
        return null;
      return user;
    }
    if (cond.email) {
      return this.findByEmail(cond.email);
    }
    if (cond.username) {
      return this.findByUsername(cond.username);
    }
    const attrNames = this.buildAttributeNames(cond) || {};
    const attrValues = this.buildAttributeValues(cond);
    const filterExpr = this.buildFilterExpression(cond);
    const hasAttrNames = Object.keys(attrNames).length > 0;
    const hasAttrValues = Object.keys(attrValues).length > 0;
    const hasFilterExpr = !!filterExpr && filterExpr.length > 0;

    const cmd = new ScanCommand({
      TableName: this.getTableName(),
      ...(hasFilterExpr ? { FilterExpression: filterExpr } : {}),
      ...(hasAttrNames ? { ExpressionAttributeNames: attrNames } : {}),
      ...(hasAttrValues ? { ExpressionAttributeValues: attrValues } : {}),
      Limit: 1000,
    });
    const result = (await this.docClient.send(cmd)) as any;
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  protected buildAttributeNames(cond: UserCondDTO): Record<string, string> {
    const names: Record<string, string> = {};
    if (cond.username) names["#username"] = "username";
    if (cond.status) names["#status"] = "status";
    if ((cond as any)["verified.email"] !== undefined) names["#verifiedEmail"] = "verified.email";
    if ((cond as any)["verified.phone"] !== undefined) names["#verifiedPhone"] = "verified.phone";
    if ((cond as any)["privacy.searchableByPhone"] !== undefined)
      names["#searchableByPhone"] = "privacy.searchableByPhone";
    return names;
  }

  protected buildFilterExpression(cond: UserCondDTO): string {
    const conditions: string[] = [];
    if (cond.email) conditions.push("email = :email");
    if (cond.phone) conditions.push("phone = :phone");
    if (cond.username) conditions.push("#username = :username");
    if (cond.status) conditions.push("#status = :status");
    if (cond["verified.email"] !== undefined) conditions.push("verified.email = :verifiedEmail");
    if (cond["verified.phone"] !== undefined) conditions.push("verified.phone = :verifiedPhone");
    if ((cond as any)["privacy.searchableByPhone"] !== undefined)
      conditions.push("privacy.searchableByPhone = :searchableByPhone");
    return conditions.join(" AND ");
  }

  protected buildAttributeValues(cond: UserCondDTO): Record<string, any> {
    const values: Record<string, any> = {};
    if (cond.email) values[":email"] = cond.email;
    if (cond.phone) values[":phone"] = cond.phone;
    if (cond.username) values[":username"] = cond.username;
    if (cond.status) values[":status"] = cond.status;
    if ((cond as any)["verified.email"] !== undefined) values[":verifiedEmail"] = (cond as any)["verified.email"];
    if ((cond as any)["verified.phone"] !== undefined) values[":verifiedPhone"] = (cond as any)["verified.phone"];
    if ((cond as any)["privacy.searchableByPhone"] !== undefined)
      values[":searchableByPhone"] = (cond as any)["privacy.searchableByPhone"];
    return values;
  }

  async findByEmail(email: string): Promise<User | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.USERS),
        IndexName: "email-index",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: { ":email": email },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.USERS),
        IndexName: "phone-index",
        KeyConditionExpression: "phone = :phone",
        ExpressionAttributeValues: { ":phone": phone },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.USERS),
        IndexName: "username-index",
        KeyConditionExpression: "username = :username",
        ExpressionAttributeValues: { ":username": username },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async searchUsers(query: string, currentUserId: string, limit: number = 20): Promise<User[]> {
    const docClient = getDocClient();
    const searchLower = query.toLowerCase().trim();
    const result = await docClient.send(
      new ScanCommand({
        TableName: getTableName(TABLE_NAMES.USERS),
        FilterExpression: "(contains(#displayName, :q) OR contains(#username, :q)) AND #status = :active AND #id <> :currentUser",
        ExpressionAttributeNames: {
          "#displayName": "displayName",
          "#username": "username",
          "#status": "status",
          "#id": "id",
        },
        ExpressionAttributeValues: {
          ":q": searchLower,
          ":active": "active",
          ":currentUser": currentUserId,
        },
        Limit: 1000,
      }),
    );

    const users = (result.Items || [])
      .map((item) => this.toEntity(item))
      .filter((u) => u && u.status === UserStatus.ACTIVE);

    const matched = users.filter((u) =>
      (u.displayName && u.displayName.toLowerCase().includes(searchLower)) ||
      (u.username && u.username.toLowerCase().includes(searchLower))
    );

    return matched.slice(0, limit);
  }

  async getRandomActiveUsers(excludeIds: string[], limit: number = 20): Promise<User[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new ScanCommand({
        TableName: getTableName(TABLE_NAMES.USERS),
        FilterExpression: "#status = :active",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":active": "active" },
        Limit: 1000,
      }),
    );

    const allUsers = (result.Items || [])
      .map((item) => this.toEntity(item))
      .filter((u) => u && u.status === UserStatus.ACTIVE && !excludeIds.includes(u.id));

    for (let i = allUsers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allUsers[i], allUsers[j]] = [allUsers[j], allUsers[i]];
    }

    return allUsers.slice(0, limit);
  }
}

class DynamoUserCommandRepository extends BaseCommandRepositoryDynamoDB<User, UserUpdateDTO, typeof TABLE_NAMES.USERS> {
  constructor() {
    super(TABLE_NAMES.USERS, true);
  }

  protected beforeInsert(data: User): Record<string, any> {
    const now = new Date();
    const d = data as any;
    return {
      id: d.id,
      email: d.email,
      phone: d.phone,
      username: d.username,
      password: d.password,
      salt: d.salt,
      status: d.status,
      tokenVersion: d.tokenVersion || 1,
      verified: d.verified,
      emailVerifiedAt: d.emailVerifiedAt ? d.emailVerifiedAt.toISOString() : null,
      displayName: d.displayName,
      avatarUrl: d.avatarUrl,
      coverUrl: d.coverUrl,
      birthday: d.birthday ? (d.birthday instanceof Date ? d.birthday.toISOString() : d.birthday) : null,
      gender: d.gender,
      bio: d.bio,
      privacy: d.privacy,
      settings: d.settings,
      lastLoginAt: d.lastLoginAt ? d.lastLoginAt.toISOString() : null,
      lastSeen: d.lastSeen ? d.lastSeen.toISOString() : null,
      createdAt: d.createdAt ? d.createdAt.toISOString() : now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  protected beforeUpdate(id: string, data: UserUpdateDTO): Record<string, any> {
    const now = new Date().toISOString();
    const updateData: Record<string, any> = { updatedAt: now };
    const d = data as any;
    if (d.email !== undefined) updateData.email = d.email;
    if (d.phone !== undefined) updateData.phone = d.phone;
    if (d.username !== undefined) updateData.username = d.username;
    if (d.password !== undefined) updateData.password = d.password;
    if (d.salt !== undefined) updateData.salt = d.salt;
    if (d.status !== undefined) updateData.status = d.status;
    if (d.displayName !== undefined) updateData.displayName = d.displayName;
    if (d.avatarUrl !== undefined) updateData.avatarUrl = d.avatarUrl;
    if (d.coverUrl !== undefined) updateData.coverUrl = d.coverUrl;
    if (d.birthday !== undefined) {
      updateData.birthday = d.birthday ? (d.birthday instanceof Date ? d.birthday.toISOString() : String(d.birthday)) : null;
    }
    if (d.gender !== undefined) updateData.gender = d.gender;
    if (d.bio !== undefined) updateData.bio = d.bio;
    if (d.verified !== undefined) updateData.verified = d.verified;
    if (d.privacy !== undefined) updateData.privacy = d.privacy;
    if (d.settings !== undefined) updateData.settings = d.settings;
    if (d.lastLoginAt !== undefined) {
      const val = d.lastLoginAt;
      updateData.lastLoginAt = val instanceof Date ? val.toISOString() : String(val);
    }
    return updateData;
  }
}

export class DynamoUserRepository
  extends BaseRepositoryDynamoDB<User, UserCondDTO, UserUpdateDTO, typeof TABLE_NAMES.USERS>
  implements IUserLastSeenSyncPort
{
  constructor() {
    super(new DynamoUserQueryRepository(), new DynamoUserCommandRepository());
  }

  async syncLastSeenToDB(userId: string, timestamp: number): Promise<boolean> {
    try {
      if (!userId || !Number.isFinite(timestamp)) return false;
      const lastSeenAt = new Date(timestamp);
      if (Number.isNaN(lastSeenAt.getTime())) return false;

      const docClient = getDocClient();
      await docClient.send(
        new UpdateCommand({
          TableName: getTableName(TABLE_NAMES.USERS),
          Key: { id: userId },
          UpdateExpression: "SET lastSeen = :lastSeen, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":lastSeen": lastSeenAt.toISOString(),
            ":updatedAt": new Date().toISOString(),
          },
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}

export class DynamoUserQueryRepo extends DynamoUserQueryRepository {}
export class DynamoUserCommandRepo extends DynamoUserCommandRepository {}
