import {
  CreateTableCommand,
  DescribeTableCommand,
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

export const TABLE_NAMES = {
  USERS: "users",
  CONVERSATIONS: "conversations",
  CONVERSATION_MEMBERS: "conversation_members",
  MESSAGES: "messages",
  MESSAGE_REACTIONS: "message_reactions",
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
