import { AppError } from '@share/app-error';
import { ErrDataNotFound } from '@share/model/base-error';
import { PagingDTO } from '@share/model/paging';
import { v7 } from 'uuid';
import { UserInfoVisibility, type User } from '@modules/user/model/model';
import {
  IBlockFriendRequestRepository,
  IBlockFriendshipRepository,
  IBlockRepository,
  IBlockUseCase,
  IBlockUserRepository,
} from '../interface';
import {
  Block,
  BlockCondDTO,
  BlockCreateDTO,
  BlockCursorListQuery,
  BlockCreateSchema,
  BlockUpdateDTO,
  BlockWithUser,
  BlockWithUserCursorListResult,
  ErrAlreadyBlocked,
  ErrBlockNotFound,
  ErrCannotBlockYourself,
  ErrBlockedUserNotFound
} from '../model';
import { FriendRequestStatus } from '@modules/friend-requests/model/model';

export class BlockUseCase implements IBlockUseCase {
  constructor(
    private readonly repository: IBlockRepository,
    private readonly userRepository: IBlockUserRepository,
    private readonly friendshipRepository: IBlockFriendshipRepository,
    private readonly friendRequestRepository: IBlockFriendRequestRepository
  ) {}

  async blockUser(blockerId: string, blockedUserId: string): Promise<string> {
    if (blockerId === blockedUserId) {
      throw AppError.from(ErrCannotBlockYourself, 400);
    }

    const blockedUser = await this.userRepository.get(blockedUserId);
    if (!blockedUser) {
      throw AppError.from(ErrBlockedUserNotFound, 404);
    }

    const existingBlock = await this.repository.findByCond({
      blockerId,
      blockedUserId
    });

    if (existingBlock) {
      throw AppError.from(ErrAlreadyBlocked, 400);
    }

    const [userA, userB] = [blockerId, blockedUserId].sort();
    await this.friendshipRepository.softDeleteFriendship(userA, userB);

    const requests = await this.friendRequestRepository.list(
      {
        fromUserId: blockerId,
        toUserId: blockedUserId,
        status: FriendRequestStatus.PENDING
      },
      { page: 1, limit: 100 }
    );

    const reverseRequests = await this.friendRequestRepository.list(
      {
        fromUserId: blockedUserId,
        toUserId: blockerId,
        status: FriendRequestStatus.PENDING
      },
      { page: 1, limit: 100 }
    );

    if (requests.length + reverseRequests.length > 0) {
      await Promise.allSettled(
        [...requests, ...reverseRequests].map(r => this.friendRequestRepository.delete(r.id, true))
      );
    }

    const newId = v7();
    const newBlock: Block = {
      id: newId,
      blockerId,
      blockedUserId,
      createdAt: new Date()
    };

    await this.repository.insert(newBlock);

    return newId;
  }

  async unblockUser(blockerId: string, blockedUserId: string): Promise<boolean> {
    const result = await this.repository.deleteByCondition({
      blockerId,
      blockedUserId
    });

    if (!result) {
      throw AppError.from(ErrBlockNotFound, 404);
    }

    return true;
  }

  async isBlocked(blockerId: string, blockedUserId: string): Promise<boolean> {
    const block = await this.repository.findByCond({
      blockerId,
      blockedUserId
    });

    return !!block;
  }

  async getBlockedUsers(blockerId: string): Promise<BlockWithUser[]> {
    const blocks = await this.repository.findAllByCond({ blockerId });
    return this.hydrateBlockedUsers(blockerId, blocks);
  }

  async getBlockedUsersCursor(
    blockerId: string,
    query: BlockCursorListQuery,
  ): Promise<BlockWithUserCursorListResult> {
    const result = await this.repository.findAllByCondWithCursor(
      { blockerId },
      query.cursor,
      query.limit,
    );
    return {
      ...result,
      items: await this.hydrateBlockedUsers(blockerId, result.items),
      limit: query.limit,
    };
  }

  async create(data: BlockCreateDTO & { blockerId: string }): Promise<string> {
    const dto = BlockCreateSchema.parse(data);
    return await this.blockUser(data.blockerId, dto.blockedUserId);
  }

  async getDetail(id: string): Promise<Block | null> {
    const data = await this.repository.get(id);
    if (!data) {
      throw ErrDataNotFound;
    }
    return data;
  }

