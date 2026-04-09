import { CloudItem } from "@modules/my-cloud/model/model";
import { CloudItemCondDTO, CloudItemUpdateDTO } from "@modules/my-cloud/model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
class DynamoCloudItemQueryRepository extends BaseQueryRepositoryDynamoDB<
  CloudItem,
  CloudItemCondDTO,
  typeof TABLE_NAMES.CLOUD_ITEMS
> {
  constructor() {
    super(TABLE_NAMES.CLOUD_ITEMS, { createdAt: -1 }, "userId-index");
  }

  protected toEntity(doc: Record<string, any>): CloudItem {
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    return { ...rest } as CloudItem;
  }

  protected buildFilterExpression(cond: CloudItemCondDTO): string {
    const conditions: string[] = [];
    if (cond.userId) conditions.push("userId = :userId");
    if (cond.type) conditions.push("#type = :type");
    return conditions.join(" AND ");
  }

  protected buildAttributeNames(cond: CloudItemCondDTO): Record<string, string> {
    const names: Record<string, string> = {};
    if (cond.type) names["#type"] = "type";
    return names;
  }

  protected buildAttributeValues(cond: CloudItemCondDTO): Record<string, any> {
    const values: Record<string, any> = {};
    if (cond.userId) values[":userId"] = cond.userId;
    if (cond.type) values[":type"] = cond.type;
    return values;
  }

  protected buildKeyCondition(_cond: CloudItemCondDTO): string | undefined {
    if (_cond.userId && this.gsi) {
      return "userId = :userId";
    }
    return undefined;
  }

  async list(cond: CloudItemCondDTO, paging: any): Promise<CloudItem[]> {
    const docClient = getDocClient();
    if (cond.userId) {
      const result = await docClient.send(
        new QueryCommand({
          TableName: getTableName(TABLE_NAMES.CLOUD_ITEMS),
          IndexName: "userId-index",
          KeyConditionExpression: "userId = :userId",
          ExpressionAttributeValues: { ":userId": cond.userId },
          Limit: paging.limit || 50,
        }),
      );
      return (result.Items || []).map((item) => this.toEntity(item));
    }
    return [];
  }

  async countByUserId(userId: string, type?: string): Promise<number> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.CLOUD_ITEMS),
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :userId",
        FilterExpression: type ? "#type = :type" : undefined,
        ExpressionAttributeNames: type ? { "#type": "type" } : undefined,
        ExpressionAttributeValues: type ? { ":userId": userId, ":type": type } : { ":userId": userId },
      }),
    );
    return result.Items ? result.Items.length : 0;
  }
}

class DynamoCloudItemCommandRepository extends BaseCommandRepositoryDynamoDB<
  CloudItem,
  CloudItemUpdateDTO,
  typeof TABLE_NAMES.CLOUD_ITEMS
> {
  constructor() {
    super(TABLE_NAMES.CLOUD_ITEMS, true);
  }

  protected beforeInsert(data: CloudItem): Record<string, any> {
    const now = new Date().toISOString();
    const d = data as any;
    return {
      id: d.id,
      userId: d.userId,
      type: d.type,
      title: d.title,
      content: d.content,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      fileSize: d.fileSize,
      mimetype: d.mimetype,
      createdAt: d.createdAt ? d.createdAt.toISOString() : now,
      updatedAt: now,
    };
  }

  protected beforeUpdate(id: string, data: CloudItemUpdateDTO): Record<string, any> {
    const updateData: Record<string, any> = {};
    const d = data as any;
    if (d.type !== undefined) updateData.type = d.type;
    if (d.title !== undefined) updateData.title = d.title;
    if (d.content !== undefined) updateData.content = d.content;
    if (d.fileUrl !== undefined) updateData.fileUrl = d.fileUrl;
    if (d.fileName !== undefined) updateData.fileName = d.fileName;
    if (d.fileSize !== undefined) updateData.fileSize = d.fileSize;
    if (d.mimetype !== undefined) updateData.mimetype = d.mimetype;
    return updateData;
  }
}

export class DynamoCloudItemRepository extends BaseRepositoryDynamoDB<
  CloudItem,
  CloudItemCondDTO,
  CloudItemUpdateDTO,
  typeof TABLE_NAMES.CLOUD_ITEMS
> {
  constructor() {
    super(new DynamoCloudItemQueryRepository(), new DynamoCloudItemCommandRepository());
  }

  async list(cond: CloudItemCondDTO, paging: any): Promise<CloudItem[]> {
    return (this.queryRepo as DynamoCloudItemQueryRepository).list(cond, paging);
  }

  async countByUserId(userId: string, type?: string): Promise<number> {
    return (this.queryRepo as DynamoCloudItemQueryRepository).countByUserId(userId, type);
  }
}
