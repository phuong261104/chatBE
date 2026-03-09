import { Schema, model } from 'mongoose';
import { FriendRequestStatus } from '@modules/friend-requests/model/model';

interface IFriendRequestDocument {
  _id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: Date;
  respondedAt?: Date;
}

const FriendRequestSchema = new Schema<IFriendRequestDocument>(
  {
    _id: {
      type: String,
      required: true
    },
    fromUserId: {
      type: String,
      required: true,
      ref: 'User'
    },
    toUserId: {
      type: String,
      required: true,
      ref: 'User'
    },
    status: {
      type: String,
      enum: Object.values(FriendRequestStatus),
      required: true,
      default: FriendRequestStatus.PENDING
    },
    respondedAt: {
      type: Date,
      required: false
    }
  },
  {
    timestamps: true,
    collection: 'friend_requests'
  }
);

// Indexes
FriendRequestSchema.index({ fromUserId: 1, toUserId: 1 });
FriendRequestSchema.index({ toUserId: 1, status: 1 });
FriendRequestSchema.index({ fromUserId: 1, status: 1 });

export const FriendRequestModel = model<IFriendRequestDocument>('FriendRequest', FriendRequestSchema);

export const modelName = 'FriendRequest';
