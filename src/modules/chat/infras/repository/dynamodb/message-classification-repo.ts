import { ClassificationType, MessageClassification } from "../../../model/model";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
import { BatchWriteCommand, DeleteCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

export class DynamoMessageClassificationRepository {
  private docClient = getDocClient();

  private toEntity(doc: Record<string, any>): MessageClassification {
    return {
      id: doc.id,
      conversationId: doc.conversationId,
      type: doc.type as ClassificationType,
      senderId: doc.senderId,
      url: doc.url,
      name: doc.name,
      linkUrl: doc.linkUrl,
      messageId: doc.messageId,
      createdAt: new Date(doc.createdAt),
    };
  }

  private toDbItem(c: MessageClassification): Record<string, any> {
    const createdAt = c.createdAt.toISOString();
    return {
      pk: `CONV#${c.conversationId}#${c.type}`,
      sk: `MSG#${createdAt}#${c.id}`,
      GSI1PK: `CONV#${c.conversationId}`,
      GSI1SK: `${c.type}#${createdAt}#${c.id}`,
      id: c.id,
      conversationId: c.conversationId,
      type: c.type,
      senderId: c.senderId,
      url: c.url,
      name: c.name,
      linkUrl: c.linkUrl,
      messageId: c.messageId,
      createdAt,
    };
  }

  async insertBatch(classifications: MessageClassification[]): Promise<void> {
    if (classifications.length === 0) return;

    const chunks = this.chunkArray(classifications, 25);
    for (const chunk of chunks) {
      const requestItems = chunk.map((c) => ({
        PutRequest: { Item: this.toDbItem(c) },
      }));

      await this.docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [getTableName(TABLE_NAMES.MESSAGE_CLASSIFICATIONS)]: requestItems,
          },
        }),
      );
    }
  }

  async listByConversationAndType(
    conversationId: string,
    type: ClassificationType,
    cursor?: string,
    limit: number = 20,
  ): Promise<{ items: MessageClassification[]; nextCursor: string; hasMore: boolean }> {
    const exclusiveStartKey = cursor
      ? JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"))
      : undefined;

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_CLASSIFICATIONS),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :typePrefix)",
        ExpressionAttributeValues: {
          ":gsi1pk": `CONV#${conversationId}`,
          ":typePrefix": `${type}#`,
        },
        Limit: limit,
        ScanIndexForward: false,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    const items = (result.Items || []).map((item) => this.toEntity(item));
    let nextCursor = "";
    const hasMore = !!result.LastEvaluatedKey;
    if (result.LastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
    }

    return { items, nextCursor, hasMore };
  }

  async listByConversation(
    conversationId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<{ items: MessageClassification[]; nextCursor: string; hasMore: boolean }> {
    const exclusiveStartKey = cursor
      ? JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"))
      : undefined;

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_CLASSIFICATIONS),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `CONV#${conversationId}`,
          ":type1": ClassificationType.IMAGE,
          ":type2": ClassificationType.FILE,
          ":type3": ClassificationType.LINK,
        },
        FilterExpression: "#t IN (:type1, :type2, :type3)",
        ExpressionAttributeNames: {
          "#t": "type",
        },
        Limit: limit,
        ScanIndexForward: false,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    const items = (result.Items || []).map((item) => this.toEntity(item));
    let nextCursor = "";
    const hasMore = !!result.LastEvaluatedKey;
    if (result.LastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
    }

    return { items, nextCursor, hasMore };
  }

  async deleteByMessageId(messageId: string): Promise<void> {
    let lastEvaluatedKey: Record<string, any> | undefined;
    do {
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: getTableName(TABLE_NAMES.MESSAGE_CLASSIFICATIONS),
          FilterExpression: "messageId = :messageId",
          ExpressionAttributeValues: {
            ":messageId": messageId,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      for (const item of result.Items || []) {
        await this.docClient.send(
          new DeleteCommand({
            TableName: getTableName(TABLE_NAMES.MESSAGE_CLASSIFICATIONS),
            Key: { pk: item.pk, sk: item.sk },
          }),
        );
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
