import { AppError } from '@share/app-error';
import { ErrDataNotFound } from '@share/model/base-error';
import { PagingDTO } from '@share/model/paging';
import { v7 } from 'uuid';
import { IBlockUseCase } from '../interface';
import {
  Block,
  BlockCondDTO,
  BlockCreateDTO,
  BlockCreateSchema,
  BlockUpdateDTO,
  ErrAlreadyBlocked,
  ErrBlockNotFound,
  ErrCannotBlockYourself,
  ErrBlockedUserNotFound
} from '../model';
import { FriendRequestStatus } from '@modules/friend-requests/model/model';

export class BlockUseCase implements IBlockUseCase {
  constructor(
    private readonly repository: any,
    private readonly userRepository: any,
    private readonly friendshipRepository: any,
    private readonly friendRequestRepository: any
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

  async getBlockedUsers(blockerId: string): Promise<Block[]> {
    return await this.repository.findAllByCond({ blockerId });
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
}
