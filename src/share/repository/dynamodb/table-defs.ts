import {
  CreateTableCommand,
  DescribeTableCommand,
  DeleteTableCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";
import { getDynamoDBClient } from "./client";

const client = getDynamoDBClient();

export interface TableDefinition {
  TableName: string;
  KeySchema: { AttributeName: string; KeyType: "HASH" | "RANGE" }[];
  AttributeDefinitions: { AttributeName: string; AttributeType: "S" | "N" | "BOOL" }[];
  BillingMode?: "PAY_PER_REQUEST" | "PROVISIONED";
  GlobalSecondaryIndexes?: {
    IndexName: string;
    KeySchema: { AttributeName: string; KeyType: "HASH" | "RANGE" }[];
    Projection: { ProjectionType: "ALL" | "KEYS_ONLY" | "INCLUDE"; NonKeyAttributes?: string[] };
    ProvisionedThroughput?: { ReadCapacityUnits: number; WriteCapacityUnits: number };
  }[];
  LocalSecondaryIndexes?: {
    IndexName: string;
    KeySchema: { AttributeName: string; KeyType: "HASH" | "RANGE" }[];
    Projection: { ProjectionType: "ALL" | "KEYS_ONLY" | "INCLUDE"; NonKeyAttributes?: string[] };
  }[];
  TimeToLiveSpecification?: { AttributeName: string; Enabled: boolean };
}

export async function createTableIfNotExists(def: TableDefinition): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: def.TableName }));
    console.log(`Table ${def.TableName} already exists.`);
  } catch (err) {
    if (err instanceof ResourceNotFoundException) {
      await client.send(new CreateTableCommand(def as any));
      console.log(`Table ${def.TableName} created successfully.`);
    } else {
      throw err;
    }
  }
}

export async function deleteTableIfExists(def: TableDefinition): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: def.TableName }));
    await client.send(new DeleteTableCommand({ TableName: def.TableName }));
    console.log(`Table ${def.TableName} deleted.`);
  } catch (err) {
    if (err instanceof ResourceNotFoundException) {
      console.log(`Table ${def.TableName} does not exist, skip delete.`);
    } else {
      throw err;
    }
  }
}

export const TABLE_NAMES = {
  USERS: "users",
  CONVERSATIONS: "conversations",
  CONVERSATION_MEMBERS: "conversation_members",
  MESSAGES: "messages",
  MESSAGE_REACTIONS: "message_reactions",
  MESSAGE_CLASSIFICATIONS: "message_classifications",
  POLLS: "polls",
  POSTS: "posts",
  POST_REACTIONS: "post_reactions",
  POST_COMMENTS: "post_comments",
  FRIENDSHIPS: "friendships",
  FRIEND_REQUESTS: "friend_requests",
  BLOCKS: "blocks",
  STORIES: "stories",
  STORY_VIEWS: "story_views",
  CLOUD_ITEMS: "cloud_items",
} as const;

export const MESSAGE_CLASSIFICATIONS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.MESSAGE_CLASSIFICATIONS,
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "pk", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
    { AttributeName: "GSI1PK", AttributeType: "S" },
    { AttributeName: "GSI1SK", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "GSI1",
      KeySchema: [
        { AttributeName: "GSI1PK", KeyType: "HASH" },
        { AttributeName: "GSI1SK", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const USERS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.USERS,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
    { AttributeName: "email", AttributeType: "S" },
    { AttributeName: "phone", AttributeType: "S" },
    { AttributeName: "username", AttributeType: "S" },
  ],
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
  BillingMode: "PAY_PER_REQUEST",
};

export const CONVERSATIONS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.CONVERSATIONS,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
    { AttributeName: "pairKey", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "pairKey-index",
      KeySchema: [{ AttributeName: "pairKey", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const CONVERSATION_MEMBERS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.CONVERSATION_MEMBERS,
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "pk", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
    { AttributeName: "id", AttributeType: "S" },
    { AttributeName: "userId", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "userId-index",
      KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "id-index",
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const MESSAGES_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.MESSAGES,
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "pk", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
    { AttributeName: "id", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "id-index",
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const MESSAGE_REACTIONS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.MESSAGE_REACTIONS,
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "pk", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const POLLS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.POLLS,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
    { AttributeName: "conversationId", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "conversation-index",
      KeySchema: [{ AttributeName: "conversationId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const FRIENDSHIPS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.FRIENDSHIPS,
  KeySchema: [
    { AttributeName: "userA", KeyType: "HASH" },
    { AttributeName: "userB", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "userA", AttributeType: "S" },
    { AttributeName: "userB", AttributeType: "S" },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const FRIEND_REQUESTS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.FRIEND_REQUESTS,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
    { AttributeName: "senderId", AttributeType: "S" },
    { AttributeName: "receiverId", AttributeType: "S" },
  ],
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
  BillingMode: "PAY_PER_REQUEST",
};

export const BLOCKS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.BLOCKS,
  KeySchema: [
    { AttributeName: "blockerId", KeyType: "HASH" },
    { AttributeName: "blockedUserId", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "blockerId", AttributeType: "S" },
    { AttributeName: "blockedUserId", AttributeType: "S" },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const POSTS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.POSTS,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const POST_REACTIONS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.POST_REACTIONS,
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "pk", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const POST_COMMENTS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.POST_COMMENTS,
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "pk", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const STORIES_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.STORIES,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const STORY_VIEWS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.STORY_VIEWS,
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "pk", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const CLOUD_ITEMS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.CLOUD_ITEMS,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const ALL_TABLES: TableDefinition[] = [
  USERS_TABLE,
  CONVERSATIONS_TABLE,
  CONVERSATION_MEMBERS_TABLE,
  MESSAGES_TABLE,
  MESSAGE_REACTIONS_TABLE,
  MESSAGE_CLASSIFICATIONS_TABLE,
  POLLS_TABLE,
  FRIENDSHIPS_TABLE,
  FRIEND_REQUESTS_TABLE,
  BLOCKS_TABLE,
  POSTS_TABLE,
  POST_REACTIONS_TABLE,
  POST_COMMENTS_TABLE,
  STORIES_TABLE,
  STORY_VIEWS_TABLE,
  CLOUD_ITEMS_TABLE,
];
