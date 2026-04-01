import { Post, PostComment, PostReaction, PostCondDTO, PostUpdateDTO } from "@modules/posts/model";
import {
  BaseRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseCommandRepositoryMongoose,
} from "@share/repository/repo-mongoose";
import { PostModel, PostReactionModel, PostCommentModel } from "./dto";
import { PagingDTO } from "@share/model/paging";
import { v7 } from "uuid";

export class MongoPostRepository extends BaseRepositoryMongoose<Post, PostCondDTO, PostUpdateDTO> {
  constructor() {
    super(new MongoPostQueryRepository(), new MongoPostCommandRepository());
  }

  async getFeedByAuthorIds(authorIds: string[], paging: PagingDTO): Promise<{ posts: Post[]; total: number }> {
    const { page, limit } = paging;
    const filter = { authorId: { $in: authorIds } };

    const total = await PostModel.countDocuments(filter).exec();
    const rows = await PostModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const posts = rows.map((doc) => {
      const { _id, __v, ...rest } = doc as any;
      return { ...rest, id: String(_id) } as Post;
    });

    return { posts, total };
  }

  async incrementField(postId: string, field: string, value: number): Promise<void> {
    await PostModel.updateOne({ _id: postId }, { $inc: { [field]: value } }).exec();
  }
}

class MongoPostQueryRepository extends BaseQueryRepositoryMongoose<Post, PostCondDTO> {
  constructor() {
    super(PostModel, { createdAt: -1 });
  }
}

class MongoPostCommandRepository extends BaseCommandRepositoryMongoose<Post, PostUpdateDTO> {
  constructor() {
    super(PostModel);
  }
}

export class MongoPostReactionRepository {
  async findByPostAndUser(postId: string, userId: string): Promise<PostReaction | null> {
    const doc = await PostReactionModel.findOne({ postId, userId }).lean().exec();
    if (!doc) return null;
    const { _id, __v, ...rest } = doc as any;
    return { ...rest, id: String(_id) } as PostReaction;
  }

  async insert(reaction: PostReaction): Promise<void> {
    await PostReactionModel.create({ ...reaction, _id: reaction.id });
  }

  async deleteByPostAndUser(postId: string, userId: string): Promise<boolean> {
    const result = await PostReactionModel.deleteOne({ postId, userId }).exec();
    return result.deletedCount > 0;
  }

  async listByPostId(postId: string, paging: PagingDTO): Promise<{ reactions: PostReaction[]; total: number }> {
    const { page, limit } = paging;
    const filter = { postId };
    const total = await PostReactionModel.countDocuments(filter).exec();
    const rows = await PostReactionModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const reactions = rows.map((doc) => {
      const { _id, __v, ...rest } = doc as any;
      return { ...rest, id: String(_id) } as PostReaction;
    });

    return { reactions, total };
  }
}

export class MongoPostCommentRepository {
  async get(commentId: string): Promise<PostComment | null> {
    const doc = await PostCommentModel.findById(commentId).lean().exec();
    if (!doc) return null;
    const { _id, __v, ...rest } = doc as any;
    return { ...rest, id: String(_id) } as PostComment;
  }

  async insert(comment: PostComment): Promise<void> {
    await PostCommentModel.create({ ...comment, _id: comment.id });
  }

  async deleteById(commentId: string): Promise<void> {
    await PostCommentModel.deleteOne({ _id: commentId }).exec();
  }

  async listByPostId(postId: string, paging: PagingDTO): Promise<{ comments: PostComment[]; total: number }> {
    const { page, limit } = paging;
    const filter = { postId };
    const total = await PostCommentModel.countDocuments(filter).exec();
    const rows = await PostCommentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const comments = rows.map((doc) => {
      const { _id, __v, ...rest } = doc as any;
      return { ...rest, id: String(_id) } as PostComment;
    });

    return { comments, total };
  }
}
