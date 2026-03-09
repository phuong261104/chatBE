import { Schema, model } from 'mongoose';

interface IFriendshipDocument {
  _id: string;
  userA: string; // min(userId1, userId2)
  userB: string; // max(userId1, userId2)
  createdAt: Date;
}

const FriendshipSchema = new Schema<IFriendshipDocument>(
  {
    _id: {
      type: String,
      required: true
    },
    userA: {
      type: String,
      required: true,
      ref: 'User'
    },
    userB: {
      type: String,
      required: true,
      ref: 'User'
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'friendships'
  }
);

// Indexes
FriendshipSchema.index({ userA: 1, userB: 1 }, { unique: true });
FriendshipSchema.index({ userA: 1 });
FriendshipSchema.index({ userB: 1 });

export const FriendshipModel = model<IFriendshipDocument>('Friendship', FriendshipSchema);

export const modelName = 'Friendship';
