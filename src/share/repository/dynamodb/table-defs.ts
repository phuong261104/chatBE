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
      const { TimeToLiveSpecification, ...createDef } = def;
      await client.send(new CreateTableCommand(createDef as any));
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
  USER_AVATAR_HISTORY: "user_avatar_history",
  CONVERSATIONS: "conversations",
  CONVERSATION_MEMBERS: "conversation_members",
  MESSAGES: "messages",
  MESSAGE_REACTIONS: "message_reactions",
  MESSAGE_CLASSIFICATIONS: "message_classifications",
  POLLS: "polls",
  GROUP_REMINDERS: "group_reminders",
  GROUP_NOTES: "group_notes",
  FRIENDSHIPS: "friendships",
  FRIEND_REQUESTS: "friend_requests",
  BLOCKS: "blocks",
  STORIES: "stories",
  STORY_VIEWS: "story_views",
  CLOUD_ITEMS: "cloud_items",
  COLLECTIONS: "collections",
  COLLECTION_ITEMS: "collection_items",
  GROUP_INVITE_LINKS: "group_invite_links",
  GROUP_BLOCKS: "group_blocks",
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
    { AttributeName: "messageId", AttributeType: "S" },
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
    {
      IndexName: "messageId-index",
      KeySchema: [{ AttributeName: "messageId", KeyType: "HASH" }],
      Projection: { ProjectionType: "KEYS_ONLY" },
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

export const USER_AVATAR_HISTORY_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.USER_AVATAR_HISTORY,
  KeySchema: [
    { AttributeName: "userId", KeyType: "HASH" },
    { AttributeName: "createdAt", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "userId", AttributeType: "S" },
    { AttributeName: "createdAt", AttributeType: "S" },
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
    { AttributeName: "lastActivityAt", AttributeType: "S" },
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
    {
      IndexName: "userId-lastActivityAt-index",
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "lastActivityAt", KeyType: "RANGE" },
      ],
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
    { AttributeName: "clientMessageKey", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "id-index",
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "clientMessageKey-index",
      KeySchema: [{ AttributeName: "clientMessageKey", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
  TimeToLiveSpecification: { AttributeName: "expireAtEpoch", Enabled: true },
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
    { AttributeName: "status", AttributeType: "S" },
    { AttributeName: "expiresAt", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "conversation-index",
      KeySchema: [{ AttributeName: "conversationId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "status-expiresAt-index",
      KeySchema: [
        { AttributeName: "status", KeyType: "HASH" },
        { AttributeName: "expiresAt", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const GROUP_REMINDERS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.GROUP_REMINDERS,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
    { AttributeName: "conversationId", AttributeType: "S" },
    { AttributeName: "status", AttributeType: "S" },
    { AttributeName: "nextNotifyAt", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "conversation-index",
      KeySchema: [{ AttributeName: "conversationId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "status-nextNotifyAt-index",
      KeySchema: [
        { AttributeName: "status", KeyType: "HASH" },
        { AttributeName: "nextNotifyAt", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const GROUP_NOTES_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.GROUP_NOTES,
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
    { AttributeName: "createdAt", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "userA-createdAt-index",
      KeySchema: [
        { AttributeName: "userA", KeyType: "HASH" },
        { AttributeName: "createdAt", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "userB-index",
      KeySchema: [
        { AttributeName: "userB", KeyType: "HASH" },
        { AttributeName: "createdAt", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
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
    { AttributeName: "createdAt", AttributeType: "S" },
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
    {
      IndexName: "senderId-createdAt-index",
      KeySchema: [
        { AttributeName: "senderId", KeyType: "HASH" },
        { AttributeName: "createdAt", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "receiverId-createdAt-index",
      KeySchema: [
        { AttributeName: "receiverId", KeyType: "HASH" },
        { AttributeName: "createdAt", KeyType: "RANGE" },
      ],
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
    { AttributeName: "createdAt", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "blockerId-createdAt-index",
      KeySchema: [
        { AttributeName: "blockerId", KeyType: "HASH" },
        { AttributeName: "createdAt", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const CLOUD_ITEMS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.CLOUD_ITEMS,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
    { AttributeName: "userId", AttributeType: "S" },
    { AttributeName: "type", AttributeType: "S" },
    { AttributeName: "isDeleted", AttributeType: "S" },
    { AttributeName: "isPinned", AttributeType: "S" },
    { AttributeName: "collectionId", AttributeType: "S" },
    { AttributeName: "shareToken", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "userId-index",
      KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "userId-type-index",
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "type", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "userId-isDeleted-index",
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "isDeleted", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "userId-isPinned-index",
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "isPinned", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "userId-collectionId-index",
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "collectionId", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "shareToken-index",
      KeySchema: [{ AttributeName: "shareToken", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const COLLECTIONS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.COLLECTIONS,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
    { AttributeName: "userId", AttributeType: "S" },
    { AttributeName: "parentId", AttributeType: "S" },
    { AttributeName: "isDefault", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "userId-index",
      KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "userId-parentId-index",
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "parentId", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "userId-isDefault-index",
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "isDefault", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const COLLECTION_ITEMS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.COLLECTION_ITEMS,
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "pk", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
    { AttributeName: "collectionId", AttributeType: "S" },
    { AttributeName: "itemId", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "collectionId-index",
      KeySchema: [{ AttributeName: "collectionId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "itemId-index",
      KeySchema: [{ AttributeName: "itemId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const GROUP_INVITE_LINKS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.GROUP_INVITE_LINKS,
  KeySchema: [{ AttributeName: "token", KeyType: "HASH" }],
  AttributeDefinitions: [
    { AttributeName: "token", AttributeType: "S" },
    { AttributeName: "conversationId", AttributeType: "S" },
    { AttributeName: "status", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "conversationId-status-index",
      KeySchema: [
        { AttributeName: "conversationId", KeyType: "HASH" },
        { AttributeName: "status", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const GROUP_BLOCKS_TABLE: TableDefinition = {
  TableName: TABLE_NAMES.GROUP_BLOCKS,
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "pk", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
    { AttributeName: "userId", AttributeType: "S" },
    { AttributeName: "blockedBy", AttributeType: "S" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "userId-index",
      KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
    {
      IndexName: "blockedBy-index",
      KeySchema: [{ AttributeName: "blockedBy", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const ALL_TABLES: TableDefinition[] = [
  USERS_TABLE,
  USER_AVATAR_HISTORY_TABLE,
  CONVERSATIONS_TABLE,
  CONVERSATION_MEMBERS_TABLE,
  MESSAGES_TABLE,
  MESSAGE_REACTIONS_TABLE,
  MESSAGE_CLASSIFICATIONS_TABLE,
  POLLS_TABLE,
  GROUP_REMINDERS_TABLE,
  GROUP_NOTES_TABLE,
  FRIENDSHIPS_TABLE,
  FRIEND_REQUESTS_TABLE,
  BLOCKS_TABLE,
  CLOUD_ITEMS_TABLE,
  COLLECTIONS_TABLE,
  COLLECTION_ITEMS_TABLE,
  GROUP_INVITE_LINKS_TABLE,
  GROUP_BLOCKS_TABLE,
];
