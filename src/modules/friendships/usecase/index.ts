import { AppError } from '@share/app-error';
import { ErrDataNotFound } from '@share/model/base-error';
import { PagingDTO } from '@share/model/paging';
import { v7 } from 'uuid';
import { IFriendshipUseCase } from '../interface';
import {
  Friendship,
  FriendshipCondDTO,
  FriendshipCreateDTO,
  FriendshipCreateSchema,
  FriendshipUpdateDTO,
  ErrFriendshipAlreadyExists,
  ErrFriendshipNotFound,
  ErrFriendshipSelfFriendship,
  ErrFriendshipUserNotFound
} from '../model';
import { MongoFriendshipRepository } from '../infras/repository';
import { MongoUserRepository } from '@modules/user/infras/repository/nosql/mongodb-repo';
import { MongoFriendRequestRepository } from '@modules/friend-requests/infras/repository/nosql/mongodb-repo';
import { FriendRequestStatus } from '@modules/friend-requests/model/model';

export class FriendshipUseCase implements IFriendshipUseCase {
  constructor(
    private readonly repository: MongoFriendshipRepository,
    private readonly userRepository: MongoUserRepository,
    private readonly friendRequestRepository: MongoFriendRequestRepository
  ) {}

  async getFriendsList(userId: string): Promise<Friendship[]> {
    return await this.repository.findFriendshipsForUser(userId);
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const [userA, userB] = [userId1, userId2].sort();
    const friendship = await this.repository.findByCond({
      userA,
      userB
    });

    return !!friendship;
  }

  async unfriend(userId: string, friendId: string): Promise<boolean> {
    const friendUser = await this.userRepository.get(friendId);
    if (!friendUser) {
      throw AppError.from(ErrFriendshipUserNotFound, 404);
    }

    const [userA, userB] = [userId, friendId].sort();

    const result = await this.repository.deleteByCondition({
      userA,
      userB
    });

    if (!result) {
      throw AppError.from(ErrFriendshipNotFound, 404);
    }

    const requests = await this.friendRequestRepository.list(
      {
        fromUserId: userId,
        toUserId: friendId,
        status: FriendRequestStatus.PENDING
      },
      { page: 1, limit: 100 }
    );

    const reverseRequests = await this.friendRequestRepository.list(
      {
        fromUserId: friendId,
        toUserId: userId,
        status: FriendRequestStatus.PENDING
      },
      { page: 1, limit: 100 }
    );

    for (const request of [...requests, ...reverseRequests]) {
      await this.friendRequestRepository.delete(request.id, true);
    }

    return true;
  }

  async create(data: FriendshipCreateDTO): Promise<string> {
    const dto = FriendshipCreateSchema.parse(data);

    if (dto.userA === dto.userB) {
      throw AppError.from(ErrFriendshipSelfFriendship, 400);
    }

    // Sort to ensure consistent storage
    const [userA, userB] = [dto.userA, dto.userB].sort();

    // Check if already exists
    const existing = await this.repository.findByCond({ userA, userB });
    if (existing) {
      throw AppError.from(ErrFriendshipAlreadyExists, 400);
    }

    const newId = v7();
    const newFriendship: Friendship = {
      id: newId,
      userA,
      userB,
      createdAt: new Date()
    };

    await this.repository.insert(newFriendship);

    return newId;
  }

  async getDetail(id: string): Promise<Friendship | null> {
    const data = await this.repository.get(id);
    if (!data) {
      throw ErrDataNotFound;
    }
    return data;
  }

  async update(id: string, data: FriendshipUpdateDTO): Promise<boolean> {
    throw new Error('Friendships cannot be updated');
  }

  async list(cond: FriendshipCondDTO, paging: PagingDTO): Promise<Friendship[]> {
    return await this.repository.list(cond, paging);
  }

  async delete(id: string): Promise<boolean> {
    await this.repository.delete(id, true);
    return true;
  }
}
