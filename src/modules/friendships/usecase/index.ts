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
  FriendshipStatus,
  ErrFriendshipAlreadyExists,
  ErrFriendshipNotFound,
  ErrFriendshipSelfFriendship,
  ErrFriendshipUserNotFound,
  MutualFriendDTO,
  FriendSuggestionDTO,
  GetFriendsListQuery,
  GetFriendsListResult,
} from '../model';
import { FriendRequestStatus } from '@modules/friend-requests/model/model';

export class FriendshipUseCase implements IFriendshipUseCase {
  constructor(
    private readonly repository: any,
    private readonly userRepository: any,
    private readonly friendRequestRepository: any
  ) {}

  async getFriendsList(userId: string, query: GetFriendsListQuery): Promise<GetFriendsListResult> {
    return await this.repository.findFriendshipsWithCursor(
      userId,
      query.cursor,
      query.limit,
      query.sortBy,
    );
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const [userA, userB] = [userId1, userId2].sort();
    const friendship = await this.repository.findByCond({
      userA,
      userB
    });

    return !!(friendship && friendship.status === FriendshipStatus.ACTIVE);
  }

  async unfriend(userId: string, friendId: string): Promise<boolean> {
    const friendUser = await this.userRepository.get(friendId);
    if (!friendUser) {
      throw AppError.from(ErrFriendshipUserNotFound, 404);
    }

    const [userA, userB] = [userId, friendId].sort();

    const existingFriendship = await this.repository.findByCond({ userA, userB });
    if (!existingFriendship || existingFriendship.status === FriendshipStatus.DELETED) {
      throw AppError.from(ErrFriendshipNotFound, 404);
    }

    await this.repository.softDeleteFriendship(userA, userB);

    const [requests, reverseRequests]: [any[], any[]] = [
      await this.friendRequestRepository.listBySenderId(userId),
      await this.friendRequestRepository.listByReceiverId(userId),
    ];

    const pendingIds: string[] = requests
      .concat(reverseRequests)
      .filter((r: any) => r.status === FriendRequestStatus.PENDING && (r.fromUserId === friendId || r.toUserId === friendId))
      .map((r: any) => r.id);

    if (pendingIds.length > 0) {
      await Promise.allSettled(pendingIds.map(id => this.friendRequestRepository.delete(id, true)));
    }

    return true;
  }

