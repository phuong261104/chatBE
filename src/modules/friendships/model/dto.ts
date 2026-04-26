import { z } from 'zod';
import { Friendship, FriendshipStatus } from './model';

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

export const MutualFriendDTOSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  mutualFriendsCount: z.number()
});

export type MutualFriendDTO = z.infer<typeof MutualFriendDTOSchema>;

export const FriendSuggestionDTOSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  mutualFriendsCount: z.number(),
  mutualFriendIds: z.array(z.string())
});

export type FriendSuggestionDTO = z.infer<typeof FriendSuggestionDTOSchema>;

export const GetFriendsListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(["newest", "oldest"]).default("newest"),
});

export type GetFriendsListQuery = z.infer<typeof GetFriendsListQuerySchema>;

export interface GetFriendsListResult {
  friends: FriendDTO[];
  nextCursor: string;
  hasMore: boolean;
}

export interface FriendDTO {
  id: string;
  userId: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  status: FriendshipStatus;
  createdAt: Date;
}
