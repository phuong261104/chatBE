import {
  GroupBlock,
} from "../../../model";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import {
  GetCommand,
  QueryCommand,
  DeleteCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

class DynamoGroupBlockQueryRepository extends BaseQueryRepositoryDynamoDB<
  GroupBlock,
  Record<string, unknown>,
  typeof TABLE_NAMES.GROUP_BLOCKS
> {
  constructor() {
    super(TABLE_NAMES.GROUP_BLOCKS, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): GroupBlock {
    return {
      pk: doc.pk,
      sk: doc.sk,
      conversationId: doc.conversationId,
      userId: doc.userId,
      blockedBy: doc.blockedBy,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    };
  }

  protected buildFilterExpression(_cond: Record<string, unknown>): string {
    return "";
  }

  protected buildAttributeNames(_cond: Record<string, unknown>): Record<string, string> {
    return {};
  }

  protected buildAttributeValues(_cond: Record<string, unknown>): Record<string, any> {
    return {};
  }

  async findByConversationAndUser(conversationId: string, userId: string): Promise<GroupBlock | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.GROUP_BLOCKS),
        KeyConditionExpression: "pk = :pk AND sk = :sk",
        ExpressionAttributeValues: {
          ":pk": `GROUP#${conversationId}`,
          ":sk": `USER#${userId}`,
        },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async listByConversationId(conversationId: string): Promise<GroupBlock[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.GROUP_BLOCKS),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `GROUP#${conversationId}`,
          ":skPrefix": "USER#",
        },
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async isUserBlocked(conversationId: string, userId: string): Promise<boolean> {
    const block = await this.findByConversationAndUser(conversationId, userId);
    return block !== null;
  }
}

class DynamoGroupBlockCommandRepository extends BaseCommandRepositoryDynamoDB<
  GroupBlock,
  Partial<GroupBlock>,
  typeof TABLE_NAMES.GROUP_BLOCKS
> {
  constructor() {
    super(TABLE_NAMES.GROUP_BLOCKS, true);
  }

  protected beforeInsert(data: GroupBlock): Record<string, any> {
    const now = new Date().toISOString();
    return {
      pk: `GROUP#${data.conversationId}`,
      sk: `USER#${data.userId}`,
      conversationId: data.conversationId,
      userId: data.userId,
      blockedBy: data.blockedBy,
      createdAt: data.createdAt ? data.createdAt.toISOString() : now,
    };
  }

  protected beforeUpdate(id: string, data: Partial<GroupBlock>): Record<string, any> {
    return {};
  }
}

export class DynamoGroupBlockRepository extends BaseRepositoryDynamoDB<
  GroupBlock,
  Record<string, unknown>,
  Partial<GroupBlock>,
  typeof TABLE_NAMES.GROUP_BLOCKS
> {
  constructor() {
    super(
      new DynamoGroupBlockQueryRepository(),
      new DynamoGroupBlockCommandRepository(),
    );
  }

  async findByConversationAndUser(conversationId: string, userId: string): Promise<GroupBlock | null> {
    return (this.queryRepo as DynamoGroupBlockQueryRepository).findByConversationAndUser(conversationId, userId);
  }

  async listByConversationId(conversationId: string): Promise<GroupBlock[]> {
    return (this.queryRepo as DynamoGroupBlockQueryRepository).listByConversationId(conversationId);
  }

  async isUserBlocked(conversationId: string, userId: string): Promise<boolean> {
    return (this.queryRepo as DynamoGroupBlockQueryRepository).isUserBlocked(conversationId, userId);
  }

  async deleteByConversationAndUser(conversationId: string, userId: string): Promise<void> {
    const docClient = getDocClient();
    await docClient.send(
      new DeleteCommand({
        TableName: getTableName(TABLE_NAMES.GROUP_BLOCKS),
        Key: {
          pk: `GROUP#${conversationId}`,
          sk: `USER#${userId}`,
        },
      }),
    );
  }
}
