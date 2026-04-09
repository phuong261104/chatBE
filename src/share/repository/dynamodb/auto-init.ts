import { CreateTableCommand, DescribeTableCommand, ResourceNotFoundException } from "@aws-sdk/client-dynamodb";
import { getDynamoDBClient, getTableName } from "./client";
import { TABLE_NAMES } from "./table-defs";

const client = getDynamoDBClient();

interface TableConfig {
  TableName: string;
  KeySchema: { AttributeName: string; KeyType: "HASH" | "RANGE" }[];
  AttributeDefinitions: { AttributeName: string; AttributeType: "S" | "N" | "BOOL" }[];
  BillingMode: "PAY_PER_REQUEST" | "PROVISIONED";
  GlobalSecondaryIndexes?: {
    IndexName: string;
    KeySchema: { AttributeName: string; KeyType: "HASH" | "RANGE" }[];
    Projection: { ProjectionType: "ALL" | "KEYS_ONLY" | "INCLUDE"; NonKeyAttributes?: string[] };
  }[];
}

const tableConfigs: TableConfig[] = [
  {
    TableName: getTableName(TABLE_NAMES.USERS),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "email", AttributeType: "S" },
      { AttributeName: "phone", AttributeType: "S" },
      { AttributeName: "username", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "email-index",
        KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "phone-index",
        KeySchema: [{ AttributeName: "phone", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "username-index",
        KeySchema: [{ AttributeName: "username", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: getTableName(TABLE_NAMES.CONVERSATIONS),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "pairKey", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "pairKey-index",
        KeySchema: [{ AttributeName: "pairKey", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: getTableName(TABLE_NAMES.CONVERSATION_MEMBERS),
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
      { AttributeName: "id", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "id-index",
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: getTableName(TABLE_NAMES.MESSAGES),
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
      { AttributeName: "id", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "id-index",
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: getTableName(TABLE_NAMES.MESSAGE_REACTIONS),
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: getTableName(TABLE_NAMES.POLLS),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "conversationId", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "conversation-index",
        KeySchema: [{ AttributeName: "conversationId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: getTableName(TABLE_NAMES.POSTS),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "authorId", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "authorId-index",
        KeySchema: [{ AttributeName: "authorId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: getTableName(TABLE_NAMES.POST_REACTIONS),
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: getTableName(TABLE_NAMES.POST_COMMENTS),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "pk", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "postId-index",
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" as const }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: getTableName(TABLE_NAMES.FRIENDSHIPS),
    KeySchema: [
      { AttributeName: "userA", KeyType: "HASH" },
      { AttributeName: "userB", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "userA", AttributeType: "S" },
      { AttributeName: "userB", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "userB-index",
        KeySchema: [{ AttributeName: "userB", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: getTableName(TABLE_NAMES.FRIEND_REQUESTS),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "senderId", AttributeType: "S" },
      { AttributeName: "receiverId", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "senderId-index",
        KeySchema: [{ AttributeName: "senderId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "receiverId-index",
        KeySchema: [{ AttributeName: "receiverId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: getTableName(TABLE_NAMES.BLOCKS),
    KeySchema: [
      { AttributeName: "blockerId", KeyType: "HASH" },
      { AttributeName: "blockedUserId", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "blockerId", AttributeType: "S" },
      { AttributeName: "blockedUserId", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: getTableName(TABLE_NAMES.STORIES),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "authorId", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "authorId-index",
        KeySchema: [{ AttributeName: "authorId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: getTableName(TABLE_NAMES.STORY_VIEWS),
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: getTableName(TABLE_NAMES.CLOUD_ITEMS),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "userId-index",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
];

export async function createTableIfNotExists(config: TableConfig): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: config.TableName }));
    console.log(`[SKIP] Table ${config.TableName} already exists.`);
  } catch (err: any) {
    if (err.name === "ResourceNotFoundException") {
      await client.send(new CreateTableCommand(config as any));
      console.log(`[CREATED] Table ${config.TableName} created successfully.`);
    } else {
      throw err;
    }
  }
}

export async function initDynamoDBTables(): Promise<void> {
  console.log("\n=== DynamoDB Tables Auto-Initialization ===\n");

  for (const config of tableConfigs) {
    await createTableIfNotExists(config);
  }

  console.log("\n=== DynamoDB tables initialization completed ===\n");
}