  async create(data: FriendshipCreateDTO): Promise<string> {
    const dto = FriendshipCreateSchema.parse(data);

    if (dto.userA === dto.userB) {
      throw AppError.from(ErrFriendshipSelfFriendship, 400);
    }

    const [userA, userB] = [dto.userA, dto.userB].sort();

    const existing = await this.repository.findByCond({ userA, userB });
    if (existing) {
      throw AppError.from(ErrFriendshipAlreadyExists, 400);
    }

    const newId = v7();
    const newFriendship: Friendship = {
      id: newId,
      userA,
      userB,
      status: FriendshipStatus.ACTIVE,
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

  async getMutualFriends(userId: string, targetUserId: string, limit: number = 20): Promise<MutualFriendDTO[]> {
    if (userId === targetUserId) {
      return [];
    }

    const targetUser = await this.userRepository.get(targetUserId);
    if (!targetUser) {
      throw AppError.from(ErrFriendshipUserNotFound, 404);
    }

    const mutualFriendIds: string[] = await this.repository.getMutualFriendIds(userId, targetUserId);
    const limitedIds: string[] = mutualFriendIds.slice(0, limit);

    const users = await Promise.all(
      limitedIds.map((id) => this.userRepository.get(id))
    );

    return users
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        mutualFriendsCount: mutualFriendIds.length
      }));
  }

  async getFriendSuggestions(userId: string, limit: number = 20): Promise<FriendSuggestionDTO[]> {
    const myFriendIds = new Set<string>(await this.repository.getFriendIds(userId));

    const [sentRequests, receivedRequests] = await Promise.all([
      this.friendRequestRepository.listBySenderId(userId),
      this.friendRequestRepository.listByReceiverId(userId),
    ]);
    const pendingRequests = [...sentRequests, ...receivedRequests].filter(
      (r) => r.status === FriendRequestStatus.PENDING,
    );

    const pendingUserIds = new Set<string>();
    pendingUserIds.add(userId);
    for (const req of pendingRequests) {
      pendingUserIds.add(req.fromUserId);
      pendingUserIds.add(req.toUserId);
    }

    const friendOfFriendsMap = new Map<string, Set<string>>();

    for (const friendId of myFriendIds) {
      const friendFriends = await this.repository.getFriendIds(friendId);
      for (const fofId of friendFriends) {
        if (!myFriendIds.has(fofId) && !pendingUserIds.has(fofId) && fofId !== userId) {
          if (!friendOfFriendsMap.has(fofId)) {
            friendOfFriendsMap.set(fofId, new Set());
          }
          friendOfFriendsMap.get(fofId)!.add(friendId);
        }
      }
    }

    const suggestions: FriendSuggestionDTO[] = [];
    const processedUserIds = new Set<string>();

    const sortedByMutual = Array.from(friendOfFriendsMap.entries())
      .sort((a, b) => b[1].size - a[1].size);

    const topSuggestions = sortedByMutual
      .filter(([suggestedUserId]) => !processedUserIds.has(suggestedUserId))
      .slice(0, limit);

    if (topSuggestions.length > 0) {
      const suggestionIds = topSuggestions.map(([id]) => id);
      const usersMap = new Map<string, any>();
      const users = await this.userRepository.listByIds(suggestionIds);
      for (const u of users) {
        usersMap.set(u.id, u);
      }

      for (const [suggestedUserId, mutualFriendIds] of topSuggestions) {
        const user = usersMap.get(suggestedUserId);
        if (!user) continue;
        processedUserIds.add(suggestedUserId);
        suggestions.push({
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          mutualFriendsCount: mutualFriendIds.size,
          mutualFriendIds: Array.from(mutualFriendIds),
        });
      }
    }

    return suggestions;
  }

  async getFriendsCount(userId: string): Promise<number> {
    const friendIds = await this.repository.getFriendIds(userId);
    return friendIds.length;
  }

  async searchFriends(userId: string, query: string, cursor?: string, limit?: number): Promise<{ items: any[]; nextCursor: string; hasMore: boolean }> {
    const pageLimit = Math.min(limit || 20, 50);
    const searchLower = query.toLowerCase().trim();

    const friendIds = await this.repository.getFriendIds(userId);
    if (friendIds.length === 0) {
      return { items: [], nextCursor: "", hasMore: false };
    }

    const batchSize = 100;
    const batches: string[][] = [];
    for (let i = 0; i < friendIds.length; i += batchSize) {
      batches.push(friendIds.slice(i, i + batchSize));
    }

    const allUsers: any[] = [];
    for (const batch of batches) {
      const users = await this.userRepository.listByIds(batch);
      allUsers.push(...users);
    }

    const matched = allUsers.filter(u =>
      u && (
        (u.displayName && u.displayName.toLowerCase().includes(searchLower)) ||
        (u.username && u.username.toLowerCase().includes(searchLower))
      )
    );

    const sorted = matched.sort((a, b) => {
      const nameA = (a.displayName || a.username || "").toLowerCase();
      const nameB = (b.displayName || b.username || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    let startIndex = 0;
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
        startIndex = decoded.idx || 0;
      } catch {
        startIndex = 0;
      }
    }

    const pageItems = sorted.slice(startIndex, startIndex + pageLimit);
    const hasMore = startIndex + pageLimit < sorted.length;
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ idx: startIndex + pageLimit })).toString("base64")
      : "";

    return {
      items: pageItems.map(u => ({
        id: u.id,
        displayName: u.displayName,
        username: u.username,
        avatarUrl: u.avatarUrl,
      })),
      nextCursor,
      hasMore,
    };
  }
}
