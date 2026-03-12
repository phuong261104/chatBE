import { ServiceContext } from '@share/interface/service-context';
import { Router } from 'express';
import { Sequelize } from 'sequelize';
import { FriendshipHTTPService } from './infras';
import { FriendshipUseCase } from './usecase';
import { MongoFriendshipRepository } from './infras/repository';
import { MongoUserRepository } from '@modules/user/infras/repository/nosql/mongodb-repo';
import { MongoFriendRequestRepository } from '@modules/friend-requests/infras/repository/nosql/mongodb-repo';
import { FriendNotificationSocketService } from '@modules/friend-requests/infras/transport/socket-service';

export * from './model';
export * from './interface';
export { FriendshipUseCase } from './usecase';
export { FriendshipHTTPService } from './infras';

export const setupFriendshipHexagon = (sctx: ServiceContext, socketService?: FriendNotificationSocketService) => {
  const repository = new MongoFriendshipRepository();
  const userRepository = new MongoUserRepository();
  const friendRequestRepository = new MongoFriendRequestRepository();
  const useCase = new FriendshipUseCase(repository, userRepository, friendRequestRepository);
  const httpService = new FriendshipHTTPService(useCase);

  if (socketService) {
    httpService.setSocketService(socketService);
  }

  const router = Router();
  const mdlFactory = sctx.mdlFactory;

  router.get('/friendships', mdlFactory.auth, httpService.getFriendsListAPI.bind(httpService));
  router.delete('/friendships/:friendId', mdlFactory.auth, httpService.unfriendAPI.bind(httpService));
  router.get('/friendships/:friendId/check', mdlFactory.auth, httpService.checkFriendshipAPI.bind(httpService));

  return router;
};
