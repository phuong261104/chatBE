import { IUseCase } from '@share/interface';
import { FriendshipCreateDTO, FriendshipCondDTO, Friendship, MutualFriendDTO, FriendSuggestionDTO, GetFriendsListQuery, GetFriendsListResult } from '../model';

export interface IFriendshipUseCase extends IUseCase<FriendshipCreateDTO, never, Friendship, FriendshipCondDTO> {
  getFriendsList(userId: string, query: GetFriendsListQuery): Promise<GetFriendsListResult>;
  areFriends(userId1: string, userId2: string): Promise<boolean>;
  unfriend(userId: string, friendId: string): Promise<boolean>;
  getMutualFriends(userId: string, targetUserId: string, limit?: number): Promise<MutualFriendDTO[]>;
  getFriendSuggestions(userId: string, limit?: number): Promise<FriendSuggestionDTO[]>;
  getFriendsCount(userId: string): Promise<number>;
  searchFriends(userId: string, query: string, cursor?: string, limit?: number): Promise<{ items: any[]; nextCursor: string; hasMore: boolean }>;
}
