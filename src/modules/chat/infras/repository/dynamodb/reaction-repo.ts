import {
  MessageReaction,
} from "../../../model";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

export class DynamoMessageReactionQueryRepository {
  protected toEntity(doc: Record<string, any>): MessageReaction {
    const { pk, sk, ...rest } = doc;
    return {
      id: doc.id || `${pk?.replace("MSG#", "")}-${sk?.replace("REACT#", "")}`,
      ...rest,
    } as MessageReaction;
  }

  async get(id: string): Promise<MessageReaction | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new GetCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
        Key: { pk: `MSG#${id.split("-")[0]}`, sk: `REACT#${id.split("-").slice(1).join("#")}` },
      }),
    );
    return result.Item ? this.toEntity(result.Item) : null;
  }

  async findByMessageId(messageId: string): Promise<MessageReaction[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `MSG#${messageId}`,
          ":skPrefix": "REACT#",
        },
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async findByUserAndMessage(messageId: string, userId: string): Promise<MessageReaction[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `MSG#${messageId}`,
          ":skPrefix": `REACT#${userId}#`,
        },
      }),
    );
    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async findByUserMessageEmoji(messageId: string, userId: string, emoji: string): Promise<MessageReaction | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new GetCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
        Key: { pk: `MSG#${messageId}`, sk: `REACT#${userId}#${emoji}` },
      }),
    );
    return result.Item ? this.toEntity(result.Item) : null;
  }

  async getReactionSummary(messageId: string): Promise<Record<string, number>> {
    const reactions = await this.findByMessageId(messageId);
    const summary: Record<string, number> = {};
    for (const r of reactions) {
      summary[r.emoji] = (summary[r.emoji] || 0) + 1;
    }
    return summary;
  }

  async upsertReaction(reaction: MessageReaction): Promise<MessageReaction> {
    const docClient = getDocClient();
    await docClient.send(
      new PutCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
        Item: {
          pk: `MSG#${reaction.messageId}`,
          sk: `REACT#${reaction.userId}#${reaction.emoji}`,
          id: `${reaction.messageId}-${reaction.userId}-${reaction.emoji}`,
          messageId: reaction.messageId,
          userId: reaction.userId,
          emoji: reaction.emoji,
          count: reaction.count || 1,
          createdAt: new Date().toISOString(),
        },
      }),
    );
    return reaction;
  }

  async decrementReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    const docClient = getDocClient();
    await docClient.send(
      new DeleteCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
        Key: { pk: `MSG#${messageId}`, sk: `REACT#${userId}#${emoji}` },
      }),
    );
    return true;
  }
}

export class DynamoMessageReactionCommandRepository {
  async upsertReaction(reaction: MessageReaction): Promise<MessageReaction> {
    const docClient = getDocClient();
    await docClient.send(
      new PutCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
        Item: {
          pk: `MSG#${reaction.messageId}`,
          sk: `REACT#${reaction.userId}#${reaction.emoji}`,
          id: `${reaction.messageId}-${reaction.userId}-${reaction.emoji}`,
          messageId: reaction.messageId,
          userId: reaction.userId,
          emoji: reaction.emoji,
          count: reaction.count || 1,
          createdAt: new Date().toISOString(),
        },
      }),
    );
    return reaction;
  }

  async decrementReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    const docClient = getDocClient();
    await docClient.send(
      new DeleteCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
        Key: { pk: `MSG#${messageId}`, sk: `REACT#${userId}#${emoji}` },
      }),
    );
    return true;
  }

  async decrementAllByUserAndMessage(messageId: string, userId: string): Promise<number> {
    const reactions = await (new DynamoMessageReactionQueryRepository()).findByUserAndMessage(messageId, userId);
    for (const r of reactions) {
      await this.decrementReaction(messageId, userId, r.emoji);
    }
    return reactions.length;
  }

  async deleteAllByUserAndMessage(messageId: string, userId: string): Promise<number> {
    return this.decrementAllByUserAndMessage(messageId, userId);
  }

  async deleteByMessageId(messageId: string): Promise<void> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `MSG#${messageId}` },
      }),
    );
    for (let i = 0; i < (result.Items || []).length; i += 25) {
      const chunk = (result.Items || []).slice(i, i + 25);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [getTableName(TABLE_NAMES.MESSAGE_REACTIONS)]: chunk.map((item) => ({
              DeleteRequest: { Key: { pk: item.pk, sk: item.sk } },
            })),
          },
        }),
      );
    }
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    const docClient = getDocClient();
    const msgTable = getTableName(TABLE_NAMES.MESSAGES);
    const reactTable = getTableName(TABLE_NAMES.MESSAGE_REACTIONS);

    let lastEvaluatedKey: Record<string, any> | undefined;
    do {
      const msgResult = await docClient.send(
        new QueryCommand({
          TableName: msgTable,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": `CONV#${conversationId}`,
            ":skPrefix": "MSG#",
          },
          ProjectionExpression: "pk, sk",
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      const messageIds: string[] = [];
      for (const item of msgResult.Items || []) {
        const parts = item.sk.split("#");
        if (parts.length >= 3) messageIds.push(parts[2]);
      }

      for (let i = 0; i < messageIds.length; i += 25) {
        const idChunk = messageIds.slice(i, i + 25);
        for (const messageId of idChunk) {
          const reactResult = await docClient.send(
            new QueryCommand({
              TableName: reactTable,
              KeyConditionExpression: "pk = :pk",
              ExpressionAttributeValues: { ":pk": `MSG#${messageId}` },
              ProjectionExpression: "pk, sk",
            }),
          );
          for (let j = 0; j < (reactResult.Items || []).length; j += 25) {
            const chunk = reactResult.Items!.slice(j, j + 25);
            await docClient.send(
              new BatchWriteCommand({
                RequestItems: {
                  [reactTable]: chunk.map((item) => ({
                    DeleteRequest: { Key: { pk: item.pk, sk: item.sk } },
                  })),
                },
              }),
            );
          }
        }
      }
      lastEvaluatedKey = msgResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }
}

export class DynamoMessageReactionRepository {
  constructor(
    public readonly queryRepo: DynamoMessageReactionQueryRepository,
    public readonly cmdRepo: DynamoMessageReactionCommandRepository,
  ) {}
}
