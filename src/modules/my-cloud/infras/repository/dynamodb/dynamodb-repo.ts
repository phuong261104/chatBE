import { CloudItem, CloudItemType } from "@modules/my-cloud/model/model";
import {
  CloudItemCondDTO,
  UpdateCloudItemDTO,
  CloudItemStats,
} from "@modules/my-cloud/model/dto";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import {
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

export class DynamoCloudItemRepository {
  private readonly tableName: string;

  constructor() {
    this.tableName = getTableName(TABLE_NAMES.CLOUD_ITEMS);
  }

  private toEntity(doc: Record<string, any>): CloudItem {
    return {
      id: doc.id,
      userId: doc.userId,
      type: doc.itemType as CloudItemType ?? doc.type as CloudItemType,
      title: doc.title,
      content: doc.content,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimetype: doc.mimetype,
      thumbnailUrl: doc.thumbnailUrl,
      isPinned: doc.isPinned === "true" || doc.isPinned === true,
      isDeleted: doc.isDeleted === "true" || doc.isDeleted === true,
      deletedAt: doc.deletedAt ? new Date(doc.deletedAt) : undefined,
      shareToken: doc.shareToken,
      shareExpiresAt: doc.shareExpiresAt
        ? new Date(doc.shareExpiresAt)
        : undefined,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
    } as CloudItem;
  }

  // ========== READ ==========

  async get(id: string): Promise<CloudItem | null> {
    const docClient = getDocClient();
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const result = await docClient.send(
      new GetCommand({ TableName: this.tableName, Key: { id } })
    );
    return result.Item ? this.toEntity(result.Item) : null;
  }

  async findByCond(cond: CloudItemCondDTO): Promise<CloudItem | null> {
    const items = await this.list(cond, { page: 1, limit: 1 });
    return items.length > 0 ? items[0] : null;
  }

  async list(cond: CloudItemCondDTO, paging: any): Promise<CloudItem[]> {
    const docClient = getDocClient();
    const items: CloudItem[] = [];
    let lastKey: Record<string, any> | undefined;
    let pageNum = 1;
    const limit = paging?.limit || 50;

    while (items.length < limit && pageNum <= 100) {
      const result = await docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: this.buildFilter(cond),
          ExpressionAttributeNames: this.buildAttrNames(cond),
          ExpressionAttributeValues: this.buildAttrValues(cond),
          ExclusiveStartKey: lastKey,
          Limit: limit,
        })
      );

      const mapped = (result.Items || [])
        .map((item) => this.toEntity(item))
        .filter((item) => !item.isDeleted);

      if (pageNum === 1) {
        items.push(...mapped.slice(0, limit));
      }

      lastKey = result.LastEvaluatedKey;
      if (!lastKey) break;
      pageNum++;
    }

    return items.slice(0, limit);
  }

  async listByIds(ids: string[]): Promise<CloudItem[]> {
    if (ids.length === 0) return [];
    const docClient = getDocClient();
    const { BatchGetCommand } = await import("@aws-sdk/lib-dynamodb");
    const keys = ids.map((id) => ({ id }));
    const chunks = this.chunkArray(keys, 100);
    const results: CloudItem[] = [];
    for (const chunk of chunks) {
      const result = await docClient.send(
        new BatchGetCommand({
          RequestItems: { [this.tableName]: { Keys: chunk } },
        })
      );
      if (result.Responses && result.Responses[this.tableName]) {
        results.push(
          ...result.Responses[this.tableName].map((item) =>
            this.toEntity(item)
          )
        );
      }
    }
    return results;
  }

  async countByUserId(userId: string, type?: string): Promise<number> {
    const docClient = getDocClient();
    let total = 0;
    let lastKey: Record<string, any> | undefined;

    while (true) {
      const result = await docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression:
            "userId = :uid AND isDeleted = :false" +
            (type ? " AND #itemType = :type" : ""),
          ExpressionAttributeNames: type ? { "#itemType": "type" } : undefined,
          ExpressionAttributeValues: {
            ":uid": userId,
            ":false": "false",
            ...(type ? { ":type": type } : {}),
          },
          ExclusiveStartKey: lastKey,
          Select: "COUNT",
        })
      );
      total += result.Count || 0;
      lastKey = result.LastEvaluatedKey;
      if (!lastKey) break;
    }
    return total;
  }

  async loadByUserId(options: {
    userId: string;
    type?: string;
    isDeleted?: boolean;
    isPinned?: boolean;
    limit: number;
    cursor?: string;
    sortOrder?: string;
  }): Promise<{ items: CloudItem[]; nextCursor?: string }> {
    const docClient = getDocClient();
    let exclusiveStartKey: Record<string, any> | undefined;
    if (options.cursor) {
      try {
        exclusiveStartKey = JSON.parse(
          Buffer.from(options.cursor, "base64").toString("utf-8")
        );
      } catch {
        exclusiveStartKey = undefined;
      }
    }

    const conditions: string[] = ["userId = :uid"];
    const attrNames: Record<string, string> = {};
    const attrValues: Record<string, any> = { ":uid": options.userId };

    if (options.type) {
      attrNames["#itemType"] = "type";
      conditions.push("#itemType = :type");
      attrValues[":type"] = options.type;
    }
    if (options.isDeleted !== undefined) {
      conditions.push("isDeleted = :isDel");
      attrValues[":isDel"] = String(options.isDeleted);
    }
    if (options.isPinned !== undefined) {
      attrNames["#itemPinned"] = "isPinned";
      conditions.push("#itemPinned = :isPin");
      attrValues[":isPin"] = String(options.isPinned);
    }

    const result = await docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: conditions.join(" AND "),
        ExpressionAttributeNames:
          Object.keys(attrNames).length > 0 ? attrNames : undefined,
        ExpressionAttributeValues: attrValues,
        Limit: options.limit,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    let items = (result.Items || [])
      .map((item) => this.toEntity(item))
      .filter((item) => !item.isDeleted);

    if (options.sortOrder !== "asc") {
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    let nextCursor: string | undefined;
    if (result.LastEvaluatedKey) {
      nextCursor = Buffer.from(
        JSON.stringify(result.LastEvaluatedKey)
      ).toString("base64");
    }

    return { items, nextCursor };
  }

  async getStats(userId: string): Promise<CloudItemStats> {
    const docClient = getDocClient();
    let lastKey: Record<string, any> | undefined;
    const stats: CloudItemStats = {
      totalItems: 0,
      totalSize: 0,
      pinnedCount: 0,
      trashCount: 0,
      byType: {
        image: { count: 0, size: 0 },
        video: { count: 0, size: 0 },
        voice: { count: 0, size: 0 },
        file: { count: 0, size: 0 },
        link: { count: 0, size: 0 },
        note: { count: 0, size: 0 },
      },
    };

    while (true) {
      const result = await docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "userId = :uid",
          ExpressionAttributeValues: { ":uid": userId },
          ExclusiveStartKey: lastKey,
        })
      );

      for (const item of result.Items || []) {
        const isDeleted = item.isDeleted === "true" || item.isDeleted === true;
        const isPinned = item.isPinned === "true" || item.isPinned === true;
        const itemType = (item.itemType || item.type) as keyof typeof stats.byType;
        const size = item.fileSize || 0;

        if (isDeleted) {
          stats.trashCount++;
          continue;
        }

        if (isPinned) stats.pinnedCount++;

        stats.totalItems++;
        stats.totalSize += size;

        if (itemType && itemType in stats.byType) {
          stats.byType[itemType].count++;
          stats.byType[itemType].size += size;
        }
      }

      lastKey = result.LastEvaluatedKey;
      if (!lastKey) break;
    }

    return stats;
  }

  async search(
    userId: string,
    query: string,
    limit: number
  ): Promise<CloudItem[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression:
          "userId = :uid AND contains(#title, :q) AND isDeleted = :false",
        ExpressionAttributeNames: { "#title": "title" },
        ExpressionAttributeValues: {
          ":uid": userId,
          ":q": query,
          ":false": "false",
        },
        Limit: limit,
      })
    );
    return (result.Items || [])
      .map((item) => this.toEntity(item))
      .filter((item) => !item.isDeleted);
  }

  // ========== WRITE ==========

  async insert(data: CloudItem): Promise<boolean> {
    const docClient = getDocClient();
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    const now = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          id: data.id,
          userId: data.userId,
          itemType: data.type,
          type: data.type,
          title: data.title,
          content: data.content || null,
          fileUrl: data.fileUrl || null,
          fileName: data.fileName || null,
          fileSize: data.fileSize || 0,
          mimetype: data.mimetype || null,
          thumbnailUrl: data.thumbnailUrl || null,
          isPinned: String(data.isPinned),
          isDeleted: String(data.isDeleted),
          createdAt: data.createdAt.toISOString(),
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(id)",
      })
    );
    return true;
  }

  async update(id: string, data: UpdateCloudItemDTO): Promise<boolean> {
    const docClient = getDocClient();
    const updateExprs: string[] = ["updatedAt = :now"];
    const attrNames: Record<string, string> = {};
    const attrValues: Record<string, any> = { ":now": new Date().toISOString() };

    const d = data as any;
    if (d.title !== undefined) {
      attrNames["#t"] = "title";
      updateExprs.push("#t = :title");
      attrValues[":title"] = d.title;
    }
    if (d.content !== undefined) {
      attrNames["#c"] = "content";
      updateExprs.push("#c = :content");
      attrValues[":content"] = d.content;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: "SET " + updateExprs.join(", "),
        ExpressionAttributeNames:
          Object.keys(attrNames).length > 0 ? attrNames : undefined,
        ExpressionAttributeValues: attrValues,
        ConditionExpression: "attribute_exists(id)",
      })
    );
    return true;
  }

  async delete(id: string, _isHard: boolean): Promise<boolean> {
    const docClient = getDocClient();
    await docClient.send(
      new DeleteCommand({ TableName: this.tableName, Key: { id } })
    );
    return true;
  }

  async softDelete(id: string): Promise<boolean> {
    const docClient = getDocClient();
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression:
          "SET isDeleted = :true, deletedAt = :now, updatedAt = :now",
        ExpressionAttributeValues: { ":true": "true", ":now": now },
      })
    );
    return true;
  }

  async restore(id: string): Promise<boolean> {
    const docClient = getDocClient();
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression:
          "SET isDeleted = :false, updatedAt = :now REMOVE deletedAt",
        ExpressionAttributeValues: { ":false": "false", ":now": now },
      })
    );
    return true;
  }

  async pin(id: string, pinned: boolean): Promise<boolean> {
    const docClient = getDocClient();
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression:
          "SET isPinned = :pinned, updatedAt = :now",
        ExpressionAttributeValues: {
          ":pinned": String(pinned),
          ":now": now,
        },
      })
    );
    return true;
  }

  async emptyTrash(userId: string): Promise<number> {
    const docClient = getDocClient();
    let lastKey: Record<string, any> | undefined;
    let deleted = 0;

    while (true) {
      const result = await docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "userId = :uid AND isDeleted = :true",
          ExpressionAttributeValues: { ":uid": userId, ":true": "true" },
          ExclusiveStartKey: lastKey,
          ProjectionExpression: "id",
        })
      );

      for (const item of result.Items || []) {
        await docClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: { id: item.id },
          })
        );
        deleted++;
      }

      lastKey = result.LastEvaluatedKey;
      if (!lastKey) break;
    }

    return deleted;
  }

  async setShareToken(
    id: string,
    token: string,
    expiresAt: Date
  ): Promise<boolean> {
    const docClient = getDocClient();
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression:
          "SET shareToken = :token, shareExpiresAt = :expiresAt, updatedAt = :now",
        ExpressionAttributeValues: {
          ":token": token,
          ":expiresAt": expiresAt.toISOString(),
          ":now": now,
        },
      })
    );
    return true;
  }

  async getByShareToken(token: string): Promise<CloudItem | null> {
    const docClient = getDocClient();
    let lastKey: Record<string, any> | undefined;

    while (true) {
      const result = await docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression:
            "shareToken = :token AND isDeleted = :false",
          ExpressionAttributeValues: { ":token": token, ":false": "false" },
          ExclusiveStartKey: lastKey,
          Limit: 1,
        })
      );

      if (result.Items && result.Items.length > 0) {
        return this.toEntity(result.Items[0]);
      }

      lastKey = result.LastEvaluatedKey;
      if (!lastKey) break;
    }

    return null;
  }

  // ========== HELPERS ==========

  private buildFilter(cond: CloudItemCondDTO): string {
    const parts: string[] = [];
    if (cond.userId) parts.push("userId = :uid");
    if (cond.type) parts.push("#itype = :itype");
    return parts.join(" AND ");
  }

  private buildAttrNames(cond: CloudItemCondDTO): Record<string, string> | undefined {
    if (cond.type) return { "#itype": "type" };
    return undefined;
  }

  private buildAttrValues(cond: CloudItemCondDTO): Record<string, any> {
    const values: Record<string, any> = {};
    if (cond.userId) values[":uid"] = cond.userId;
    if (cond.type) values[":itype"] = cond.type;
    return values;
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
