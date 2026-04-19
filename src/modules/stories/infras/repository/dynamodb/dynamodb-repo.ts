import { Story, StoryView } from "@modules/stories/model/model";
import { StoryCondDTO, StoryUpdateDTO } from "@modules/stories/model/dto";
import { PagingDTO } from "@share/model/paging";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";
class DynamoStoryQueryRepository extends BaseQueryRepositoryDynamoDB<
  Story,
  StoryCondDTO,
  typeof TABLE_NAMES.STORIES
> {
  constructor() {
    super(TABLE_NAMES.STORIES, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): Story {
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    return { ...rest } as Story;
  }

  protected buildFilterExpression(cond: StoryCondDTO): string {
    const conditions: string[] = [];
    if (cond.authorId) conditions.push("authorId = :authorId");
    return conditions.join(" AND ");
  }

  protected buildAttributeValues(cond: StoryCondDTO): Record<string, any> {
    const values: Record<string, any> = {};
    if (cond.authorId) values[":authorId"] = cond.authorId;
    return values;
  }

  async getActiveByAuthorIds(authorIds: string[]): Promise<Story[]> {
    const docClient = getDocClient();
    const now = new Date().toISOString();

    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.STORIES),
        FilterExpression: "authorId IN (:authorIds) AND expiresAt > :now",
        ExpressionAttributeValues: {
          ":authorIds": authorIds,
          ":now": now,
        },
      }),
    );

    return (result.Items || []).map((item) => this.toEntity(item));
  }

  async incrementViewersCount(storyId: string): Promise<void> {
    const docClient = getDocClient();
    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(TABLE_NAMES.STORIES),
        Key: { id: storyId },
        UpdateExpression: "SET viewersCount = if_not_exists(viewersCount, :zero) + :one",
        ExpressionAttributeValues: { ":one": 1, ":zero": 0 },
      }),
    );
  }
}

class DynamoStoryCommandRepository extends BaseCommandRepositoryDynamoDB<
  Story,
  StoryUpdateDTO,
  typeof TABLE_NAMES.STORIES
> {
  constructor() {
    super(TABLE_NAMES.STORIES, true);
  }

  protected beforeInsert(data: Story): Record<string, any> {
    const d = data as any;
    const now = new Date().toISOString();
    const expiresAt = d.expiresAt ? d.expiresAt.toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return {
      id: d.id,
      authorId: d.authorId,
      type: d.type,
      content: d.content,
      mediaUrl: d.mediaUrl,
      backgroundColor: d.backgroundColor,
      textStyle: d.textStyle,
      viewersCount: d.viewersCount || 0,
      expiresAt,
      createdAt: d.createdAt ? d.createdAt.toISOString() : now,
      GSI1PK: `AUTHOR#${d.authorId}`,
      GSI1SK: now,
    };
  }

  protected beforeUpdate(id: string, data: StoryUpdateDTO): Record<string, any> {
    const d = data as any;
    const updateData: Record<string, any> = {};
    if (d.content !== undefined) updateData.content = d.content;
    if (d.mediaUrl !== undefined) updateData.mediaUrl = d.mediaUrl;
    if (d.backgroundColor !== undefined) updateData.backgroundColor = d.backgroundColor;
    if (d.textStyle !== undefined) updateData.textStyle = d.textStyle;
    return updateData;
  }
}

export class DynamoStoryRepository extends BaseRepositoryDynamoDB<
  Story,
  StoryCondDTO,
  StoryUpdateDTO,
  typeof TABLE_NAMES.STORIES
> {
  constructor() {
    super(new DynamoStoryQueryRepository(), new DynamoStoryCommandRepository());
  }

  async getActiveByAuthorIds(authorIds: string[]): Promise<Story[]> {
    return (this.queryRepo as DynamoStoryQueryRepository).getActiveByAuthorIds(authorIds);
  }

  async incrementViewersCount(storyId: string): Promise<void> {
    return (this.queryRepo as DynamoStoryQueryRepository).incrementViewersCount(storyId);
  }
}

export class DynamoStoryViewRepository {
  protected toEntity(doc: Record<string, any>): StoryView {
    const { pk, sk, ...rest } = doc;
    return { ...rest } as StoryView;
  }

  async findByStoryAndUser(storyId: string, userId: string): Promise<StoryView | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.STORY_VIEWS),
        KeyConditionExpression: "pk = :pk AND sk = :sk",
        ExpressionAttributeValues: {
          ":pk": `STORY#${storyId}`,
          ":sk": `VIEWER#${userId}`,
        },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async insert(view: StoryView): Promise<void> {
    const docClient = getDocClient();
    await docClient.send(
      new PutCommand({
        TableName: getTableName(TABLE_NAMES.STORY_VIEWS),
        Item: {
          pk: `STORY#${view.storyId}`,
          sk: `VIEWER#${view.userId}`,
          id: view.id,
          storyId: view.storyId,
          userId: view.userId,
          viewedAt: view.viewedAt ? view.viewedAt.toISOString() : new Date().toISOString(),
        },
      }),
    );
  }

  async listByStoryId(storyId: string, paging: PagingDTO): Promise<{ views: StoryView[]; total: number }> {
    const { limit } = paging;
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.STORY_VIEWS),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `STORY#${storyId}` },
        Limit: limit,
        ScanIndexForward: false,
      }),
    );
    const views = (result.Items || []).map((item) => this.toEntity(item));
    return { views, total: views.length };
  }
}
