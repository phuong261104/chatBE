import { z } from 'zod';

export enum FriendRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELED = 'canceled'
}

export const FriendRequestSchema = z.object({
  id: z.string(),
  fromUserId: z.string(),
  toUserId: z.string(),
  status: z.nativeEnum(FriendRequestStatus),
  createdAt: z.date(),
  respondedAt: z.date().optional()
});

export type FriendRequest = z.infer<typeof FriendRequestSchema>;
