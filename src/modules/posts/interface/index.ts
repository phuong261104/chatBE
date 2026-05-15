import { Post, PostComment, PostReaction, CreatePostDTO, CreateCommentDTO, ReactPostDTO, SharePostDTO } from "../model";
import { PagingDTO } from "@share/model/paging";

export interface IPostUseCase {
  createPost(userId: string, data: CreatePostDTO): Promise<Post>;
  getFeed(userId: string, paging: PagingDTO): Promise<{ posts: Post[]; total: number }>;
  getPostById(userId: string, postId: string): Promise<Post>;
  deletePost(userId: string, postId: string): Promise<void>;
  reactPost(userId: string, postId: string, data: ReactPostDTO): Promise<{ action: "added" | "removed" }>;
  getComments(userId: string, postId: string, paging: PagingDTO): Promise<{ comments: PostComment[]; total: number }>;
  addComment(userId: string, postId: string, data: CreateCommentDTO): Promise<PostComment>;
  deleteComment(userId: string, postId: string, commentId: string): Promise<void>;
  sharePost(userId: string, postId: string, data: SharePostDTO): Promise<Post>;
}
