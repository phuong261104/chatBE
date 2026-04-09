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
    const { pk, sk, ...rest } = doc;
    return {
      id: doc.id || sk?.replace("MEM#", ""),
      conversationId: doc.conversationId || doc.pk?.replace("CONV#", ""),
      joinedAt: doc.joinedAt ? new Date(doc.joinedAt) : new Date(),
      leftAt: doc.leftAt ? new Date(doc.leftAt) : null,
      lastReadAt: doc.lastReadAt ? new Date(doc.lastReadAt) : null,
      muteUntil: doc.muteUntil ? new Date(doc.muteUntil) : null,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      ...rest,
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
      new GetCommand({
        TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
        Key: { pk: `CONV#${conversationId}`, sk: `MEM#${userId}` },
      }),
    );
    return result.Item ? this.toEntity(result.Item) : null;
  }

  async list(cond: ConversationMemberCondDTO, paging: { page: number; limit: number }): Promise<ConversationMember[]> {
    if (cond.userId) {
      return await this.listByUserId(cond.userId, paging.page, paging.limit);
    }
    return super.list(cond, paging);
  }

  private async listByUserId(userId: string, page: number, limit: number): Promise<ConversationMember[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new ScanCommand({
        TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
        FilterExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
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

    const docClient = getDocClient();
    await docClient.send(
      new UpdateCommand({
        TableName: this.getTableName(),
        Key: { pk: member.pk, sk: member.sk },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );
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
      archived: data.archived || false,
      updatedAt: new Date().toISOString(),
    };
  }

  protected beforeUpdate(id: string, data: ConversationMemberUpdateDTO): Record<string, any> {
    const now = new Date().toISOString();
    const updateData: Record<string, any> = { updatedAt: now };
    if (data.role !== undefined) updateData.role = data.role;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.leftAt !== undefined && data.leftAt !== null) updateData.leftAt = (data.leftAt as Date).toISOString();
    if (data.unreadCount !== undefined) updateData.unreadCount = data.unreadCount;
    if (data.lastReadMessageId !== undefined) updateData.lastReadMessageId = data.lastReadMessageId;
    if (data.lastSeenMessageId !== undefined) updateData.lastSeenMessageId = data.lastSeenMessageId;
    if (data.lastDeliveredMessageId !== undefined) updateData.lastDeliveredMessageId = data.lastDeliveredMessageId;
    if (data.lastReadAt !== undefined && data.lastReadAt !== null) updateData.lastReadAt = (data.lastReadAt as Date).toISOString();
    if (data.muteUntil !== undefined && data.muteUntil !== null) updateData.muteUntil = (data.muteUntil as Date).toISOString();
    if (data.pinned !== undefined) updateData.pinned = data.pinned;
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
