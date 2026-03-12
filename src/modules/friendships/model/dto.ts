import { z } from 'zod';

export const FriendshipCreateSchema = z
  .object({
    userA: z.string(),
    userB: z.string()
  })
  .refine((data) => data.userA !== data.userB, {
    message: 'userA and userB must be different'
  });

export type FriendshipCreateDTO = z.infer<typeof FriendshipCreateSchema>;

export const FriendshipUpdateSchema = z.object({
  // Friendships typically don't need updates
});

export type FriendshipUpdateDTO = z.infer<typeof FriendshipUpdateSchema>;

export const FriendshipCondDTOSchema = z.object({
  userA: z.string().optional(),
  userB: z.string().optional(),
  userId: z.string().optional() // to search for friendships involving this user
});

export type FriendshipCondDTO = z.infer<typeof FriendshipCondDTOSchema>;
