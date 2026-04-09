import {
  Message,
} from "../../../model";
import {
  MessageCondDTO,
  MessageUpdateDTO,
} from "../../../model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import {
  QueryCommand,
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
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    return {
      id: doc.id || sk?.split("#")[2],
      conversationId: doc.conversationId || doc.pk?.replace("CONV#", ""),
      ...rest,
    } as Message;
  }

  async listByConversation(conversationId: string, limit: number, cursor?: string): Promise<{ messages: Message[]; nextCursor?: string }> {
    const docClient = getDocClient();
    const exclusiveStartKey = cursor ? JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) : undefined;

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
}

class DynamoMessageCommandRepository extends BaseCommandRepositoryDynamoDB<
  Message,
  MessageUpdateDTO,
  typeof TABLE_NAMES.MESSAGES
> {
  constructor() {
    super(TABLE_NAMES.MESSAGES, false);
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
    if (data.editedAt !== undefined && data.editedAt !== null) updateData.editedAt = (data.editedAt as Date).toISOString();
    if (data.deletedAt !== undefined && data.deletedAt !== null) updateData.deletedAt = (data.deletedAt as Date).toISOString();
    if (data.deletedForUserIds !== undefined) updateData.deletedForUserIds = data.deletedForUserIds;
    if (data.pinned !== undefined) updateData.pinned = data.pinned;
    if (data.pinnedAt !== undefined && data.pinnedAt !== null) updateData.pinnedAt = (data.pinnedAt as Date).toISOString();
    return updateData;
  }

  async batchInsert(messages: Message[]): Promise<boolean> {
    if (messages.length === 0) return true;

    const docClient = getDocClient();
    const tableName = getTableName(TABLE_NAMES.MESSAGES);
    const BATCH_SIZE = 25;

    const chunks = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      chunks.push(messages.slice(i, i + BATCH_SIZE));
    }

    for (const chunk of chunks) {
      const putRequests = chunk.map((msg) => ({
        PutRequest: { Item: this.beforeInsert(msg) },
      }));

      await docClient.send(
        new (await import("@aws-sdk/client-dynamodb")).BatchWriteItemCommand({
          RequestItems: {
            [tableName]: putRequests,
          },
        }),
      );
    }

    return true;
  }
}

export class DynamoMessageRepository extends BaseRepositoryDynamoDB<
  Message,
  MessageCondDTO,
  MessageUpdateDTO,
  typeof TABLE_NAMES.MESSAGES
> {
  constructor() {
    super(new DynamoMessageQueryRepository(), new DynamoMessageCommandRepository());
  }

  async listWithCursor(
    conversationId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Message[]> {
    const queryRepo = new DynamoMessageQueryRepository();
    const result = await queryRepo.listByConversation(conversationId, limit, cursor);
    return result.messages;
  }

  async findPinnedMessages(conversationId: string): Promise<Message[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        FilterExpression: "pinned = :pinned",
        ExpressionAttributeValues: {
          ":pk": `CONV#${conversationId}`,
          ":skPrefix": "MSG#",
          ":pinned": true,
        },
      }),
    );
    return (result.Items || []).map((item) => this.convertMessage(item));
  }

  private convertMessage(doc: Record<string, any>): Message {
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    return {
      id: doc.id || sk?.split("#")[2],
      conversationId: doc.conversationId || doc.pk?.replace("CONV#", ""),
      ...rest,
    } as Message;
  }
}
