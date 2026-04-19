import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import { IPostUseCase } from "../interface";
import {
  Post,
  PostComment,
  PostPrivacy,
  createPostDTOSchema,
  reactPostDTOSchema,
  createCommentDTOSchema,
  sharePostDTOSchema,
  CreatePostDTO,
  ReactPostDTO,
  CreateCommentDTO,
  SharePostDTO,
  ErrPostNotFound,
  ErrPostUnauthorized,
  ErrCommentNotFound,
  ErrCommentUnauthorized,
  ErrCannotShareSharedPost,
} from "../model";
import { PagingDTO } from "@share/model/paging";
import { DynamoPostRepository, DynamoPostReactionRepository, DynamoPostCommentRepository } from "../infras/repository/dynamodb";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";

export class PostUseCase implements IPostUseCase {
  constructor(
    private readonly postRepo: DynamoPostRepository,
    private readonly reactionRepo: DynamoPostReactionRepository,
    private readonly commentRepo: DynamoPostCommentRepository,
    private readonly friendshipRepo: DynamoFriendshipRepository,
  ) {}

  async createPost(userId: string, data: CreatePostDTO): Promise<Post> {
    const validated = createPostDTOSchema.parse(data);
    const now = new Date();

    const post: Post = {
      id: v7(),
      authorId: userId,
      content: validated.content,
      media: validated.media,
      privacy: validated.privacy,
      reactionsCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.postRepo.insert(post);
    return post;
  }

  async getFeed(userId: string, paging: PagingDTO): Promise<{ posts: Post[]; total: number }> {
    const friendIds = await this.friendshipRepo.getFriendIds(userId);
    const authorIds = [userId, ...friendIds];
    return this.postRepo.getFeedByAuthorIds(authorIds, paging);
  }

  async getPostById(userId: string, postId: string): Promise<Post> {
    const post = await this.postRepo.get(postId);
    if (!post) throw AppError.from(ErrPostNotFound, 404);

    if (post.privacy === PostPrivacy.PRIVATE && post.authorId !== userId) {
      throw AppError.from(ErrPostUnauthorized, 403);
    }

    if (post.privacy === PostPrivacy.FRIENDS && post.authorId !== userId) {
      const friendIds = await this.friendshipRepo.getFriendIds(userId);
      if (!friendIds.includes(post.authorId)) {
        throw AppError.from(ErrPostUnauthorized, 403);
      }
    }

    return post;
  }

  async deletePost(userId: string, postId: string): Promise<void> {
    const post = await this.postRepo.get(postId);
    if (!post) throw AppError.from(ErrPostNotFound, 404);
    if (post.authorId !== userId) throw AppError.from(ErrPostUnauthorized, 403);
    await this.postRepo.delete(postId, true);
  }

  async reactPost(userId: string, postId: string, data: ReactPostDTO): Promise<{ action: "added" | "removed" }> {
    const validated = reactPostDTOSchema.parse(data);
    const post = await this.postRepo.get(postId);
    if (!post) throw AppError.from(ErrPostNotFound, 404);

    const existing = await this.reactionRepo.findByPostAndUser(postId, userId);

    if (existing) {
      await this.reactionRepo.deleteByPostAndUser(postId, userId);
      await this.postRepo.incrementField(postId, "reactionsCount", -1);
      return { action: "removed" };
    }

    await this.reactionRepo.insert({
      id: v7(),
      postId,
      userId,
      emoji: validated.emoji,
      createdAt: new Date(),
    });
    await this.postRepo.incrementField(postId, "reactionsCount", 1);
    return { action: "added" };
  }

  async getComments(postId: string, paging: PagingDTO): Promise<{ comments: PostComment[]; total: number }> {
    const post = await this.postRepo.get(postId);
    if (!post) throw AppError.from(ErrPostNotFound, 404);
    return this.commentRepo.listByPostId(postId, paging);
  }

  async addComment(userId: string, postId: string, data: CreateCommentDTO): Promise<PostComment> {
    const validated = createCommentDTOSchema.parse(data);
    const post = await this.postRepo.get(postId);
    if (!post) throw AppError.from(ErrPostNotFound, 404);

    const now = new Date();
    const comment: PostComment = {
      id: v7(),
      postId,
      userId,
      content: validated.content,
      createdAt: now,
      updatedAt: now,
    };

    await this.commentRepo.insert(comment);
    await this.postRepo.incrementField(postId, "commentsCount", 1);
    return comment;
  }

  async deleteComment(userId: string, postId: string, commentId: string): Promise<void> {
    const post = await this.postRepo.get(postId);
    if (!post) throw AppError.from(ErrPostNotFound, 404);

    const comment = await this.commentRepo.get(commentId);
    if (!comment) throw AppError.from(ErrCommentNotFound, 404);

    if (comment.userId !== userId && post.authorId !== userId) {
      throw AppError.from(ErrCommentUnauthorized, 403);
    }

    await this.commentRepo.deleteById(commentId);
    await this.postRepo.incrementField(postId, "commentsCount", -1);
  }

  async sharePost(userId: string, postId: string, data: SharePostDTO): Promise<Post> {
    const validated = sharePostDTOSchema.parse(data);
    const originalPost = await this.postRepo.get(postId);
    if (!originalPost) throw AppError.from(ErrPostNotFound, 404);
    if (originalPost.sharedPostId) throw AppError.from(ErrCannotShareSharedPost, 400);

    const now = new Date();
    const sharedPost: Post = {
      id: v7(),
      authorId: userId,
      content: validated.content,
      media: [],
      privacy: validated.privacy,
      reactionsCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      sharedPostId: postId,
      createdAt: now,
      updatedAt: now,
    };

    await this.postRepo.insert(sharedPost);
    await this.postRepo.incrementField(postId, "sharesCount", 1);
    return sharedPost;
  }
}
