import {
  ConversationMember,
} from "../../../model";
import {
  ConversationMemberCondDTO,
  ConversationMemberUpdateDTO,
} from "../../../model/dto";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import {
  BatchWriteCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

class DynamoConversationMemberQueryRepository extends BaseQueryRepositoryDynamoDB<
  ConversationMember,
  ConversationMemberCondDTO,
  typeof TABLE_NAMES.CONVERSATION_MEMBERS
> {
  constructor() {
    super(TABLE_NAMES.CONVERSATION_MEMBERS, { joinedAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): ConversationMember {
    const {
      pk,
      sk,
      joinedAt,
      leftAt,
      lastReadAt,
      lastSeenAt,
      lastDeliveredAt,
      lastActivityAt,
      muteUntil,
      updatedAt,
      pinnedAt,
      ...rest
    } = doc;
    return {
      ...rest,
      id: doc.id || sk?.replace("MEM#", ""),
      conversationId: doc.conversationId || doc.pk?.replace("CONV#", ""),
      joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
      leftAt: leftAt ? new Date(leftAt) : undefined,
      lastReadAt: lastReadAt ? new Date(lastReadAt) : null,
      lastSeenAt: lastSeenAt ? new Date(lastSeenAt) : undefined,
      lastDeliveredAt: lastDeliveredAt ? new Date(lastDeliveredAt) : undefined,
      lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : undefined,
      muteUntil: muteUntil ? new Date(muteUntil) : null,
      updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
      pinnedAt: pinnedAt ? new Date(pinnedAt) : null,
      hiddenUserIds: doc.hiddenUserIds || [],
    } as ConversationMember;
  }

  async findByCond(cond: ConversationMemberCondDTO): Promise<ConversationMember | null> {
    if (cond.conversationId && cond.userId) {
      return await this.findByConversationAndUser(cond.conversationId, cond.userId);
    }
    if (cond.conversationId) {
      const members = await this.listByConversationId(cond.conversationId);
      return members[0] || null;
    }
    return null;
  }

  async get(id: string): Promise<ConversationMember | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
        IndexName: "id-index",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: { ":id": id },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async findByConversationAndUser(conversationId: string, userId: string): Promise<ConversationMember | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
        KeyConditionExpression: "pk = :pk AND sk = :sk",
        ExpressionAttributeValues: {
          ":pk": `CONV#${conversationId}`,
          ":sk": `MEM#${userId}`,
        },
      }),
    );
    if (!result.Items || result.Items.length === 0) return null;
    return this.toEntity(result.Items[0]);
  }

  async list(cond: ConversationMemberCondDTO, paging: { page: number; limit: number }): Promise<ConversationMember[]> {
    if (cond.userId) {
      return await this.listByUserId(cond.userId, paging.page, paging.limit);
    }
    if (cond.conversationId) {
      return await this.listByConversationId(cond.conversationId);
    }
    return super.list(cond, paging);
  }

  private async listByUserId(userId: string, page: number, limit: number): Promise<ConversationMember[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
        Limit: limit,
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async listByConversationId(conversationId: string): Promise<ConversationMember[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `CONV#${conversationId}`,
          ":skPrefix": "MEM#",
        },
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async listByUserIdCursor(
    userId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<{
    pinnedMembers: ConversationMember[];
    normalMembers: ConversationMember[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    const docClient = getDocClient();

    // DynamoDB in-memory cursor pagination: fetch 1000 items, sort/filter in JS
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :userId",
        FilterExpression: "attribute_not_exists(#leftAt) OR #leftAt = :nullVal",
        ExpressionAttributeNames: { "#leftAt": "leftAt" },
        ExpressionAttributeValues: {
          ":userId": userId,
          ":nullVal": null,
        },
        Limit: 30,
      }),
    );

    const allMembers = (result.Items || []).map((item) => this.toEntity(item));

    const pinnedMembers = allMembers
      .filter((m) => m.pinned)
      .sort((a, b) => {
        const aTime = a.pinnedAt?.getTime() ?? 0;
        const bTime = b.pinnedAt?.getTime() ?? 0;
        return bTime - aTime;
      });

    // Sort by updatedAt DESC, tie-break by conversationId ASC
    // UUID v7 ensures lexical compare == chronological order
    const normalMembersRaw = allMembers
      .filter((m) => !m.pinned)
      .sort((a, b) => {
        const updatedA = (a.lastActivityAt || a.updatedAt || a.joinedAt)?.getTime() ?? 0;
        const updatedB = (b.lastActivityAt || b.updatedAt || b.joinedAt)?.getTime() ?? 0;
        if (updatedA !== updatedB) return updatedB - updatedA;
        return a.conversationId.localeCompare(b.conversationId);
      });

    let normalMembers: ConversationMember[];
    let nextCursor: string | undefined;
    let hasMore: boolean;

    if (cursor) {
      // cursor = conversationId (UUID v7) of the last item from previous page
      const filtered = normalMembersRaw.filter((m) => m.conversationId > cursor!);
      normalMembers = filtered.slice(0, limit + 1);
      hasMore = filtered.length > limit;
      if (hasMore) {
        normalMembers = normalMembers.slice(0, limit);
      }
    } else {
      normalMembers = normalMembersRaw.slice(0, limit + 1);
      hasMore = normalMembersRaw.length > limit;
      if (hasMore) {
        normalMembers = normalMembers.slice(0, limit);
      }
    }

    if (hasMore && normalMembers.length > 0) {
      const last = normalMembers[normalMembers.length - 1];
      nextCursor = last.conversationId;
    }

    return {
      pinnedMembers,
      normalMembers,
      nextCursor,
      hasMore,
    };
  }
}

