import {
  Conversation,
} from "../../../model";
import {
  ConversationCondDTO,
  ConversationUpdateDTO,
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

class DynamoConversationQueryRepository extends BaseQueryRepositoryDynamoDB<
  Conversation,
  ConversationCondDTO,
  typeof TABLE_NAMES.CONVERSATIONS
> {
  constructor() {
    super(TABLE_NAMES.CONVERSATIONS, { lastMessageAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): Conversation {
    const { pk, sk, GSI1PK, GSI1SK, createdAt, updatedAt, lastMessageAt, ...rest } = doc;
    return {
      ...rest,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
      updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
      lastMessageAt: lastMessageAt ? new Date(lastMessageAt) : null,
    } as Conversation;
  }

  protected buildFilterExpression(cond: ConversationCondDTO): string {
    const conditions: string[] = [];
    if (cond.type) conditions.push("#type = :type");
    if (cond.createdBy) conditions.push("createdBy = :createdBy");
    if (cond.pairKey) conditions.push("pairKey = :pairKey");
    return conditions.join(" AND ");
  }

  protected buildAttributeNames(cond: ConversationCondDTO): Record<string, string> {
    const names: Record<string, string> = {};
    if (cond.type) names["#type"] = "type";
    // pairKey doesn't need alias because it's not a reserved keyword, but just in case
    return names;
  }

  protected buildAttributeValues(cond: ConversationCondDTO): Record<string, any> {
    const values: Record<string, any> = {};
    if (cond.type) values[":type"] = cond.type;
    if (cond.createdBy) values[":createdBy"] = cond.createdBy;
    if (cond.pairKey) values[":pairKey"] = cond.pairKey;
    return values;
  }

  async findByPairKey(pairKey: string): Promise<Conversation | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.CONVERSATIONS),
        IndexName: "pairKey-index",
        KeyConditionExpression: "pairKey = :pairKey",
        ExpressionAttributeValues: { ":pairKey": pairKey },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }
}

class DynamoConversationCommandRepository extends BaseCommandRepositoryDynamoDB<
  Conversation,
  ConversationUpdateDTO,
  typeof TABLE_NAMES.CONVERSATIONS
> {
  constructor() {
    super(TABLE_NAMES.CONVERSATIONS, true);
  }

  protected beforeInsert(data: Conversation): Record<string, any> {
    const now = new Date().toISOString();
    return {
      id: data.id,
      type: data.type,
      pairKey: data.pairKey,
      name: data.name,
      avatarUrl: data.avatarUrl,
      createdBy: data.createdBy,
      ownerId: data.ownerId,
      admins: data.admins || [],
      membersCount: data.membersCount || 0,
      settings: data.settings,
      lastMessage: data.lastMessage,
      lastMessageAt: data.lastMessageAt ? data.lastMessageAt.toISOString() : null,
      createdAt: data.createdAt ? data.createdAt.toISOString() : now,
      updatedAt: now,
    };
  }

  protected beforeUpdate(id: string, data: ConversationUpdateDTO): Record<string, any> {
    const now = new Date().toISOString();
    const updateData: Record<string, any> = { updatedAt: now };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.admins !== undefined) updateData.admins = data.admins;
    if (data.membersCount !== undefined) updateData.membersCount = data.membersCount;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.lastMessage !== undefined && data.lastMessage !== null) {
      const lm = data.lastMessage as any;
      updateData.lastMessage = {
        ...lm,
        createdAt: lm.createdAt instanceof Date ? lm.createdAt.toISOString() : lm.createdAt,
      };
    }
    if (data.lastMessageAt !== undefined && data.lastMessageAt !== null) {
      updateData.lastMessageAt = (data.lastMessageAt as Date).toISOString();
    }
    return updateData;
  }
}

export class DynamoConversationRepository extends BaseRepositoryDynamoDB<
  Conversation,
  ConversationCondDTO,
  ConversationUpdateDTO,
  typeof TABLE_NAMES.CONVERSATIONS
> {
  constructor() {
    super(new DynamoConversationQueryRepository(), new DynamoConversationCommandRepository());
  }
}
