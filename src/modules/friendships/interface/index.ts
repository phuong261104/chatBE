import { IUseCase } from '@share/interface';
import { FriendshipCreateDTO, FriendshipCondDTO, Friendship } from '../model';

export interface IFriendshipUseCase extends IUseCase<FriendshipCreateDTO, never, Friendship, FriendshipCondDTO> {
  getFriendsList(userId: string): Promise<Friendship[]>;
  areFriends(userId1: string, userId2: string): Promise<boolean>;
  unfriend(userId: string, friendId: string): Promise<boolean>;
}
