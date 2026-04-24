import { Collection, CollectionItem } from "@modules/my-cloud/model/model";
import { CollectionCondDTO, CreateCollectionDTO, UpdateCollectionDTO } from "@modules/my-cloud/model/dto";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
import {
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { v7 } from "uuid";

const DEFAULT_COLLECTION_NAME = "My Document";

export interface ICollectionRepository {
  get(id: string): Promise<Collection | null>;
  findByCond(cond: CollectionCondDTO): Promise<Collection | null>;
  list(cond: CollectionCondDTO): Promise<Collection[]>;
  insert(data: Collection): Promise<boolean>;
  update(id: string, data: UpdateCollectionDTO): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  softDelete(id: string): Promise<boolean>;
  ensureDefaultCollection(userId: string): Promise<Collection>;
  getDefaultCollection(userId: string): Promise<Collection | null>;
  addItemToCollection(collectionId: string, itemId: string, userId: string): Promise<boolean>;
  removeItemFromCollection(collectionId: string, itemId: string): Promise<boolean>;
  getCollectionItems(collectionId: string, limit?: number, cursor?: string): Promise<{ itemIds: string[]; nextCursor?: string }>;
  updateItemCount(collectionId: string, delta: number): Promise<void>;
}

export class DynamoCollectionRepository implements ICollectionRepository {
  private readonly tableName: string;
  private readonly itemsTableName: string;

  constructor() {
    this.tableName = getTableName(TABLE_NAMES.COLLECTIONS);
    this.itemsTableName = getTableName(TABLE_NAMES.COLLECTION_ITEMS);
  }

  private toEntity(doc: Record<string, any>): Collection {
    return {
      id: doc.id,
      userId: doc.userId,
      name: doc.name,
      description: doc.description || undefined,
      color: doc.color || undefined,
      icon: doc.icon || undefined,
      coverImageUrl: doc.coverImageUrl || undefined,
      parentId: doc.parentId || undefined,
      isDefault: doc.isDefault === "true" || doc.isDefault === true,
      isDeleted: doc.isDeleted === "true" || doc.isDeleted === true,
      itemCount: typeof doc.itemCount === "number" ? doc.itemCount : parseInt(doc.itemCount || "0", 10),
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
    } as Collection;
  }

  async get(id: string): Promise<Collection | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new GetCommand({ TableName: this.tableName, Key: { id } })
    );
    return result.Item ? this.toEntity(result.Item) : null;
  }

  async findByCond(cond: CollectionCondDTO): Promise<Collection | null> {
    const items = await this.list(cond);
    return items.length > 0 ? items[0] : null;
  }

  async list(cond: CollectionCondDTO): Promise<Collection[]> {
    const docClient = getDocClient();
    const items: Collection[] = [];
    let lastKey: Record<string, any> | undefined;

    while (true) {
      const queryParams: any = {
        TableName: this.tableName,
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": cond.userId },
        ExclusiveStartKey: lastKey,
      };

      if (cond.isDefault !== undefined) {
        queryParams.IndexName = "userId-isDefault-index";
        queryParams.KeyConditionExpression = "userId = :uid AND isDefault = :isDefault";
        queryParams.ExpressionAttributeValues[":isDefault"] = String(cond.isDefault);
      } else if (cond.parentId !== undefined && cond.parentId !== null) {
        const parentIdValue = cond.parentId === "" ? "__null__" : cond.parentId;
        queryParams.IndexName = "userId-parentId-index";
        queryParams.KeyConditionExpression = "userId = :uid AND parentId = :pid";
        queryParams.ExpressionAttributeValues[":pid"] = parentIdValue;
      }

      const result = await docClient.send(new QueryCommand(queryParams));
      const mapped = (result.Items || []).map((item) => this.toEntity(item));
      items.push(...mapped);

      lastKey = result.LastEvaluatedKey;
      if (!lastKey) break;
    }

    return items;
  }

  async insert(data: Collection): Promise<boolean> {
    const docClient = getDocClient();
    const now = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          id: data.id,
          userId: data.userId,
          name: data.name,
          description: data.description || "",
          color: data.color || "",
          icon: data.icon || "",
          coverImageUrl: data.coverImageUrl || "",
          parentId: data.parentId || "__null__",
          isDefault: String(data.isDefault),
          isDeleted: String(data.isDeleted),
          itemCount: data.itemCount || 0,
          createdAt: data.createdAt.toISOString(),
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(id)",
      })
    );
    return true;
  }

  async update(id: string, data: UpdateCollectionDTO): Promise<boolean> {
    const docClient = getDocClient();
    const updateExprs: string[] = ["updatedAt = :now"];
    const attrNames: Record<string, string> = {};
    const attrValues: Record<string, any> = { ":now": new Date().toISOString() };

    if (data.name !== undefined) {
      attrNames["#n"] = "name";
      updateExprs.push("#n = :name");
      attrValues[":name"] = data.name;
    }
    if (data.description !== undefined) {
      attrNames["#d"] = "description";
      updateExprs.push("#d = :desc");
      attrValues[":desc"] = data.description;
    }
    if (data.color !== undefined) {
      attrNames["#c"] = "color";
      updateExprs.push("#c = :color");
      attrValues[":color"] = data.color;
    }
    if (data.icon !== undefined) {
      attrNames["#i"] = "icon";
      updateExprs.push("#i = :icon");
      attrValues[":icon"] = data.icon;
    }
    if (data.coverImageUrl !== undefined) {
      attrNames["#cu"] = "coverImageUrl";
      updateExprs.push("#cu = :coverImageUrl");
      attrValues[":coverImageUrl"] = data.coverImageUrl;
    }
    if (data.parentId !== undefined) {
      attrNames["#p"] = "parentId";
      updateExprs.push("#p = :parentId");
      attrValues[":parentId"] = data.parentId === null ? "__null__" : data.parentId;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: "SET " + updateExprs.join(", "),
        ExpressionAttributeNames: Object.keys(attrNames).length > 0 ? attrNames : undefined,
        ExpressionAttributeValues: attrValues,
      })
    );
    return true;
  }

  async delete(id: string): Promise<boolean> {
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
        UpdateExpression: "SET isDeleted = :true, updatedAt = :now",
        ExpressionAttributeValues: { ":true": "true", ":now": now },
      })
    );
    return true;
  }

  async ensureDefaultCollection(userId: string): Promise<Collection> {
    const existing = await this.getDefaultCollection(userId);
    if (existing) return existing;

    const now = new Date();
    const collection: Collection = {
      id: v7(),
      userId,
      name: DEFAULT_COLLECTION_NAME,
      description: "Your default document collection",
      color: "#4F46E5",
      icon: "folder",
      coverImageUrl: undefined,
      parentId: undefined,
      isDefault: true,
      isDeleted: false,
      itemCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.insert(collection);
      return collection;
    } catch (err: any) {
      if (err.name === "ConditionalCheckFailedException") {
        const existing = await this.getDefaultCollection(userId);
        if (existing) return existing;
      }
      throw err;
    }
  }

  async getDefaultCollection(userId: string): Promise<Collection | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "userId-isDefault-index",
        KeyConditionExpression: "userId = :uid AND isDefault = :isDefault",
        ExpressionAttributeValues: {
          ":uid": userId,
          ":isDefault": "true",
        },
        Limit: 1,
      })
    );

    if (result.Items && result.Items.length > 0) {
      return this.toEntity(result.Items[0]);
    }
    return null;
  }

  async addItemToCollection(collectionId: string, itemId: string, userId: string): Promise<boolean> {
    const docClient = getDocClient();
    await docClient.send(
      new PutCommand({
        TableName: this.itemsTableName,
        Item: {
          pk: `COLLECTION#${collectionId}`,
          sk: `ITEM#${itemId}`,
          collectionId,
          itemId,
          userId,
          addedAt: new Date().toISOString(),
        },
      })
    );
    return true;
  }

  async removeItemFromCollection(collectionId: string, itemId: string): Promise<boolean> {
    const docClient = getDocClient();
    await docClient.send(
      new DeleteCommand({
        TableName: this.itemsTableName,
        Key: {
          pk: `COLLECTION#${collectionId}`,
          sk: `ITEM#${itemId}`,
        },
      })
    );
    return true;
  }

  async getCollectionItems(collectionId: string, limit?: number, cursor?: string): Promise<{ itemIds: string[]; nextCursor?: string }> {
    const docClient = getDocClient();
    let exclusiveStartKey: Record<string, any> | undefined;
    if (cursor) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
      } catch {
        exclusiveStartKey = undefined;
      }
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: this.itemsTableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `COLLECTION#${collectionId}`,
          ":skPrefix": "ITEM#",
        },
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    const itemIds = (result.Items || []).map((item) => item.itemId as string);

    let nextCursor: string | undefined;
    if (result.LastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
    }

    return { itemIds, nextCursor };
  }

  async updateItemCount(collectionId: string, delta: number): Promise<void> {
    const docClient = getDocClient();
    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id: collectionId },
        UpdateExpression: "SET itemCount = itemCount + :delta, updatedAt = :now",
        ExpressionAttributeValues: {
          ":delta": delta,
          ":now": new Date().toISOString(),
        },
      })
    );
  }
}
