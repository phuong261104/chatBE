import { IUseCase } from '@share/interface';
import { FriendshipCreateDTO, FriendshipCondDTO } from '../model/dto';
import { Friendship } from '../model/model';

export interface IFriendshipUseCase extends IUseCase<FriendshipCreateDTO, never, Friendship, FriendshipCondDTO> {
  getFriendsList(userId: string): Promise<Friendship[]>;
  areFriends(userId1: string, userId2: string): Promise<boolean>;
  unfriend(userId: string, friendId: string): Promise<boolean>;
}
