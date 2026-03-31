import { z } from 'zod';
import { FriendRequestStatus } from './model';

export const FriendRequestCreateSchema = z.object({
  fromUserId: z.string(),
  toUserId: z.string()
});

export type FriendRequestCreateDTO = z.infer<typeof FriendRequestCreateSchema>;

export const FriendRequestUpdateSchema = z.object({
  status: z.nativeEnum(FriendRequestStatus),
  respondedAt: z.date().optional()
});

export type FriendRequestUpdateDTO = z.infer<typeof FriendRequestUpdateSchema>;

export const FriendRequestCondDTOSchema = z.object({
  fromUserId: z.string().optional(),
  toUserId: z.string().optional(),
  status: z.nativeEnum(FriendRequestStatus).optional(),
  $or: z.array(z.record(z.string())).optional()
});

export type FriendRequestCondDTO = z.infer<typeof FriendRequestCondDTOSchema>;
