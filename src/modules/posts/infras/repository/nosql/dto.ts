import { Schema, model } from "mongoose";

interface IPostDocument {
  _id: string;
  authorId: string;
  content: string;
  media: { url: string; type: string; thumbnail?: string }[];
  privacy: string;
  reactionsCount: number;
  commentsCount: number;
  sharesCount: number;
  sharedPostId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PostMongoSchema = new Schema<IPostDocument>(
  {
    _id: { type: String, required: true },
    authorId: { type: String, required: true, ref: "User", index: true },
    content: { type: String, default: "" },
    media: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "video"], required: true },
        thumbnail: { type: String },
      },
    ],
    privacy: { type: String, enum: ["public", "friends", "private"], default: "friends" },
    reactionsCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    sharedPostId: { type: String, ref: "Post" },
  },
  { timestamps: true, collection: "posts" },
);

PostMongoSchema.index({ authorId: 1, createdAt: -1 });
PostMongoSchema.index({ createdAt: -1 });

export const PostModel = model<IPostDocument>("Post", PostMongoSchema);

interface IPostReactionDocument {
  _id: string;
  postId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

const PostReactionMongoSchema = new Schema<IPostReactionDocument>(
  {
    _id: { type: String, required: true },
    postId: { type: String, required: true, ref: "Post", index: true },
    userId: { type: String, required: true, ref: "User" },
    emoji: { type: String, enum: ["like", "love", "haha", "wow", "sad", "angry"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "post_reactions" },
);

PostReactionMongoSchema.index({ postId: 1, userId: 1 }, { unique: true });

export const PostReactionModel = model<IPostReactionDocument>("PostReaction", PostReactionMongoSchema);

interface IPostCommentDocument {
  _id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const PostCommentMongoSchema = new Schema<IPostCommentDocument>(
  {
    _id: { type: String, required: true },
    postId: { type: String, required: true, ref: "Post", index: true },
    userId: { type: String, required: true, ref: "User" },
    content: { type: String, required: true },
  },
  { timestamps: true, collection: "post_comments" },
);

PostCommentMongoSchema.index({ postId: 1, createdAt: -1 });

export const PostCommentModel = model<IPostCommentDocument>("PostComment", PostCommentMongoSchema);
