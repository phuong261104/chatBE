import { Message } from "../../../model";
import { MessageCondDTO, MessageUpdateDTO } from "../../../model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import {
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  PutCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

class DynamoMessageQueryRepository extends BaseQueryRepositoryDynamoDB<
  Message,
  MessageCondDTO,
  typeof TABLE_NAMES.MESSAGES
> {
  constructor() {
    super(TABLE_NAMES.MESSAGES, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): Message {
    const { pk, sk, GSI1PK, GSI1SK, createdAt, editedAt, deletedAt, pinnedAt, ...rest } = doc;
    return {
      ...rest,
      id: doc.id || sk?.split("#")[2],
      conversationId: doc.conversationId || doc.pk?.replace("CONV#", ""),
      createdAt: createdAt ? new Date(createdAt) : new Date(),
      editedAt: editedAt ? new Date(editedAt) : null,
      deletedAt: deletedAt ? new Date(deletedAt) : null,
      pinnedAt: pinnedAt ? new Date(pinnedAt) : null,
    } as Message;
  }

  async listByConversation(conversationId: string, limit: number, cursor?: string): Promise<{ messages: Message[]; nextCursor?: string }> {
    const docClient = getDocClient();

    let exclusiveStartKey: Record<string, any> | undefined;
    if (cursor) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
      } catch {
        // Cursor is a message ID (UUID), not base64(JSON) — look it up via GSI id-index
        const msgResult = await docClient.send(
          new QueryCommand({
            TableName: getTableName(TABLE_NAMES.MESSAGES),
            IndexName: "id-index",
            KeyConditionExpression: "id = :id",
            ExpressionAttributeValues: { ":id": cursor },
            Limit: 1,
          }),
        );
        if (msgResult.Items && msgResult.Items.length > 0) {
          const item = msgResult.Items[0];
          exclusiveStartKey = { pk: item.pk, sk: item.sk };
        } else {
          return { messages: [], nextCursor: undefined };
        }
      }
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `CONV#${conversationId}`,
          ":skPrefix": "MSG#",
        },
        Limit: limit,
        ScanIndexForward: false,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    const messages = (result.Items || []).map((item) => this.toEntity(item));
    let nextCursor: string | undefined;
    if (result.LastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
    }

    return { messages, nextCursor };
  }

  async getById(id: string): Promise<Message | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        IndexName: "id-index",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: { ":id": id },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async get(id: string): Promise<Message | null> {
    return await this.getById(id);
  }
}

class DynamoMessageCommandRepository extends BaseCommandRepositoryDynamoDB<
  Message,
  MessageUpdateDTO,
  typeof TABLE_NAMES.MESSAGES
> {
  constructor() {
    super(TABLE_NAMES.MESSAGES, false);
  }

  async update(id: string, data: MessageUpdateDTO): Promise<boolean> {
    const docClient = getDocClient();
    const tableName = this.getTableName();

    const getResult = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "id-index",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: { ":id": id },
        Limit: 1,
      }),
    );
    if (!getResult.Items || getResult.Items.length === 0) return false;

    const item = getResult.Items[0];
    const updateData = this.beforeUpdate(id, data);
    if (Object.keys(updateData).length === 0) return true;

    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};
    let idx = 0;
    for (const [key, value] of Object.entries(updateData)) {
      const nameKey = `#attr${idx}`;
      const valueKey = `:val${idx}`;
      updateExpressions.push(`${nameKey} = ${valueKey}`);
      expressionAttributeNames[nameKey] = key;
      expressionAttributeValues[valueKey] = value;
      idx++;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: item.pk, sk: item.sk },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );
    return true;
  }

  protected beforeInsert(data: Message): Record<string, any> {
    const createdAt = data.createdAt ? data.createdAt.toISOString() : new Date().toISOString();
    return {
      pk: `CONV#${data.conversationId}`,
      sk: `MSG#${createdAt}#${data.id}`,
      id: data.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      type: data.type,
      text: data.text,
      media: data.media,
      links: data.links || [],
      deletedForUserIds: data.deletedForUserIds || [],
      quotedMessageId: data.quotedMessageId,
      quotedMessagePreview: data.quotedMessagePreview,
      createdAt: createdAt,
      editedAt: data.editedAt ? data.editedAt.toISOString() : null,
      deletedAt: data.deletedAt ? data.deletedAt.toISOString() : null,
      pinned: data.pinned || false,
      pinnedAt: data.pinnedAt ? data.pinnedAt.toISOString() : null,
      GSI1PK: `SENDER#${data.senderId}`,
      GSI1SK: createdAt,
    };
  }

  protected beforeUpdate(id: string, data: MessageUpdateDTO): Record<string, any> {
    const updateData: Record<string, any> = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.text !== undefined) updateData.text = data.text;
    if (data.media !== undefined) updateData.media = data.media;
    if (data.links !== undefined) updateData.links = data.links;
    if (data.editedAt !== undefined && data.editedAt !== null) updateData.editedAt = (data.editedAt as Date).toISOString();
    if (data.deletedAt !== undefined && data.deletedAt !== null) updateData.deletedAt = (data.deletedAt as Date).toISOString();
    if (data.deletedForUserIds !== undefined) updateData.deletedForUserIds = data.deletedForUserIds;
    if (data.pinned !== undefined) updateData.pinned = data.pinned;
    if (data.pinnedAt !== undefined && data.pinnedAt !== null) updateData.pinnedAt = (data.pinnedAt as Date).toISOString();
    return updateData;
  }

  private async batchWriteWithRetry(
    tableName: string,
    requestItems: any[],
    maxRetries = 3,
  ): Promise<void> {
    let unprocessed = { [tableName]: requestItems };
    let attempts = 0;
    while (unprocessed && Object.keys(unprocessed).length > 0 && attempts < maxRetries) {
      if (attempts > 0) {
        await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempts)));
      }
      const result = await this.docClient.send(
        new BatchWriteCommand({ RequestItems: unprocessed }),
      );
      unprocessed = result.UnprocessedItems || {};
      attempts++;
    }
    if (unprocessed && Object.keys(unprocessed).length > 0) {
      console.warn(
        `BatchWrite: ${Object.keys(unprocessed)[0].length} items still unprocessed after ${maxRetries} retries`,
      );
    }
  }

  async batchInsert(messages: Message[]): Promise<boolean> {
    if (messages.length === 0) return true;

    const tableName = getTableName(TABLE_NAMES.MESSAGES);
    const chunks = this.chunkArray(messages, 25);

    for (const chunk of chunks) {
      const requestItems = chunk.map((msg) => ({
        PutRequest: { Item: this.beforeInsert(msg) },
      }));
      await this.batchWriteWithRetry(tableName, requestItems);
    }

    return true;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    const docClient = getDocClient();
    const tableName = getTableName(TABLE_NAMES.MESSAGES);

    let lastEvaluatedKey: Record<string, any> | undefined;
    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": `CONV#${conversationId}`,
            ":skPrefix": "MSG#",
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      const items = result.Items || [];
      for (let i = 0; i < items.length; i += 25) {
        const chunk = items.slice(i, i + 25);
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [tableName]: chunk.map((item) => ({
                DeleteRequest: { Key: { pk: item.pk, sk: item.sk } },
              })),
            },
          }),
        );
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }
}

