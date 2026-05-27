import {
  GroupInviteLink,
  GroupInviteLinkStatus,
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
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

class DynamoGroupInviteLinkQueryRepository extends BaseQueryRepositoryDynamoDB<
  GroupInviteLink,
  Record<string, unknown>,
  typeof TABLE_NAMES.GROUP_INVITE_LINKS
> {
  constructor() {
    super(TABLE_NAMES.GROUP_INVITE_LINKS, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): GroupInviteLink {
    return {
      token: doc.token,
      conversationId: doc.conversationId,
      status: doc.status as GroupInviteLinkStatus,
      createdBy: doc.createdBy,
      revokedBy: doc.revokedBy,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      revokedAt: doc.revokedAt ? new Date(doc.revokedAt) : undefined,
      expiresAt: doc.expiresAt ? new Date(doc.expiresAt) : undefined,
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

  async get(token: string): Promise<GroupInviteLink | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new GetCommand({
        TableName: getTableName(TABLE_NAMES.GROUP_INVITE_LINKS),
        Key: { token },
      }),
    );
    if (!result.Item) return null;
    return this.toEntity(result.Item);
  }

  async findActiveByConversationId(conversationId: string): Promise<GroupInviteLink | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.GROUP_INVITE_LINKS),
        IndexName: "conversationId-status-index",
        KeyConditionExpression:
          "conversationId = :conversationId AND #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":conversationId": conversationId,
          ":status": GroupInviteLinkStatus.ACTIVE,
        },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }
}

class DynamoGroupInviteLinkCommandRepository extends BaseCommandRepositoryDynamoDB<
  GroupInviteLink,
  Partial<GroupInviteLink>,
  typeof TABLE_NAMES.GROUP_INVITE_LINKS
> {
  constructor() {
    super(TABLE_NAMES.GROUP_INVITE_LINKS, true);
  }

  protected beforeInsert(data: GroupInviteLink): Record<string, any> {
    const now = new Date().toISOString();
    return {
      token: data.token,
      conversationId: data.conversationId,
      status: data.status || GroupInviteLinkStatus.ACTIVE,
      createdBy: data.createdBy,
      revokedBy: data.revokedBy,
      createdAt: data.createdAt ? data.createdAt.toISOString() : now,
      revokedAt: data.revokedAt ? data.revokedAt.toISOString() : null,
      expiresAt: data.expiresAt ? data.expiresAt.toISOString() : null,
    };
  }

  protected beforeUpdate(id: string, data: Partial<GroupInviteLink>): Record<string, any> {
    return {};
  }

  async revoke(token: string, revokedBy: string): Promise<boolean> {
    const docClient = getDocClient();
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(TABLE_NAMES.GROUP_INVITE_LINKS),
        Key: { token },
        UpdateExpression:
          "SET #status = :newStatus, revokedBy = :revokedBy, revokedAt = :revokedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":newStatus": GroupInviteLinkStatus.REVOKED,
          ":currentStatus": GroupInviteLinkStatus.ACTIVE,
          ":revokedBy": revokedBy,
          ":revokedAt": now,
        },
        ConditionExpression: "#status = :currentStatus",
      }),
    );
    return true;
  }
}

export class DynamoGroupInviteLinkRepository extends BaseRepositoryDynamoDB<
  GroupInviteLink,
  Record<string, unknown>,
  Partial<GroupInviteLink>,
  typeof TABLE_NAMES.GROUP_INVITE_LINKS
> {
  constructor() {
    super(
      new DynamoGroupInviteLinkQueryRepository(),
      new DynamoGroupInviteLinkCommandRepository(),
    );
  }

  async get(token: string): Promise<GroupInviteLink | null> {
    return (this.queryRepo as DynamoGroupInviteLinkQueryRepository).get(token);
  }

  async findActiveByConversationId(conversationId: string): Promise<GroupInviteLink | null> {
    return (this.queryRepo as DynamoGroupInviteLinkQueryRepository).findActiveByConversationId(conversationId);
  }

  async revoke(token: string, revokedBy: string): Promise<boolean> {
    return (this.cmdRepo as DynamoGroupInviteLinkCommandRepository).revoke(token, revokedBy);
  }
}
