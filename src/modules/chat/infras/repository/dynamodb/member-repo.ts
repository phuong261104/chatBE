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
      ...rest,
    } as ConversationMember;
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
