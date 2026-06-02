import { z } from 'zod';
import type { Block } from './model';
import type { User } from '@modules/user/model/model';

export const BlockCreateSchema = z
  .object({
    blockerId: z.string(),
    blockedUserId: z.string()
  })
  .refine((data) => data.blockerId !== data.blockedUserId, {
    message: 'Cannot block yourself'
  });

export type BlockCreateDTO = z.infer<typeof BlockCreateSchema>;

export const BlockUpdateSchema = z.object({});

export type BlockUpdateDTO = z.infer<typeof BlockUpdateSchema>;

export const BlockCondDTOSchema = z.object({
  blockerId: z.string().optional(),
  blockedUserId: z.string().optional()
});

export type BlockCondDTO = z.infer<typeof BlockCondDTOSchema>;

export const BlockCursorListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type BlockCursorListQuery = z.infer<typeof BlockCursorListQuerySchema>;

export interface BlockCursorPage {
  items: Block[];
  nextCursor: string;
  hasMore: boolean;
}

export interface BlockCursorListResult extends BlockCursorPage {
  limit: number;
}

export type BlockedUserSummary = Pick<
  User,
  | 'id'
  | 'displayName'
  | 'username'
  | 'avatarUrl'
  | 'coverUrl'
  | 'bio'
  | 'verified'
  | 'status'
> & {
  email?: string;
  phone?: string;
};

export type BlockWithUser = Block & {
  blockedUser: BlockedUserSummary | null;
  blockedUserUnavailable: boolean;
};

export interface BlockWithUserCursorListResult {
  items: BlockWithUser[];
  nextCursor: string;
  hasMore: boolean;
  limit: number;
}
