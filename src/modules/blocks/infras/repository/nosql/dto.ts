import { Schema, model } from 'mongoose';

interface IBlockDocument {
  _id: string;
  blockerId: string;
  blockedUserId: string;
  createdAt: Date;
}

const BlockSchema = new Schema<IBlockDocument>(
  {
    _id: {
      type: String,
      required: true
    },
    blockerId: {
      type: String,
      required: true,
      ref: 'User'
    },
    blockedUserId: {
      type: String,
      required: true,
      ref: 'User'
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'blocks'
  }
);

BlockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });
BlockSchema.index({ blockerId: 1 });
BlockSchema.index({ blockedUserId: 1 });

export const BlockModel = model<IBlockDocument>('Block', BlockSchema);

export const modelName = 'Block';