  async update(id: string, data: BlockUpdateDTO): Promise<boolean> {
    throw new Error('Blocks cannot be updated');
  }

  async list(cond: BlockCondDTO, paging: PagingDTO): Promise<Block[]> {
    return await this.repository.list(cond, paging);
  }

  async delete(id: string): Promise<boolean> {
    await this.repository.delete(id, true);
    return true;
  }

  private async hydrateBlockedUsers(blockerId: string, blocks: Block[]): Promise<BlockWithUser[]> {
    if (blocks.length === 0) {
      return [];
    }

    const blockedUserIds = Array.from(new Set(blocks.map((block) => block.blockedUserId)));
    const users = await this.loadUsersByIds(blockedUserIds);
    const userMap = new Map(users.map((user) => [user.id, user]));
    const emailVisibleUserIds = await this.getEmailVisibleUserIds(blockerId, users);
    const phoneVisibleUserIds = await this.getPhoneVisibleUserIds(blockerId, users);

    return blocks.map((block) => {
      const blockedUser = userMap.get(block.blockedUserId);
      const isUnavailable = !blockedUser || (blockedUser as any).status === 'deleted';

      return {
        ...block,
        blockedUser: isUnavailable
          ? null
          : this.toBlockedUserSummary(
              blockedUser,
              emailVisibleUserIds.has(blockedUser.id),
              phoneVisibleUserIds.has(blockedUser.id),
            ),
        blockedUserUnavailable: isUnavailable,
      };
    });
  }

  private async loadUsersByIds(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) {
      return [];
    }

    if (typeof this.userRepository.listByIds === 'function') {
      return this.userRepository.listByIds(userIds);
    }

    const users = await Promise.all(userIds.map((userId) => this.userRepository.get(userId)));
    return users.filter((user): user is User => !!user);
  }

  private async getEmailVisibleUserIds(blockerId: string, users: User[]): Promise<Set<string>> {
    const visibleUserIds = new Set<string>();
    const usersWithEmail = users.filter((user) => !!(user as any).email);

    for (const user of usersWithEmail) {
      if (user.id === blockerId) {
        visibleUserIds.add(user.id);
      }
    }

    if (typeof this.friendshipRepository.findByCond !== 'function') {
      return visibleUserIds;
    }

    await Promise.all(
      usersWithEmail
        .filter((user) => user.id !== blockerId)
        .map(async (user) => {
          const [userA, userB] = [blockerId, user.id].sort();
          const friendship = await this.friendshipRepository.findByCond?.({ userA, userB });
          if (friendship?.status === 'active') {
            visibleUserIds.add(user.id);
          }
        }),
    );

    return visibleUserIds;
  }

  private async getPhoneVisibleUserIds(blockerId: string, users: User[]): Promise<Set<string>> {
    const visibleUserIds = new Set<string>();
    const friendshipVisibleUsers: User[] = [];

    for (const user of users) {
      if (!user.phone) {
        continue;
      }

      const phoneVisibility = user.privacy?.phoneVisibility || UserInfoVisibility.FRIENDS;
      if (user.id === blockerId || phoneVisibility === UserInfoVisibility.EVERYONE) {
        visibleUserIds.add(user.id);
      } else if (phoneVisibility === UserInfoVisibility.FRIENDS) {
        friendshipVisibleUsers.push(user);
      }
    }

    if (typeof this.friendshipRepository.findByCond !== 'function') {
      return visibleUserIds;
    }

    await Promise.all(
      friendshipVisibleUsers.map(async (user) => {
        const [userA, userB] = [blockerId, user.id].sort();
        const friendship = await this.friendshipRepository.findByCond?.({ userA, userB });
        if (friendship?.status === 'active') {
          visibleUserIds.add(user.id);
        }
      }),
    );

    return visibleUserIds;
  }

  private toBlockedUserSummary(user: User, canViewEmail: boolean, canViewPhone: boolean) {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      coverUrl: (user as any).coverUrl,
      bio: user.bio,
      verified: user.verified,
      status: user.status,
      email: canViewEmail ? (user as any).email : undefined,
      phone: canViewPhone ? user.phone : undefined,
    };
  }
}