export class DynamoMessageRepository extends BaseRepositoryDynamoDB<
  Message,
  MessageCondDTO,
  MessageUpdateDTO,
  typeof TABLE_NAMES.MESSAGES
> {
  private readonly _cmdRepo: DynamoMessageCommandRepository;

  constructor() {
    const q = new DynamoMessageQueryRepository();
    const c = new DynamoMessageCommandRepository();
    super(q, c);
    this._cmdRepo = c;
  }

  async listWithCursor(
    conversationId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Message[]> {
    const q = new DynamoMessageQueryRepository();
    const result = await q.listByConversation(conversationId, limit, cursor);
    return result.messages;
  }

  async findPinnedMessages(conversationId: string): Promise<Message[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        FilterExpression: "pinned = :pinned AND (attribute_not_exists(deletedAt) OR deletedAt = :null)",
        ExpressionAttributeValues: {
          ":pk": `CONV#${conversationId}`,
          ":skPrefix": "MSG#",
          ":pinned": true,
          ":null": null,
        },
        ScanIndexForward: true,
      }),
    );
    return (result.Items || []).map((item) => {
      const { pk, sk, GSI1PK, GSI1SK, createdAt, editedAt, deletedAt, pinnedAt, ...rest } = item;
      return {
        ...rest,
        id: item.id || sk?.split("#")[2],
        conversationId: item.conversationId || item.pk?.replace("CONV#", ""),
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        editedAt: editedAt ? new Date(editedAt) : null,
        deletedAt: deletedAt ? new Date(deletedAt) : null,
        pinnedAt: pinnedAt ? new Date(pinnedAt) : null,
      } as Message;
    });
  }

  async batchInsert(messages: Message[]): Promise<boolean> {
    return await this._cmdRepo.batchInsert(messages);
  }

  async searchMessages(
    conversationId: string,
    userId: string,
    query: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<{
    messages: Message[];
    nextCursor?: string;
    hasMore: boolean;
    total: number;
  }> {
    const q = new DynamoMessageQueryRepository();
    const lowerQuery = query.toLowerCase();

    const allMessages: Message[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    const maxFetch = 1000;

    do {
      const result = await q.listByConversation(conversationId, maxFetch, lastEvaluatedKey
        ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64")
        : undefined);
      allMessages.push(...result.messages);
      lastEvaluatedKey = result.nextCursor
        ? JSON.parse(Buffer.from(result.nextCursor, "base64").toString("utf-8"))
        : undefined;
    } while (lastEvaluatedKey && allMessages.length < maxFetch);

    const filteredMessages = allMessages.filter((msg) => {
      if (msg.deletedAt) return false;
      if (msg.deletedForUserIds?.includes(userId)) return false;
      if (msg.text && msg.text.toLowerCase().includes(lowerQuery)) return true;
      return false;
    });

    const sortedMessages = filteredMessages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    let startIndex = 0;
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, "base64").toString("utf-8");
        const cursorTime = new Date(decoded).getTime();
        const idx = sortedMessages.findIndex((m) => m.createdAt.getTime() === cursorTime);
        startIndex = idx >= 0 ? idx + 1 : 0;
      } catch {
        startIndex = 0;
      }
    }

    const pageMessages = sortedMessages.slice(startIndex, startIndex + limit + 1);
    const hasMore = pageMessages.length > limit;
    const results = hasMore ? pageMessages.slice(0, limit) : pageMessages;

    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastMsg = results[results.length - 1];
      nextCursor = Buffer.from(lastMsg.createdAt.toISOString()).toString("base64");
    }

    return {
      messages: results,
      nextCursor,
      hasMore,
      total: filteredMessages.length,
    };
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    return this._cmdRepo.deleteByConversationId(conversationId);
  }
}
