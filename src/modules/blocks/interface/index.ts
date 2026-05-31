import { IRepository, IUseCase } from '@share/interface';
import { PagingDTO } from '@share/model/paging';
import { User } from '@modules/user/model/model';
import { FriendRequest } from '@modules/friend-requests/model/model';
import { FriendRequestCondDTO } from '@modules/friend-requests/model/dto';
import {
  Block,
  BlockCondDTO,
  BlockCreateDTO,
  BlockCursorListQuery,
  BlockCursorPage,
  BlockWithUser,
  BlockWithUserCursorListResult,
  BlockUpdateDTO,
} from '../model';

export interface IBlockRepository extends IRepository<Block, BlockCondDTO, BlockUpdateDTO> {
  deleteByCondition(cond: BlockCondDTO): Promise<boolean>;
  findAllByCond(cond: BlockCondDTO): Promise<Block[]>;
  findAllByCondWithCursor(
    cond: BlockCondDTO,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<BlockCursorPage>;
}

export interface IBlockUserRepository {
  get(id: string): Promise<User | null>;
  listByIds?(ids: string[]): Promise<User[]>;
}

export interface IBlockFriendshipRepository {
  findByCond?(cond: { userA: string; userB: string }): Promise<{ status?: string } | null>;
  softDeleteFriendship(userA: string, userB: string): Promise<boolean>;
}

export interface IBlockFriendRequestRepository {
  list(cond: FriendRequestCondDTO, paging: PagingDTO): Promise<FriendRequest[]>;
  delete(id: string, isHard: boolean): Promise<boolean>;
}

export interface IBlockUseCase extends IUseCase<BlockCreateDTO, BlockUpdateDTO, Block, BlockCondDTO> {
  blockUser(blockerId: string, blockedUserId: string): Promise<string>;
  unblockUser(blockerId: string, blockedUserId: string): Promise<boolean>;
  isBlocked(blockerId: string, blockedUserId: string): Promise<boolean>;
  getBlockedUsers(blockerId: string): Promise<BlockWithUser[]>;
  getBlockedUsersCursor(
    blockerId: string,
    query: BlockCursorListQuery,
  ): Promise<BlockWithUserCursorListResult>;
}