class DynamoConversationMemberCommandRepository extends BaseCommandRepositoryDynamoDB<
  ConversationMember,
  ConversationMemberUpdateDTO,
  typeof TABLE_NAMES.CONVERSATION_MEMBERS
> {
  constructor() {
    super(TABLE_NAMES.CONVERSATION_MEMBERS, true);
  }

  async update(id: string, data: ConversationMemberUpdateDTO): Promise<boolean> {
    const member = await this.getByIdQuery(id);
    if (!member) return false;

    const updateData = this.beforeUpdate(id, data);
    if (Object.keys(updateData).length === 0) return true;

    const docClient = getDocClient();

    if (updateData.leftAt === null) {
      const updateExprParts: string[] = [];
      const exprAttrNames: Record<string, string> = {};
      const exprAttrValues: Record<string, any> = {};
      let idx = 0;

      for (const [key, value] of Object.entries(updateData)) {
        if (key === 'leftAt') continue;
        const nameKey = `#attr${idx}`;
        const valueKey = `:val${idx}`;
        updateExprParts.push(`${nameKey} = ${valueKey}`);
        exprAttrNames[nameKey] = key;
        exprAttrValues[valueKey] = value;
        idx++;
      }

      if (updateExprParts.length > 0) {
        await docClient.send(
          new UpdateCommand({
            TableName: this.getTableName(),
            Key: { pk: member.pk, sk: member.sk },
            UpdateExpression: `REMOVE leftAt SET ${updateExprParts.join(", ")}`,
            ExpressionAttributeNames: exprAttrNames,
            ExpressionAttributeValues: exprAttrValues,
          }),
        );
      } else {
        await docClient.send(
          new UpdateCommand({
            TableName: this.getTableName(),
            Key: { pk: member.pk, sk: member.sk },
            UpdateExpression: "REMOVE leftAt",
            ExpressionAttributeNames: exprAttrNames,
            ExpressionAttributeValues: exprAttrValues,
          }),
        );
      }
    } else {
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
          TableName: this.getTableName(),
          Key: { pk: member.pk, sk: member.sk },
          UpdateExpression: `SET ${updateExpressions.join(", ")}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );
    }
    return true;
  }

  private async getByIdQuery(id: string): Promise<Record<string, any> | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.getTableName(),
        IndexName: "id-index",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: { ":id": id },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  }

  async incrementUnreadCountForConversation(
    conversationId: string,
    excludeUserId?: string,
  ): Promise<void> {
    const docClient = getDocClient();
    const tableName = getTableName(TABLE_NAMES.CONVERSATION_MEMBERS);

    const members: Record<string, any>[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": `CONV#${conversationId}`,
            ":skPrefix": "MEM#",
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );
      if (result.Items) {
        members.push(...result.Items.filter((item) => !item.leftAt));
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const targets = excludeUserId
      ? members.filter((m) => m.userId !== excludeUserId)
      : members;

    const now = new Date().toISOString();
    const chunks = this.chunkArray(targets, 25);
    for (const chunk of chunks) {
      const writeRequests = chunk.map((member) => ({
        PutRequest: {
          Item: {
            ...member,
            unreadCount: (member.unreadCount || 0) + 1,
            lastActivityAt: now,
            updatedAt: now,
          },
        },
      }));
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: { [tableName]: writeRequests },
        }),
      );
    }

    const senderTargets = excludeUserId
      ? members.filter((m) => m.userId === excludeUserId)
      : [];
    if (senderTargets.length > 0) {
      const senderChunks = this.chunkArray(senderTargets, 25);
      for (const chunk of senderChunks) {
        const writeRequests = chunk.map((member) => ({
          PutRequest: {
            Item: {
              ...member,
              lastActivityAt: now,
              updatedAt: now,
            },
          },
        }));
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: { [tableName]: writeRequests },
          }),
        );
      }
    }
  }

  async touchActivityForConversation(
    conversationId: string,
    activityAt?: Date,
  ): Promise<void> {
    const docClient = getDocClient();
    const tableName = getTableName(TABLE_NAMES.CONVERSATION_MEMBERS);
    const activity = (activityAt || new Date()).toISOString();

    const members: Record<string, any>[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": `CONV#${conversationId}`,
            ":skPrefix": "MEM#",
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );
      if (result.Items) {
        members.push(...result.Items.filter((item) => !item.leftAt));
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const chunks = this.chunkArray(members, 25);
    for (const chunk of chunks) {
      const writeRequests = chunk.map((member) => ({
        PutRequest: {
          Item: {
            ...member,
            lastActivityAt: activity,
            updatedAt: activity,
          },
        },
      }));
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: { [tableName]: writeRequests },
        }),
      );
    }
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    const docClient = getDocClient();
    const tableName = getTableName(TABLE_NAMES.CONVERSATION_MEMBERS);

    let lastEvaluatedKey: Record<string, any> | undefined;
    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": `CONV#${conversationId}`,
            ":skPrefix": "MEM#",
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

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  protected beforeInsert(data: ConversationMember): Record<string, any> {
    const now = new Date().toISOString();
    return {
      pk: `CONV#${data.conversationId}`,
      sk: `MEM#${data.userId}`,
      id: data.id,
      conversationId: data.conversationId,
      userId: data.userId,
      role: data.role,
      status: data.status,
      joinedAt: data.joinedAt ? data.joinedAt.toISOString() : now,
      leftAt: data.leftAt ? data.leftAt.toISOString() : null,
      unreadCount: data.unreadCount || 0,
      lastReadMessageId: data.lastReadMessageId,
      lastReadAt: data.lastReadAt ? data.lastReadAt.toISOString() : null,
      lastSeenMessageId: data.lastSeenMessageId,
      lastDeliveredMessageId: data.lastDeliveredMessageId,
      lastSeenAt: data.lastSeenAt ? data.lastSeenAt.toISOString() : null,
      lastDeliveredAt: data.lastDeliveredAt ? data.lastDeliveredAt.toISOString() : null,
      lastActivityAt: data.lastActivityAt ? data.lastActivityAt.toISOString() : data.updatedAt?.toISOString?.() || now,
      muteUntil: data.muteUntil ? data.muteUntil.toISOString() : null,
      pinned: data.pinned || false,
      pinnedAt: data.pinnedAt ? data.pinnedAt.toISOString() : null,
      archived: data.archived || false,
      hiddenUserIds: data.hiddenUserIds || [],
      updatedAt: now,
    };
  }

  protected beforeUpdate(id: string, data: ConversationMemberUpdateDTO): Record<string, any> {
    const now = new Date().toISOString();
    const updateData: Record<string, any> = { updatedAt: now };
    if (data.role !== undefined) updateData.role = data.role;
    if (data.status !== undefined) updateData.status = data.status;
    if ((data as any).joinedAt !== undefined && (data as any).joinedAt !== null) {
      updateData.joinedAt = ((data as any).joinedAt as Date).toISOString();
    }
    if (data.leftAt !== undefined) {
      updateData.leftAt = data.leftAt ? (data.leftAt as Date).toISOString() : null;
    }
    if (data.unreadCount !== undefined) updateData.unreadCount = data.unreadCount;
    if (data.lastReadMessageId !== undefined) updateData.lastReadMessageId = data.lastReadMessageId;
    if (data.lastSeenMessageId !== undefined) updateData.lastSeenMessageId = data.lastSeenMessageId;
    if (data.lastDeliveredMessageId !== undefined) updateData.lastDeliveredMessageId = data.lastDeliveredMessageId;
    if (data.lastReadAt !== undefined && data.lastReadAt !== null) updateData.lastReadAt = (data.lastReadAt as Date).toISOString();
    if (data.lastSeenAt !== undefined && data.lastSeenAt !== null) updateData.lastSeenAt = (data.lastSeenAt as Date).toISOString();
    if (data.lastDeliveredAt !== undefined && data.lastDeliveredAt !== null) updateData.lastDeliveredAt = (data.lastDeliveredAt as Date).toISOString();
    if (data.lastActivityAt !== undefined && data.lastActivityAt !== null) updateData.lastActivityAt = (data.lastActivityAt as Date).toISOString();
    if (data.muteUntil !== undefined && data.muteUntil !== null) updateData.muteUntil = (data.muteUntil as Date).toISOString();
    if (data.pinned !== undefined) updateData.pinned = data.pinned;
    if (data.pinnedAt !== undefined) updateData.pinnedAt = data.pinnedAt ? (data.pinnedAt as Date).toISOString() : null;
    if (data.archived !== undefined) updateData.archived = data.archived;
    if (data.hiddenUserIds !== undefined) updateData.hiddenUserIds = data.hiddenUserIds;
    return updateData;
  }
}

