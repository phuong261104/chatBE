import { ServiceContext } from '@share/interface/service-context';
import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { BlockHTTPService, BlockNotificationSocketService } from './infras';
import { BlockUseCase } from './usecase';
import { DynamoBlockRepository } from './infras/repository/dynamodb';
import { DynamoUserRepository } from '@modules/user/infras/repository/dynamodb';
import { DynamoFriendshipRepository } from '@modules/friendships/infras/repository/dynamodb';
import { DynamoFriendRequestRepository } from '@modules/friend-requests/infras/repository/dynamodb';

export * from './model';
export * from './interface';
export { BlockUseCase } from './usecase';
export { BlockHTTPService } from './infras';
export { BlockNotificationSocketService } from './infras';

export const setupBlockHexagon = (sctx: ServiceContext, io?: SocketIOServer) => {
  const repository = new DynamoBlockRepository();
  const userRepository = new DynamoUserRepository();
  const friendshipRepository = new DynamoFriendshipRepository();
  const friendRequestRepository = new DynamoFriendRequestRepository();
  const useCase = new BlockUseCase(repository as any, userRepository as any, friendshipRepository as any, friendRequestRepository as any);
  const httpService = new BlockHTTPService(useCase as any);

  let socketService: BlockNotificationSocketService | undefined;
  if (io) {
    socketService = new BlockNotificationSocketService(io);
    httpService.setSocketService(socketService);
  }

  const router = Router();
  const mdlFactory = sctx.mdlFactory;

  router.post('/blocks/:blockedUserId', mdlFactory.auth, httpService.blockUserAPI.bind(httpService));
  router.delete('/blocks/:blockedUserId', mdlFactory.auth, httpService.unblockUserAPI.bind(httpService));
  router.get('/blocks', mdlFactory.auth, httpService.getBlockedUsersAPI.bind(httpService));
  router.get('/blocks/:blockedUserId/check', mdlFactory.auth, httpService.checkBlockStatusAPI.bind(httpService));

  return { router, socketService };
};
