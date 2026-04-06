import { Post, PostComment, PostReaction } from "@modules/posts/model/model";
import { PostCondDTO, PostUpdateDTO } from "@modules/posts/model/dto";
import { PagingDTO } from "@share/model/paging";
import {
  BaseQueryRepositoryDynamoDB,
  BaseCommandRepositoryDynamoDB,
  BaseRepositoryDynamoDB,
} from "@share/repository/dynamodb/repo-dynamodb";
import { getTableName, getDocClient } from "@share/repository/dynamodb/client";
import { PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

class DynamoPostQueryRepository extends BaseQueryRepositoryDynamoDB<Post, PostCondDTO, typeof TABLE_NAMES.POSTS> {
  constructor() {
    super(TABLE_NAMES.POSTS, { createdAt: -1 });
  }

  protected toEntity(doc: Record<string, any>): Post {
    const { pk, sk, GSI1PK, GSI1SK, ...rest } = doc;
    return { ...rest } as Post;
  }

  protected buildFilterExpression(cond: PostCondDTO): string {
    const conditions: string[] = [];
    const c = cond as any;
    if (c.authorId) conditions.push("authorId = :authorId");
    if (c.privacy) conditions.push("privacy = :privacy");
    return conditions.join(" AND ");
  }

  protected buildAttributeValues(cond: PostCondDTO): Record<string, any> {
    const values: Record<string, any> = {};
    const c = cond as any;
    if (c.authorId) values[":authorId"] = c.authorId;
    if (c.privacy) values[":privacy"] = c.privacy;
    return values;
  }

  async getFeedByAuthorIds(authorIds: string[], paging: PagingDTO): Promise<{ posts: Post[]; total: number }> {
    const { limit } = paging;
    const docClient = getDocClient();

    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.POSTS),
        FilterExpression: "authorId IN (:authorIds)",
        ExpressionAttributeValues: {
          ":authorIds": authorIds,
        },
        Limit: limit,
      }),
    );

    const posts = (result.Items || []).map((item) => this.toEntity(item));
    return { posts, total: posts.length };
  }
}

class DynamoPostCommandRepository extends BaseCommandRepositoryDynamoDB<Post, PostUpdateDTO, typeof TABLE_NAMES.POSTS> {
  constructor() {
    super(TABLE_NAMES.POSTS, true);
  }

  protected beforeInsert(data: Post): Record<string, any> {
    const d = data as any;
    const now = new Date().toISOString();
    return {
      id: d.id,
      authorId: d.authorId,
      content: d.content || "",
      media: d.media || [],
      privacy: d.privacy,
      reactionsCount: d.reactionsCount || 0,
      commentsCount: d.commentsCount || 0,
      sharesCount: d.sharesCount || 0,
      sharedPostId: d.sharedPostId,
      createdAt: d.createdAt ? d.createdAt.toISOString() : now,
      updatedAt: now,
      GSI1PK: `AUTHOR#${d.authorId}`,
      GSI1SK: now,
    };
  }

  protected beforeUpdate(id: string, data: PostUpdateDTO): Record<string, any> {
    const d = data as any;
    const updateData: Record<string, any> = {};
    if (d.content !== undefined) updateData.content = d.content;
    if (d.media !== undefined) updateData.media = d.media;
    if (d.privacy !== undefined) updateData.privacy = d.privacy;
    if (d.reactionsCount !== undefined) updateData.reactionsCount = d.reactionsCount;
    if (d.commentsCount !== undefined) updateData.commentsCount = d.commentsCount;
    if (d.sharesCount !== undefined) updateData.sharesCount = d.sharesCount;
    return updateData;
  }

  async incrementField(postId: string, field: string, value: number): Promise<void> {
    const docClient = getDocClient();
    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(TABLE_NAMES.POSTS),
        Key: { id: postId },
        UpdateExpression: `SET #field = if_not_exists(#field, :zero) + :value`,
        ExpressionAttributeNames: { "#field": field },
        ExpressionAttributeValues: { ":value": value, ":zero": 0 },
      }),
    );
  }
}

