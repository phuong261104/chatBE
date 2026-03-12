import { AppError } from '@share/app-error';
import { ErrDataNotFound } from '@share/model/base-error';
import { PagingDTO } from '@share/model/paging';
import { v7 } from 'uuid';
import { IFriendRequestUseCase } from '../interface';
import {
  FriendRequest,
  FriendRequestStatus,
  FriendRequestCondDTO,
  FriendRequestCreateDTO,
  FriendRequestCreateSchema,
  FriendRequestUpdateDTO,
  ErrFriendRequestAlreadyExists,
  ErrFriendRequestAlreadyFriends,
  ErrFriendRequestNotFound,
  ErrFriendRequestSelfRequest,
  ErrFriendRequestUnauthorized,
  ErrFriendRequestUserBlocked
} from '../model';
import { MongoFriendRequestRepository } from '../infras/repository';
import { MongoBlockRepository } from '@modules/blocks/infras/repository/nosql/mongodb-repo';
import { MongoFriendshipRepository } from '@modules/friendships/infras/repository/nosql/mongodb-repo';
import { MongoUserRepository } from '@modules/user/infras/repository/nosql/mongodb-repo';

export class FriendRequestUseCase implements IFriendRequestUseCase {
  constructor(
    private readonly repository: MongoFriendRequestRepository,
    private readonly blockRepository: MongoBlockRepository,
    private readonly friendshipRepository: MongoFriendshipRepository,
    private readonly userRepository: MongoUserRepository
  ) {}

  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<string> {
    if (fromUserId === toUserId) {
      throw AppError.from(ErrFriendRequestSelfRequest, 400);
    }

    const toUser = await this.userRepository.get(toUserId);
    if (!toUser) {
      throw AppError.from(new Error('Target user does not exist'), 404);
    }

    const blockExists = await this.blockRepository.findByCond({
      blockerId: fromUserId,
      blockedUserId: toUserId
    });

    const reverseBlockExists = await this.blockRepository.findByCond({
      blockerId: toUserId,
      blockedUserId: fromUserId
    });

    if (blockExists || reverseBlockExists) {
      throw AppError.from(ErrFriendRequestUserBlocked, 400);
    }

    const [userA, userB] = [fromUserId, toUserId].sort();
    const friendship = await this.friendshipRepository.findByCond({
      userA,
      userB
    });

    if (friendship) {
      throw AppError.from(ErrFriendRequestAlreadyFriends, 400);
    }

    const existingRequest = await this.repository.findByCond({
      fromUserId,
      toUserId,
      status: FriendRequestStatus.PENDING
    });

    if (existingRequest) {
      throw AppError.from(ErrFriendRequestAlreadyExists, 400);
    }

    const reverseRequest = await this.repository.findByCond({
      fromUserId: toUserId,
      toUserId: fromUserId,
      status: FriendRequestStatus.PENDING
    });

    if (reverseRequest) {
      throw AppError.from(ErrFriendRequestAlreadyExists, 400).withLog('Reverse request exists');
    }

    const newId = v7();
    const newRequest: FriendRequest = {
      id: newId,
      fromUserId,
      toUserId,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date()
    };

    await this.repository.insert(newRequest);

    return newId;
  }

  async acceptFriendRequest(requestId: string, userId: string): Promise<boolean> {
    const request = await this.repository.get(requestId);
    if (!request) {
      throw AppError.from(ErrFriendRequestNotFound, 404);
    }

    if (request.toUserId !== userId) {
      throw AppError.from(ErrFriendRequestUnauthorized, 403);
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw AppError.from(new Error('Friend request is not pending'), 400);
    }

    const blockExists = await this.blockRepository.findByCond({
      blockerId: request.fromUserId,
      blockedUserId: request.toUserId
    });

    const reverseBlockExists = await this.blockRepository.findByCond({
      blockerId: request.toUserId,
      blockedUserId: request.fromUserId
    });

    if (blockExists || reverseBlockExists) {
      throw AppError.from(ErrFriendRequestUserBlocked, 400);
    }

    const [userA, userB] = [request.fromUserId, request.toUserId].sort();
    const existingFriendship = await this.friendshipRepository.findByCond({
      userA,
      userB
    });

    if (existingFriendship) {
      throw AppError.from(ErrFriendRequestAlreadyFriends, 400);
    }

    await this.repository.update(requestId, {
      status: FriendRequestStatus.ACCEPTED,
      respondedAt: new Date()
    });

    const friendshipId = v7();

    await this.friendshipRepository.insert({
      id: friendshipId,
      userA,
      userB,
      createdAt: new Date()
    });

    return true;
  }

  async rejectFriendRequest(requestId: string, userId: string): Promise<boolean> {
    const request = await this.repository.get(requestId);
    if (!request) {
      throw AppError.from(ErrFriendRequestNotFound, 404);
    }

    if (request.toUserId !== userId) {
      throw AppError.from(ErrFriendRequestUnauthorized, 403);
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw AppError.from(new Error('Friend request is not pending'), 400);
    }

    // 4. Update request status
    await this.repository.update(requestId, {
      status: FriendRequestStatus.REJECTED,
      respondedAt: new Date()
    });

    return true;
  }

  async cancelFriendRequest(requestId: string, userId: string): Promise<boolean> {
    const request = await this.repository.get(requestId);
    if (!request) {
      throw AppError.from(ErrFriendRequestNotFound, 404);
    }

    if (request.fromUserId !== userId) {
      throw AppError.from(ErrFriendRequestUnauthorized, 403);
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw AppError.from(new Error('Friend request is not pending'), 400);
    }

    await this.repository.update(requestId, {
      status: FriendRequestStatus.CANCELED,
      respondedAt: new Date()
    });

    return true;
  }

  async getReceivedRequests(userId: string): Promise<FriendRequest[]> {
    return await this.repository.list(
      {
        toUserId: userId,
        status: FriendRequestStatus.PENDING
      },
      { page: 1, limit: 100 }
    );
  }

  async getSentRequests(userId: string): Promise<FriendRequest[]> {
    return await this.repository.list(
      {
        fromUserId: userId,
        status: FriendRequestStatus.PENDING
      },
      { page: 1, limit: 100 }
    );
  }

  async create(data: FriendRequestCreateDTO): Promise<string> {
    const dto = FriendRequestCreateSchema.parse(data);
    return await this.sendFriendRequest(dto.fromUserId, dto.toUserId);
  }

  async getDetail(id: string): Promise<FriendRequest | null> {
    const data = await this.repository.get(id);
    if (!data) {
      throw ErrDataNotFound;
    }
    return data;
  }

  async update(id: string, data: FriendRequestUpdateDTO): Promise<boolean> {
    await this.repository.update(id, data);
    return true;
  }

  async list(cond: FriendRequestCondDTO, paging: PagingDTO): Promise<FriendRequest[]> {
    return await this.repository.list(cond, paging);
  }

  async delete(id: string): Promise<boolean> {
    await this.repository.delete(id, true);
    return true;
  }
}
