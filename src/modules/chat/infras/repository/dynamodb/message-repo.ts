import { Message, MessageStatus } from "../../../model";
import { MessageCondDTO, MessageUpdateDTO } from "../../../model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import {
  QueryCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  PutCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

function idempotencyPk(conversationId: string, senderId: string): string {
  return `IDEMP#${conversationId}#${senderId}`;
}

function idempotencySk(clientMessageId: string): string {
  return `CLIENT#${clientMessageId}`;
}

function clientMessageKey(conversationId: string, senderId: string, clientMessageId: string): string {
  return `${conversationId}#${senderId}#${clientMessageId}`;
}

class DynamoMessageQueryRepository extends BaseQueryRepositoryDynamoDB<
  Message,
  MessageCondDTO,
  typeof TABLE_NAMES.MESSAGES
> {
  constructor() {
    super(TABLE_NAMES.MESSAGES, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): Message {
    const { pk, sk, GSI1PK, GSI1SK, createdAt, editedAt, deletedAt, revokedAt, pinnedAt, expiresAt, ...rest } = doc;
    const status = rest.messageStatus || (deletedAt ? MessageStatus.REVOKED : MessageStatus.ACTIVE);
    return {
      ...rest,
      id: doc.id || sk?.split("#")[2],
      conversationId: doc.conversationId || doc.pk?.replace("CONV#", ""),
      call: this.toCallEntity(doc.call),
      messageStatus: status,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
      editedAt: editedAt ? new Date(editedAt) : null,
      deletedAt: deletedAt ? new Date(deletedAt) : null,
      revokedAt: revokedAt ? new Date(revokedAt) : undefined,
      pinnedAt: pinnedAt ? new Date(pinnedAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    } as Message;
  }

  private toCallEntity(call: Record<string, any> | undefined) {
    if (!call) return undefined;
    const participantOutcomes = call.participantOutcomes
      ? Object.fromEntries(
          Object.entries(call.participantOutcomes).map(([userId, outcome]: [string, any]) => [
            userId,
            {
              ...outcome,
              joinedAt: outcome.joinedAt ? new Date(outcome.joinedAt) : undefined,
              leftAt: outcome.leftAt ? new Date(outcome.leftAt) : undefined,
              endedAt: outcome.endedAt ? new Date(outcome.endedAt) : undefined,
            },
          ]),
        )
      : undefined;

    return {
      ...call,
      participantOutcomes,
      answeredAt: call.answeredAt ? new Date(call.answeredAt) : undefined,
      endedAt: call.endedAt ? new Date(call.endedAt) : new Date(),
    };
  }

  async listByConversation(
    conversationId: string,
    limit: number,
    cursor?: string,
    viewerUserId?: string,
  ): Promise<{ messages: Message[]; nextCursor?: string }> {
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

    const expressionAttributeValues: Record<string, any> = {
      ":pk": `CONV#${conversationId}`,
      ":skPrefix": "MSG#",
      ":nowEpoch": Math.floor(Date.now() / 1000),
    };
    const filterParts = [
      "(attribute_not_exists(expireAtEpoch) OR expireAtEpoch > :nowEpoch)",
    ];
    if (viewerUserId) {
      expressionAttributeValues[":viewerUserId"] = viewerUserId;
      filterParts.push("(attribute_not_exists(deletedForUserIds) OR NOT contains(deletedForUserIds, :viewerUserId))");
    }
    const filterExpression = filterParts.join(" AND ");

    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: expressionAttributeValues,
        FilterExpression: filterExpression,
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

  async findByClientMessageId(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
  ): Promise<Message[]> {
    const result = await getDocClient().send(
      new GetCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        Key: {
          pk: idempotencyPk(conversationId, senderId),
          sk: idempotencySk(clientMessageId),
        },
      }),
    );

    const messageIds = Array.isArray(result.Item?.messageIds)
      ? (result.Item?.messageIds as string[])
      : [];
    if (messageIds.length === 0) {
      return this.findByClientMessageKey(conversationId, senderId, clientMessageId);
    }

    const messages = await Promise.all(messageIds.map((messageId) => this.getById(messageId)));
    return messages
      .filter((message): message is Message => !!message)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  private async findByClientMessageKey(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
  ): Promise<Message[]> {
    const result = await getDocClient().send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        IndexName: "clientMessageKey-index",
        KeyConditionExpression: "clientMessageKey = :clientMessageKey",
        ExpressionAttributeValues: {
          ":clientMessageKey": clientMessageKey(conversationId, senderId, clientMessageId),
        },
        ScanIndexForward: true,
      }),
    );

    return (result.Items || [])
      .filter((item) => String(item.sk || "").startsWith("MSG#"))
      .map((item) => this.toEntity(item))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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
      clientMessageId: data.clientMessageId,
      clientMessageKey: data.clientMessageId
        ? clientMessageKey(data.conversationId, data.senderId, data.clientMessageId)
        : undefined,
      type: data.type,
      text: data.text,
      media: data.media,
      links: data.links || [],
      call: data.call ? this.toCallDocument(data.call) : undefined,
      profileCardUserId: (data as any).profileCardUserId,
      messageStatus: data.messageStatus || MessageStatus.ACTIVE,
      deletedBy: data.deletedBy,
      revokedAt: data.revokedAt ? data.revokedAt.toISOString() : null,
      deletedForUserIds: data.deletedForUserIds || [],
      quotedMessageId: data.quotedMessageId,
      quotedMessagePreview: data.quotedMessagePreview,
      forwardedFrom: data.forwardedFrom,
      forwardedFromMessageId: data.forwardedFromMessageId,
      createdAt: createdAt,
      editedAt: data.editedAt ? data.editedAt.toISOString() : null,
      deletedAt: data.deletedAt ? data.deletedAt.toISOString() : null,
      expiresAt: data.expiresAt ? data.expiresAt.toISOString() : null,
      expireAtEpoch: data.expireAtEpoch,
      pinned: data.pinned || false,
      pinnedAt: data.pinnedAt ? data.pinnedAt.toISOString() : null,
      GSI1PK: `SENDER#${data.senderId}`,
      GSI1SK: createdAt,
    };
  }

  private toCallDocument(call: NonNullable<Message["call"]>): Record<string, any> {
    const participantOutcomes = call.participantOutcomes
      ? Object.fromEntries(
          Object.entries(call.participantOutcomes).map(([userId, outcome]) => [
            userId,
            {
              ...outcome,
              joinedAt: this.toIsoString(outcome.joinedAt),
              leftAt: this.toIsoString(outcome.leftAt),
              endedAt: this.toIsoString(outcome.endedAt),
            },
          ]),
        )
      : undefined;

    return {
      ...call,
      participantOutcomes,
      answeredAt: this.toIsoString(call.answeredAt),
      endedAt: this.toIsoString(call.endedAt),
    };
  }

  private toIsoString(value?: Date | string | number): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "number") return new Date(value).toISOString();
    return value;
  }

  protected beforeUpdate(id: string, data: MessageUpdateDTO): Record<string, any> {
    const updateData: Record<string, any> = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.clientMessageId !== undefined) updateData.clientMessageId = data.clientMessageId;
    if (data.text !== undefined) updateData.text = data.text;
    if (data.media !== undefined) updateData.media = data.media;
    if (data.links !== undefined) updateData.links = data.links;
    if (data.call !== undefined) updateData.call = this.toCallDocument(data.call);
    if ((data as any).profileCardUserId !== undefined) updateData.profileCardUserId = (data as any).profileCardUserId;
    if (data.messageStatus !== undefined) updateData.messageStatus = data.messageStatus;
    if (data.deletedBy !== undefined) updateData.deletedBy = data.deletedBy;
    if (data.revokedAt !== undefined && data.revokedAt !== null) updateData.revokedAt = (data.revokedAt as Date).toISOString();
    if (data.editedAt !== undefined && data.editedAt !== null) updateData.editedAt = (data.editedAt as Date).toISOString();
    if (data.deletedAt !== undefined && data.deletedAt !== null) updateData.deletedAt = (data.deletedAt as Date).toISOString();
    if (data.deletedForUserIds !== undefined) updateData.deletedForUserIds = data.deletedForUserIds;
    if ((data as any).quotedMessageId !== undefined) updateData.quotedMessageId = (data as any).quotedMessageId;
    if ((data as any).quotedMessagePreview !== undefined) updateData.quotedMessagePreview = (data as any).quotedMessagePreview;
    if ((data as any).forwardedFrom !== undefined) updateData.forwardedFrom = (data as any).forwardedFrom;
    if ((data as any).forwardedFromMessageId !== undefined) updateData.forwardedFromMessageId = (data as any).forwardedFromMessageId;
    if ((data as any).expiresAt !== undefined && (data as any).expiresAt !== null) updateData.expiresAt = ((data as any).expiresAt as Date).toISOString();
    if ((data as any).expireAtEpoch !== undefined) updateData.expireAtEpoch = (data as any).expireAtEpoch;
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

  async reserveClientMessage(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
  ): Promise<boolean> {
    const now = new Date();
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.getTableName(),
          Item: {
            pk: idempotencyPk(conversationId, senderId),
            sk: idempotencySk(clientMessageId),
            conversationId,
            senderId,
            clientMessageId,
            status: "pending",
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            expireAtEpoch: Math.floor(now.getTime() / 1000) + 86400,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
      return true;
    } catch (error) {
      if ((error as any)?.name === "ConditionalCheckFailedException") {
        return false;
      }
      throw error;
    }
  }

  async completeClientMessage(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
    messageIds: string[],
  ): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.getTableName(),
        Key: {
          pk: idempotencyPk(conversationId, senderId),
          sk: idempotencySk(clientMessageId),
        },
        UpdateExpression: "SET #status = :status, #messageIds = :messageIds, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
          "#messageIds": "messageIds",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":status": "completed",
          ":messageIds": messageIds,
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(pk)",
      }),
    );
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
  private readonly _queryRepo: DynamoMessageQueryRepository;

  constructor() {
    const q = new DynamoMessageQueryRepository();
    const c = new DynamoMessageCommandRepository();
    super(q, c);
    this._queryRepo = q;
    this._cmdRepo = c;
  }

  async listWithCursor(
    conversationId: string,
    cursor: string | undefined,
    limit: number,
    viewerUserId?: string,
  ): Promise<Message[]> {
    const q = new DynamoMessageQueryRepository();
    const result = await q.listByConversation(conversationId, limit, cursor, viewerUserId);
    return result.messages;
  }

  async findPinnedMessages(conversationId: string): Promise<Message[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        FilterExpression: "pinned = :pinned AND (attribute_not_exists(messageStatus) OR messageStatus = :active) AND (attribute_not_exists(deletedAt) OR deletedAt = :nullVal) AND (attribute_not_exists(expireAtEpoch) OR expireAtEpoch > :nowEpoch)",
        ExpressionAttributeValues: {
          ":pk": `CONV#${conversationId}`,
          ":skPrefix": "MSG#",
          ":pinned": true,
          ":active": MessageStatus.ACTIVE,
          ":nullVal": null,
          ":nowEpoch": Math.floor(Date.now() / 1000),
        },
        ScanIndexForward: true,
      }),
    );
    return (result.Items || []).map((item) => {
      const { pk, sk, GSI1PK, GSI1SK, createdAt, editedAt, deletedAt, revokedAt, pinnedAt, expiresAt, ...rest } = item;
      return {
        ...rest,
        id: item.id || sk?.split("#")[2],
        conversationId: item.conversationId || item.pk?.replace("CONV#", ""),
        messageStatus: rest.messageStatus || (deletedAt ? MessageStatus.REVOKED : MessageStatus.ACTIVE),
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        editedAt: editedAt ? new Date(editedAt) : null,
        deletedAt: deletedAt ? new Date(deletedAt) : null,
        revokedAt: revokedAt ? new Date(revokedAt) : undefined,
        pinnedAt: pinnedAt ? new Date(pinnedAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      } as Message;
    });
  }

  async batchInsert(messages: Message[]): Promise<boolean> {
    return await this._cmdRepo.batchInsert(messages);
  }

  async findByClientMessageId(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
  ): Promise<Message[]> {
    return this._queryRepo.findByClientMessageId(conversationId, senderId, clientMessageId);
  }

  async reserveClientMessage(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
  ): Promise<boolean> {
    return this._cmdRepo.reserveClientMessage(conversationId, senderId, clientMessageId);
  }

  async completeClientMessage(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
    messageIds: string[],
  ): Promise<void> {
    return this._cmdRepo.completeClientMessage(conversationId, senderId, clientMessageId, messageIds);
  }

  async searchMessages(
    conversationId: string,
    userId: string,
    query: string,
    cursor?: string,
    limit: number = 20,
    options: { from?: Date; to?: Date; hiddenAfter?: Date } = {},
  ): Promise<{
    messages: Message[];
    nextCursor?: string;
    hasMore: boolean;
    total: number;
  }> {
    const docClient = getDocClient();
    const tableName = getTableName(TABLE_NAMES.MESSAGES);
    const lowerQuery = query.toLowerCase().trim();

    const allMessages: Message[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined = cursor
      ? await this.resolveCursorKey(cursor)
      : undefined;
    let totalScanned = 0;
    const maxScan = 2000;
    const pageLimit = Math.max(100, limit * 4);

    while (totalScanned < maxScan) {
      const result: { Items?: Record<string, unknown>[]; LastEvaluatedKey?: Record<string, unknown> } = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
          FilterExpression:
            "(attribute_not_exists(messageStatus) OR messageStatus = :active) AND (attribute_not_exists(deletedAt) OR deletedAt = :nullVal) AND (attribute_not_exists(deletedForUserIds) OR NOT contains(deletedForUserIds, :userId)) AND (attribute_not_exists(expireAtEpoch) OR expireAtEpoch > :nowEpoch)",
          ExpressionAttributeValues: {
            ":pk": `CONV#${conversationId}`,
            ":skPrefix": "MSG#",
            ":userId": userId,
            ":active": MessageStatus.ACTIVE,
            ":nullVal": null,
            ":nowEpoch": Math.floor(Date.now() / 1000),
          },
          Limit: pageLimit,
          ScanIndexForward: false,
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      const items: Record<string, unknown>[] = result.Items || [];
      const mapped: Message[] = items.map((item: Record<string, unknown>) => {
        const { pk, sk, GSI1PK, GSI1SK, createdAt, editedAt, deletedAt, revokedAt, pinnedAt, expiresAt, ...rest } = item;
        return {
          ...rest,
          id: item.id as string || (sk as string)?.split("#")[2],
          conversationId: item.conversationId as string || (pk as string)?.replace("CONV#", ""),
          messageStatus: (rest as any).messageStatus || (deletedAt ? MessageStatus.REVOKED : MessageStatus.ACTIVE),
          createdAt: createdAt ? new Date(createdAt as string) : new Date(),
          editedAt: editedAt ? new Date(editedAt as string) : null,
          deletedAt: deletedAt ? new Date(deletedAt as string) : null,
          revokedAt: revokedAt ? new Date(revokedAt as string) : undefined,
          pinnedAt: pinnedAt ? new Date(pinnedAt as string) : null,
          expiresAt: expiresAt ? new Date(expiresAt as string) : undefined,
        } as Message;
      }).filter((message) => this.matchesSearch(message, lowerQuery, options, userId));
      allMessages.push(...mapped);
      totalScanned += items.length;
      lastEvaluatedKey = result.LastEvaluatedKey;

      if (!result.LastEvaluatedKey) break;
      if (allMessages.length >= limit + 1) break;
    }

    const sortedMessages = allMessages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const pageMessages = sortedMessages.slice(0, limit + 1);
    const hasMore = pageMessages.length > limit;
    const results = hasMore ? pageMessages.slice(0, limit) : pageMessages;

    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastMsg = results[results.length - 1];
      nextCursor = lastMsg.id;
    }

    return {
      messages: results,
      nextCursor,
      hasMore,
      total: sortedMessages.length,
    };
  }

  private async resolveCursorKey(cursor: string): Promise<Record<string, unknown> | undefined> {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
      if (decoded && typeof decoded === "object") return decoded;
    } catch {
      // Cursor can be a message ID.
    }

    const result = await getDocClient().send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        IndexName: "id-index",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: { ":id": cursor },
        Limit: 1,
      }),
    );

    const item = result.Items?.[0];
    return item ? { pk: item.pk, sk: item.sk } : undefined;
  }

  private matchesSearch(
    message: Message,
    lowerQuery: string,
    options: { from?: Date; to?: Date; hiddenAfter?: Date },
    userId: string,
  ): boolean {
    if (message.messageStatus === MessageStatus.REVOKED || message.deletedAt) return false;
    if (message.deletedForUserIds?.includes(userId)) return false;
    if (message.expireAtEpoch && message.expireAtEpoch <= Math.floor(Date.now() / 1000)) return false;
    if (options.hiddenAfter && message.createdAt <= options.hiddenAfter) return false;
    if (options.from && message.createdAt < options.from) return false;
    if (options.to && message.createdAt > options.to) return false;
    return (message.text || "").toLowerCase().includes(lowerQuery);
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    return this._cmdRepo.deleteByConversationId(conversationId);
  }
}