export class DynamoPostRepository extends BaseRepositoryDynamoDB<Post, PostCondDTO, PostUpdateDTO, typeof TABLE_NAMES.POSTS> {
  constructor() {
    super(new DynamoPostQueryRepository(), new DynamoPostCommandRepository());
  }
}

export class DynamoPostReactionRepository {
  protected toEntity(doc: Record<string, any>): PostReaction {
    const { pk, sk, ...rest } = doc;
    return { ...rest } as PostReaction;
  }

  async findByPostAndUser(postId: string, userId: string): Promise<PostReaction | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.POST_REACTIONS),
        KeyConditionExpression: "pk = :pk AND sk = :sk",
        ExpressionAttributeValues: {
          ":pk": `POST#${postId}`,
          ":sk": `USER#${userId}`,
        },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async insert(reaction: PostReaction): Promise<void> {
    const docClient = getDocClient();
    await docClient.send(
      new PutCommand({
        TableName: getTableName(TABLE_NAMES.POST_REACTIONS),
        Item: {
          pk: `POST#${reaction.postId}`,
          sk: `USER#${reaction.userId}`,
          id: reaction.id,
          postId: reaction.postId,
          userId: reaction.userId,
          emoji: reaction.emoji,
          createdAt: reaction.createdAt ? reaction.createdAt.toISOString() : new Date().toISOString(),
        },
      }),
    );
  }

  async deleteByPostAndUser(postId: string, userId: string): Promise<boolean> {
    const docClient = getDocClient();
    await docClient.send(
      new DeleteCommand({
        TableName: getTableName(TABLE_NAMES.POST_REACTIONS),
        Key: { pk: `POST#${postId}`, sk: `USER#${userId}` },
      }),
    );
    return true;
  }

  async listByPostId(postId: string, paging: PagingDTO): Promise<{ reactions: PostReaction[]; total: number }> {
    const { limit } = paging;
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.POST_REACTIONS),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `POST#${postId}` },
        Limit: limit,
      }),
    );
    const reactions = (result.Items || []).map((item) => this.toEntity(item));
    return { reactions, total: reactions.length };
  }
}

export class DynamoPostCommentRepository {
  protected toEntity(doc: Record<string, any>): PostComment {
    const { pk, sk, ...rest } = doc;
    return { ...rest } as PostComment;
  }

  async get(commentId: string): Promise<PostComment | null> {
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.POST_COMMENTS),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `POST#${commentId.split("-")[0] || commentId}`,
          ":skPrefix": "CMT#",
        },
        Limit: 1,
      }),
    );
    return result.Items && result.Items.length > 0 ? this.toEntity(result.Items[0]) : null;
  }

  async insert(comment: PostComment): Promise<void> {
    const docClient = getDocClient();
    const now = comment.createdAt ? comment.createdAt.toISOString() : new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: getTableName(TABLE_NAMES.POST_COMMENTS),
        Item: {
          pk: `POST#${comment.postId}`,
          sk: `CMT#${now}#${comment.id}`,
          id: comment.id,
          postId: comment.postId,
          userId: comment.userId,
          content: comment.content,
          createdAt: now,
          updatedAt: comment.updatedAt ? comment.updatedAt.toISOString() : now,
        },
      }),
    );
  }

  async deleteById(commentId: string): Promise<void> {
    const docClient = getDocClient();
    await docClient.send(
      new DeleteCommand({
        TableName: getTableName(TABLE_NAMES.POST_COMMENTS),
        Key: { pk: "POST#TEMP", sk: `CMT#${commentId}` },
      }),
    );
  }

  async listByPostId(postId: string, paging: PagingDTO): Promise<{ comments: PostComment[]; total: number }> {
    const { limit } = paging;
    const docClient = getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: getTableName(TABLE_NAMES.POST_COMMENTS),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `POST#${postId}` },
        Limit: limit,
        ScanIndexForward: false,
      }),
    );
    const comments = (result.Items || []).map((item) => this.toEntity(item));
    return { comments, total: comments.length };
  }
}
