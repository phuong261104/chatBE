import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient, getTableName } from "@share/repository/dynamodb/client";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

export interface UserAvatarHistoryItem {
  id: string;
  userId: string;
  avatarUrl: string;
  createdAt: Date;
}

export class DynamoUserAvatarHistoryRepository {
  private readonly tableName = getTableName(TABLE_NAMES.USER_AVATAR_HISTORY);

  async insert(item: UserAvatarHistoryItem): Promise<void> {
    const docClient = getDocClient();
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          id: item.id,
          userId: item.userId,
          avatarUrl: item.avatarUrl,
          createdAt: item.createdAt.toISOString(),
        },
      }),
    );
  }

  async listByUserId(userId: string, limit = 50): Promise<UserAvatarHistoryItem[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
        ScanIndexForward: false,
        Limit: Math.min(limit, 100),
      }),
    );

    return (result.Items || []).map((item) => ({
      id: item.id,
      userId: item.userId,
      avatarUrl: item.avatarUrl,
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    }));
  }
}
