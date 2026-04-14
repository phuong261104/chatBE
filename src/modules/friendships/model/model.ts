import { z } from 'zod';

export enum FriendshipStatus {
  ACTIVE = "active",
  DELETED = "deleted",
}

export const FriendshipSchema = z.object({
  id: z.string(),
  userA: z.string(),
  userB: z.string(),
  status: z.nativeEnum(FriendshipStatus).default(FriendshipStatus.ACTIVE),
  createdAt: z.date()
});

export type Friendship = z.infer<typeof FriendshipSchema>;
