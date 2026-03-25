import { Schema, model } from "mongoose";

interface ICloudItemDocument {
  _id: string;
  userId: string;
  type: string;
  title: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimetype?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CloudItemMongoSchema = new Schema<ICloudItemDocument>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, ref: "User", index: true },
    type: { type: String, required: true, enum: ["file", "note"] },
    title: { type: String, required: true },
    content: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimetype: { type: String },
  },
  {
    timestamps: true,
    collection: "cloud_items",
  },
);

CloudItemMongoSchema.index({ userId: 1, createdAt: -1 });
CloudItemMongoSchema.index({ userId: 1, type: 1 });

export const CloudItemModel = model<ICloudItemDocument>(
  "CloudItem",
  CloudItemMongoSchema,
);
