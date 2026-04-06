import {
  Conversation,
  ConversationMember,
  Message,
  MessageReaction,
  Poll,
} from "../../../model/model";
import {
  ConversationCondDTO,
  ConversationUpdateDTO,
  ConversationMemberCondDTO,
  ConversationMemberUpdateDTO,
  MessageCondDTO,
  MessageUpdateDTO,
} from "../../../model/dto";
import { config } from "@share/component/config";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
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
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    return { ...rest } as Conversation;
  }

  protected buildFilterExpression(cond: ConversationCondDTO): string {
    const conditions: string[] = [];
    if (cond.type) conditions.push("#type = :type");
    if (cond.createdBy) conditions.push("createdBy = :createdBy");
    return conditions.join(" AND ");
  }

  protected buildAttributeValues(cond: ConversationCondDTO): Record<string, any> {
    const values: Record<string, any> = {};
    if (cond.type) values[":type"] = cond.type;
    if (cond.createdBy) values[":createdBy"] = cond.createdBy;
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
    if (data.lastMessage !== undefined) updateData.lastMessage = data.lastMessage;
    if (data.lastMessageAt !== undefined) updateData.lastMessageAt = data.lastMessageAt.toISOString();
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
    if (data.leftAt !== undefined) updateData.leftAt = data.leftAt.toISOString();
    if (data.unreadCount !== undefined) updateData.unreadCount = data.unreadCount;
    if (data.lastReadMessageId !== undefined) updateData.lastReadMessageId = data.lastReadMessageId;
    if (data.lastSeenMessageId !== undefined) updateData.lastSeenMessageId = data.lastSeenMessageId;
    if (data.lastDeliveredMessageId !== undefined) updateData.lastDeliveredMessageId = data.lastDeliveredMessageId;
    if (data.lastReadAt !== undefined) updateData.lastReadAt = data.lastReadAt.toISOString();
    if (data.muteUntil !== undefined) updateData.muteUntil = data.muteUntil.toISOString();
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

class DynamoMessageQueryRepository extends BaseQueryRepositoryDynamoDB<
  Message,
  MessageCondDTO,
  typeof TABLE_NAMES.MESSAGES
> {
  constructor() {
    super(TABLE_NAMES.MESSAGES, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): Message {
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    return {
      id: doc.id || sk?.split("#")[2],
      conversationId: doc.conversationId || doc.pk?.replace("CONV#", ""),
      ...rest,
    } as Message;
  }

  async listByConversation(conversationId: string, limit: number, cursor?: string): Promise<{ messages: Message[]; nextCursor?: string }> {
    const docClient = getDocClient();
    const exclusiveStartKey = cursor ? JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) : undefined;

    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `CONV#${conversationId}`,
          ":skPrefix": "MSG#",
        },
        Limit: limit,
        ScanIndexForward: false,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    const messages = (result.Items || []).map((item) => this.toEntity(item));
    let nextCursor: string | undefined;
    if (result.LastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
    }

    return { messages, nextCursor };
  }
}

class DynamoMessageCommandRepository extends BaseCommandRepositoryDynamoDB<
  Message,
  MessageUpdateDTO,
  typeof TABLE_NAMES.MESSAGES
> {
  constructor() {
    super(TABLE_NAMES.MESSAGES, false);
  }

  protected beforeInsert(data: Message): Record<string, any> {
    const createdAt = data.createdAt ? data.createdAt.toISOString() : new Date().toISOString();
    return {
      pk: `CONV#${data.conversationId}`,
      sk: `MSG#${createdAt}#${data.id}`,
      id: data.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      type: data.type,
      text: data.text,
      media: data.media,
      deletedForUserIds: data.deletedForUserIds || [],
      quotedMessageId: data.quotedMessageId,
      quotedMessagePreview: data.quotedMessagePreview,
      createdAt: createdAt,
      editedAt: data.editedAt ? data.editedAt.toISOString() : null,
      deletedAt: data.deletedAt ? data.deletedAt.toISOString() : null,
      pinned: data.pinned || false,
      pinnedAt: data.pinnedAt ? data.pinnedAt.toISOString() : null,
      GSI1PK: `SENDER#${data.senderId}`,
      GSI1SK: createdAt,
    };
  }

  protected beforeUpdate(id: string, data: MessageUpdateDTO): Record<string, any> {
    const updateData: Record<string, any> = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.text !== undefined) updateData.text = data.text;
    if (data.media !== undefined) updateData.media = data.media;
    if (data.editedAt !== undefined) updateData.editedAt = data.editedAt.toISOString();
    if (data.deletedAt !== undefined) updateData.deletedAt = data.deletedAt.toISOString();
    if (data.deletedForUserIds !== undefined) updateData.deletedForUserIds = data.deletedForUserIds;
    if (data.pinned !== undefined) updateData.pinned = data.pinned;
    if (data.pinnedAt !== undefined) updateData.pinnedAt = data.pinnedAt.toISOString();
    return updateData;
  }
}

export class DynamoMessageRepository extends BaseRepositoryDynamoDB<
  Message,
  MessageCondDTO,
  MessageUpdateDTO,
  typeof TABLE_NAMES.MESSAGES
> {
  constructor() {
    super(new DynamoMessageQueryRepository(), new DynamoMessageCommandRepository());
  }

  async listWithCursor(
    conversationId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Message[]> {
    const queryRepo = new DynamoMessageQueryRepository();
    const result = await queryRepo.listByConversation(conversationId, limit, cursor);
    return result.messages;
  }

  async findPinnedMessages(conversationId: string): Promise<Message[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGES),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        FilterExpression: "pinned = :pinned",
        ExpressionAttributeValues: {
          ":pk": `CONV#${conversationId}`,
          ":skPrefix": "MSG#",
          ":pinned": true,
        },
      }),
    );
    return (result.Items || []).map((item) => this.convertMessage(item));
  }

  private convertMessage(doc: Record<string, any>): Message {
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    return {
      id: doc.id || sk?.split("#")[2],
      conversationId: doc.conversationId || doc.pk?.replace("CONV#", ""),
      ...rest,
    } as Message;
  }
}

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

  async deleteByMessageId(messageId: string): Promise<boolean> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `MSG#${messageId}` },
      }),
    );
    for (const item of result.Items || []) {
      await docClient.send(
        new DeleteCommand({
          TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
          Key: { pk: item.pk, sk: item.sk },
        }),
      );
    }
    return true;
  }
}

export class DynamoPollQueryRepository {
  protected toEntity(doc: Record<string, any>): Poll {
    return { ...doc } as Poll;
  }

  async get(id: string): Promise<Poll | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: { ":id": id },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async findByConversationId(conversationId: string): Promise<Poll[]> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.POLLS),
        IndexName: "conversation-index",
        KeyConditionExpression: "conversationId = :conversationId",
        ExpressionAttributeValues: { ":conversationId": conversationId },
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
        FilterExpression: "(attribute_type(expiresAt, NULL) OR expiresAt > :now) AND status = :status",
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
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt.toISOString();
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
}

export class DynamoPollRepository {
  constructor(
    public readonly queryRepo: DynamoPollQueryRepository,
    public readonly cmdRepo: DynamoPollCommandRepository,
  ) {}
}