export class DynamoConversationMemberRepository extends BaseRepositoryDynamoDB<
  ConversationMember,
  ConversationMemberCondDTO,
  ConversationMemberUpdateDTO,
  typeof TABLE_NAMES.CONVERSATION_MEMBERS
> {
  constructor() {
    super(new DynamoConversationMemberQueryRepository(), new DynamoConversationMemberCommandRepository());
  }

  async listByConversationId(conversationId: string): Promise<ConversationMember[]> {
    return (this.queryRepo as DynamoConversationMemberQueryRepository).listByConversationId(conversationId);
  }

  async findActiveByUserId(userId: string): Promise<ConversationMember[]> {
    const result = await (this.queryRepo as DynamoConversationMemberQueryRepository).listByUserIdCursor(userId, undefined, 1000);
    return [...result.pinnedMembers, ...result.normalMembers];
  }

  async incrementUnreadCountForConversation(
    conversationId: string,
    excludeUserId?: string,
  ): Promise<void> {
    return (this.cmdRepo as DynamoConversationMemberCommandRepository)
      .incrementUnreadCountForConversation(conversationId, excludeUserId);
  }

  async touchActivityForConversation(
    conversationId: string,
    activityAt?: Date,
  ): Promise<void> {
    return (this.cmdRepo as DynamoConversationMemberCommandRepository)
      .touchActivityForConversation(conversationId, activityAt);
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    return (this.cmdRepo as DynamoConversationMemberCommandRepository)
      .deleteByConversationId(conversationId);
  }
}
