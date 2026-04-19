import {
  Poll,
} from "../../../model";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import {
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

export class DynamoPollQueryRepository {
  protected toEntity(doc: Record<string, any>): Poll {
    return { ...doc } as Poll;
  }

  async get(id: string): Promise<Poll | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new GetCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        Key: { id },
      }),
    );
    return result.Item ? this.toEntity(result.Item) : null;
  }

  async findByConversationId(
    conversationId: string,
  ): Promise<Poll[]> {
    const docClient = getDocClient();

    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        IndexName: "conversation-index",
        KeyConditionExpression: "conversationId = :conversationId",
        ExpressionAttributeValues: { ":conversationId": conversationId },
        Limit: 50,
      }),
    );

    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async findActivePolls(conversationId: string): Promise<Poll[]> {
    const now = new Date().toISOString();
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        IndexName: "conversation-index",
        KeyConditionExpression: "conversationId = :conversationId",
        FilterExpression: "(attribute_not_exists(#expiresAt) OR #expiresAt > :now) AND #status = :status",
        ExpressionAttributeNames: {
          "#expiresAt": "expiresAt",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":conversationId": conversationId,
          ":now": now,
          ":status": "active",
        },
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }
}

export class DynamoPollCommandRepository {
  async insert(poll: Poll): Promise<boolean> {
    const docClient = getDocClient();
    const now = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        Item: {
          id: poll.id,
          conversationId: poll.conversationId,
          question: poll.question,
          options: poll.options,
          createdBy: poll.createdBy,
          isMultipleChoice: poll.isMultipleChoice || false,
          allowAddOption: poll.allowAddOption || false,
          expiresAt: poll.expiresAt ? poll.expiresAt.toISOString() : null,
          totalVotes: poll.totalVotes || 0,
          createdAt: poll.createdAt ? poll.createdAt.toISOString() : now,
          updatedAt: now,
        },
      }),
    );
    return true;
  }

  async update(id: string, data: Partial<Poll>): Promise<boolean> {
    const docClient = getDocClient();
    const now = new Date().toISOString();
    const updateData: Record<string, any> = { updatedAt: now };
    if (data.question !== undefined) updateData.question = data.question;
    if (data.options !== undefined) updateData.options = data.options;
    if (data.isMultipleChoice !== undefined) updateData.isMultipleChoice = data.isMultipleChoice;
    if (data.allowAddOption !== undefined) updateData.allowAddOption = data.allowAddOption;
    if (data.expiresAt !== undefined && data.expiresAt !== null) {
      updateData.expiresAt = data.expiresAt.toISOString();
    }
    if (data.totalVotes !== undefined) updateData.totalVotes = data.totalVotes;

    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        Key: { id },
        UpdateExpression: `SET ${Object.keys(updateData).map((k) => `${k} = :${k}`).join(", ")}`,
        ExpressionAttributeValues: Object.fromEntries(
          Object.entries(updateData).map(([k, v]) => [`:${k}`, v]),
        ),
      }),
    );
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const docClient = getDocClient();
    await docClient.send(
      new DeleteCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        Key: { id },
      }),
    );
    return true;
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    const docClient = getDocClient();
    const tableName = getTableName(TABLE_NAMES.POLLS);
    let lastEvaluatedKey: Record<string, any> | undefined;
    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "conversation-index",
          KeyConditionExpression: "conversationId = :conversationId",
          ExpressionAttributeValues: { ":conversationId": conversationId },
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
                DeleteRequest: { Key: { id: item.id } },
              })),
            },
          }),
        );
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }
}

export class DynamoPollRepository {
  constructor(
    public readonly queryRepo: DynamoPollQueryRepository,
    public readonly cmdRepo: DynamoPollCommandRepository,
  ) {}

  async deleteByConversationId(conversationId: string): Promise<void> {
    return this.cmdRepo.deleteByConversationId(conversationId);
  }
}
