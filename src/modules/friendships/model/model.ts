import { z } from 'zod';

export const FriendshipSchema = z.object({
  id: z.string(),
  userA: z.string(), // min(userId1, userId2)
  userB: z.string(), // max(userId1, userId2)
  createdAt: z.date()
});

export type Friendship = z.infer<typeof FriendshipSchema>;
