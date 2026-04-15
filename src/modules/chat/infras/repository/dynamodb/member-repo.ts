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
  GetCommand,
  QueryCommand,
  ScanCommand,
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
    const { pk, sk, joinedAt, leftAt, lastReadAt, muteUntil, updatedAt, pinnedAt, ...rest } = doc;
    return {
      ...rest,
      id: doc.id || sk?.replace("MEM#", ""),
      conversationId: doc.conversationId || doc.pk?.replace("CONV#", ""),
      joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
      leftAt: leftAt ? new Date(leftAt) : undefined,
      lastReadAt: lastReadAt ? new Date(lastReadAt) : undefined,
      muteUntil: muteUntil ? new Date(muteUntil) : undefined,
      updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
      pinnedAt: pinnedAt ? new Date(pinnedAt) : undefined,
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
      new ScanCommand({
        TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
        FilterExpression: "id = :id",
        ExpressionAttributeValues: { ":id": id },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async findByConversationAndUser(conversationId: string, userId: string): Promise<ConversationMember | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new GetCommand({
        TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
        Key: { pk: `CONV#${conversationId}`, sk: `MEM#${userId}` },
      }),
    );
    if (!result.Item) return null;
    return this.toEntity(result.Item);
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
        FilterExpression: "attribute_not_exists(#leftAt) OR #leftAt = :null",
        ExpressionAttributeNames: { "#leftAt": "leftAt" },
        ExpressionAttributeValues: {
          ":userId": userId,
          ":null": null,
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
        FilterExpression: "attribute_not_exists(#leftAt) OR #leftAt = :null",
        ExpressionAttributeNames: { "#leftAt": "leftAt" },
        ExpressionAttributeValues: {
          ":pk": `CONV#${conversationId}`,
          ":skPrefix": "MEM#",
          ":null": null,
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

    const scanFetchAll = async (): Promise<ConversationMember[]> => {
      const items: Record<string, any>[] = [];
      let lastEvaluatedKey: Record<string, any> | undefined;
      do {
        const result = await docClient.send(
          new ScanCommand({
            TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
            FilterExpression: "userId = :userId AND (attribute_not_exists(leftAt) OR #lt = :nullVal)",
            ExpressionAttributeNames: { "#lt": "leftAt" },
            ExpressionAttributeValues: {
              ":userId": userId,
              ":nullVal": null,
            },
            ExclusiveStartKey: lastEvaluatedKey,
          }),
        );
        items.push(...(result.Items || []));
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
      return items.map((item) => this.toEntity(item));
    };

    const allMembers = await scanFetchAll();

    const pinnedMembers = allMembers
      .filter((m) => m.pinned)
      .sort((a, b) => {
        const aTime = a.pinnedAt?.getTime() ?? 0;
        const bTime = b.pinnedAt?.getTime() ?? 0;
        return bTime - aTime;
      });

    const normalMembersRaw = allMembers
      .filter((m) => !m.pinned)
      .sort((a, b) => {
        const updatedA = a.updatedAt?.getTime() ?? 0;
        const updatedB = b.updatedAt?.getTime() ?? 0;
        if (updatedA !== updatedB) return updatedB - updatedA;
        return a.conversationId.localeCompare(b.conversationId);
      });

    let normalMembers: ConversationMember[];
    let nextCursor: string | undefined;
    let hasMore: boolean;

    if (cursor) {
      const [cursorTs, ...cursorIdParts] = cursor.split("#");
      const cursorId = cursorIdParts.join("#");
      const cursorTime = new Date(cursorTs).getTime();

      const filtered = normalMembersRaw.filter((m) => {
        const mTime = m.updatedAt?.getTime() ?? 0;
        if (mTime < cursorTime) return true;
        if (mTime === cursorTime && m.conversationId < cursorId) return true;
        return false;
      });

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
      nextCursor = `${last.updatedAt?.toISOString() ?? ""}#${last.conversationId}`;
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

  protected beforeInsert(data: ConversationMember): Record<string, any> {
    return {
      pk: `CONV#${data.conversationId}`,
      sk: `MEM#${data.userId}`,
      id: data.id,
      conversationId: data.conversationId,
      userId: data.userId,
      role: data.role,
      status: data.status,
      joinedAt: data.joinedAt ? data.joinedAt.toISOString() : new Date().toISOString(),
      leftAt: data.leftAt ? data.leftAt.toISOString() : null,
      unreadCount: data.unreadCount || 0,
      lastReadMessageId: data.lastReadMessageId,
      lastReadAt: data.lastReadAt ? data.lastReadAt.toISOString() : null,
      lastSeenMessageId: data.lastSeenMessageId,
      lastDeliveredMessageId: data.lastDeliveredMessageId,
      muteUntil: data.muteUntil ? data.muteUntil.toISOString() : null,
      pinned: data.pinned || false,
      pinnedAt: data.pinnedAt ? data.pinnedAt.toISOString() : null,
      archived: data.archived || false,
      updatedAt: new Date().toISOString(),
    };
  }

  protected beforeUpdate(id: string, data: ConversationMemberUpdateDTO): Record<string, any> {
    const now = new Date().toISOString();
    const updateData: Record<string, any> = { updatedAt: now };
    if (data.role !== undefined) updateData.role = data.role;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.leftAt !== undefined) {
      updateData.leftAt = data.leftAt ? (data.leftAt as Date).toISOString() : null;
    }
    if (data.unreadCount !== undefined) updateData.unreadCount = data.unreadCount;
    if (data.lastReadMessageId !== undefined) updateData.lastReadMessageId = data.lastReadMessageId;
    if (data.lastSeenMessageId !== undefined) updateData.lastSeenMessageId = data.lastSeenMessageId;
    if (data.lastDeliveredMessageId !== undefined) updateData.lastDeliveredMessageId = data.lastDeliveredMessageId;
    if (data.lastReadAt !== undefined && data.lastReadAt !== null) updateData.lastReadAt = (data.lastReadAt as Date).toISOString();
    if (data.muteUntil !== undefined && data.muteUntil !== null) updateData.muteUntil = (data.muteUntil as Date).toISOString();
    if (data.pinned !== undefined) updateData.pinned = data.pinned;
    if (data.pinnedAt !== undefined) updateData.pinnedAt = data.pinnedAt ? (data.pinnedAt as Date).toISOString() : null;
    if (data.archived !== undefined) updateData.archived = data.archived;
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
}
