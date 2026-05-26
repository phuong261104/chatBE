import {
  Poll,
  PollStatus,
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
    return {
      ...doc,
      expiresAt: doc.expiresAt ? new Date(doc.expiresAt) : undefined,
      closedAt: doc.closedAt ? new Date(doc.closedAt) : undefined,
      pinnedAt: doc.pinnedAt ? new Date(doc.pinnedAt) : undefined,
      lastVoteActivityAt: doc.lastVoteActivityAt ? new Date(doc.lastVoteActivityAt) : undefined,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      showResultsBeforeClose: doc.showResultsBeforeClose ?? true,
      hideVoters: doc.hideVoters || false,
      status: doc.status || PollStatus.ACTIVE,
      pinned: doc.pinned || false,
      voteActivityCount: doc.voteActivityCount || 0,
    } as Poll;
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
        FilterExpression:
          "(attribute_not_exists(#expiresAt) OR #expiresAt > :now) AND (attribute_not_exists(#status) OR #status = :status)",
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

  async findExpiredActivePolls(nowDate: Date, limit = 100): Promise<Poll[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        IndexName: "status-expiresAt-index",
        KeyConditionExpression: "#status = :status AND expiresAt <= :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": PollStatus.ACTIVE,
          ":now": nowDate.toISOString(),
        },
        Limit: limit,
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }
}

export class DynamoPollCommandRepository {
  async insert(poll: Poll): Promise<boolean> {
    const docClient = getDocClient();
    const now = new Date().toISOString();
    const item = {
          id: poll.id,
          conversationId: poll.conversationId,
          messageId: poll.messageId,
          question: poll.question,
          options: poll.options,
          createdBy: poll.createdBy,
          isMultipleChoice: poll.isMultipleChoice || false,
          allowAddOption: poll.allowAddOption || false,
          showResultsBeforeClose: poll.showResultsBeforeClose ?? true,
          hideVoters: poll.hideVoters || false,
          status: poll.status || PollStatus.ACTIVE,
          closedAt: poll.closedAt ? poll.closedAt.toISOString() : null,
          closedBy: poll.closedBy,
          pinned: poll.pinned || false,
          pinnedAt: poll.pinnedAt ? poll.pinnedAt.toISOString() : null,
          pinnedBy: poll.pinnedBy,
          totalVotes: poll.totalVotes || 0,
          lastVoteActivityAt: poll.lastVoteActivityAt ? poll.lastVoteActivityAt.toISOString() : null,
          lastVoteActivityMessageId: poll.lastVoteActivityMessageId,
          voteActivityCount: poll.voteActivityCount || 0,
          createdAt: poll.createdAt ? poll.createdAt.toISOString() : now,
          updatedAt: now,
    } as Record<string, any>;
    if (poll.expiresAt) item.expiresAt = poll.expiresAt.toISOString();
    await docClient.send(
      new PutCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        Item: item,
      }),
    );
    return true;
  }

  async update(id: string, data: Partial<Poll>): Promise<boolean> {
    const docClient = getDocClient();
    const now = new Date().toISOString();
    const updateData: Record<string, any> = { updatedAt: now };
    if (data.messageId !== undefined) updateData.messageId = data.messageId;
    if (data.question !== undefined) updateData.question = data.question;
    if (data.options !== undefined) updateData.options = data.options;
    if (data.isMultipleChoice !== undefined) updateData.isMultipleChoice = data.isMultipleChoice;
    if (data.allowAddOption !== undefined) updateData.allowAddOption = data.allowAddOption;
    if (data.showResultsBeforeClose !== undefined) updateData.showResultsBeforeClose = data.showResultsBeforeClose;
    if (data.hideVoters !== undefined) updateData.hideVoters = data.hideVoters;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? data.expiresAt.toISOString() : null;
    if (data.closedAt !== undefined) updateData.closedAt = data.closedAt ? data.closedAt.toISOString() : null;
    if (data.closedBy !== undefined) updateData.closedBy = data.closedBy || null;
    if (data.pinned !== undefined) updateData.pinned = data.pinned;
    if (data.pinnedAt !== undefined) updateData.pinnedAt = data.pinnedAt ? data.pinnedAt.toISOString() : null;
    if (data.pinnedBy !== undefined) updateData.pinnedBy = data.pinnedBy || null;
    if (data.totalVotes !== undefined) updateData.totalVotes = data.totalVotes;
    if (data.lastVoteActivityAt !== undefined) {
      updateData.lastVoteActivityAt = data.lastVoteActivityAt ? data.lastVoteActivityAt.toISOString() : null;
    }
    if (data.lastVoteActivityMessageId !== undefined) {
      updateData.lastVoteActivityMessageId = data.lastVoteActivityMessageId || null;
    }
    if (data.voteActivityCount !== undefined) updateData.voteActivityCount = data.voteActivityCount;

    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        Key: { id },
        UpdateExpression: `SET ${Object.keys(updateData).map((k) => `#${k} = :${k}`).join(", ")}`,
        ExpressionAttributeNames: Object.fromEntries(
          Object.keys(updateData).map((k) => [`#${k}`, k]),
        ),
        ExpressionAttributeValues: Object.fromEntries(
          Object.entries(updateData).map(([k, v]) => [`:${k}`, v]),
        ),
      }),
    );
    return true;
  }

  async closeExpired(id: string, nowDate: Date): Promise<boolean> {
    const docClient = getDocClient();
    const now = nowDate.toISOString();
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: getTableName(TABLE_NAMES.POLLS),
          Key: { id },
          UpdateExpression: "SET #status = :closed, closedAt = :now, updatedAt = :now",
          ConditionExpression: "#status = :active AND expiresAt <= :now",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":active": PollStatus.ACTIVE,
            ":closed": PollStatus.CLOSED,
            ":now": now,
          },
        }),
      );
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
        return false;
      }
      throw error;
    }
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
