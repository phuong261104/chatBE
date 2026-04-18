import { IUseCase } from '@share/interface';
import { FriendRequestCreateDTO, FriendRequestUpdateDTO, FriendRequestCondDTO, FriendRequest } from '../model';

export interface IFriendRequestUseCase extends IUseCase<
  FriendRequestCreateDTO,
  FriendRequestUpdateDTO,
  FriendRequest,
  FriendRequestCondDTO
> {
  sendFriendRequest(fromUserId: string, toUserId: string): Promise<string>;
  acceptFriendRequest(requestId: string, userId: string): Promise<boolean>;
  rejectFriendRequest(requestId: string, userId: string): Promise<boolean>;
  cancelFriendRequest(requestId: string, userId: string): Promise<boolean>;
  getReceivedRequests(userId: string): Promise<FriendRequest[]>;
  getSentRequests(userId: string): Promise<FriendRequest[]>;
  getFriendRequestsCount(userId: string): Promise<{ received: number; sent: number }>;
  checkFriendRequestStatus(
    currentUserId: string,
    targetUserId: string,
  ): Promise<{ status: string; requestId?: string; direction?: string }>;
}
