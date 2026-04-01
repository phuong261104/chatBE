import { Schema, model } from "mongoose";

interface IStoryDocument {
  _id: string;
  authorId: string;
  type: string;
  content?: string;
  mediaUrl?: string;
  backgroundColor?: string;
  textStyle?: string;
  viewersCount: number;
  expiresAt: Date;
  createdAt: Date;
}

const StoryMongoSchema = new Schema<IStoryDocument>(
  {
    _id: { type: String, required: true },
    authorId: { type: String, required: true, ref: "User", index: true },
    type: { type: String, enum: ["image", "video", "text"], required: true },
    content: { type: String },
    mediaUrl: { type: String },
    backgroundColor: { type: String },
    textStyle: { type: String },
    viewersCount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "stories" },
);

StoryMongoSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
StoryMongoSchema.index({ authorId: 1, createdAt: -1 });

export const StoryModel = model<IStoryDocument>("Story", StoryMongoSchema);

interface IStoryViewDocument {
  _id: string;
  storyId: string;
  userId: string;
  viewedAt: Date;
}

const StoryViewMongoSchema = new Schema<IStoryViewDocument>(
  {
    _id: { type: String, required: true },
    storyId: { type: String, required: true, ref: "Story", index: true },
    userId: { type: String, required: true, ref: "User" },
    viewedAt: { type: Date, required: true },
  },
  { collection: "story_views" },
);

StoryViewMongoSchema.index({ storyId: 1, userId: 1 }, { unique: true });

export const StoryViewModel = model<IStoryViewDocument>("StoryView", StoryViewMongoSchema);
