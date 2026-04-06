import { ServiceContext } from '@share/interface/service-context';
import { Router } from 'express';
import { Sequelize } from 'sequelize';
import { FriendshipHTTPService } from './infras';
import { FriendshipUseCase } from './usecase';
import { MongoFriendshipRepository } from './infras/repository/nosql/mongodb-repo';
import { DynamoFriendshipRepository } from './infras/repository/dynamodb';
import { MongoUserRepository } from '@modules/user/infras/repository/nosql/mongodb-repo';
import { DynamoUserRepository } from '@modules/user/infras/repository/dynamodb';
import { MongoFriendRequestRepository } from '@modules/friend-requests/infras/repository/nosql/mongodb-repo';
import { DynamoFriendRequestRepository } from '@modules/friend-requests/infras/repository/dynamodb';
import { FriendNotificationSocketService } from '@modules/friend-requests/infras/transport/socket-service';
import { config } from '@share/component/config';

export * from './model';
export * from './interface';
export { FriendshipUseCase } from './usecase';
export { FriendshipHTTPService } from './infras';

export const setupFriendshipHexagon = (sctx: ServiceContext, socketService?: FriendNotificationSocketService) => {
  const dbType = config.dbType;

  const repository = (dbType === "dynamodb"
    ? new DynamoFriendshipRepository()
    : new MongoFriendshipRepository()) as any;
  const userRepository = (dbType === "dynamodb"
    ? new DynamoUserRepository()
    : new MongoUserRepository()) as any;
  const friendRequestRepository = (dbType === "dynamodb"
    ? new DynamoFriendRequestRepository()
    : new MongoFriendRequestRepository()) as any;
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
  router.get('/users/:id/mutual-friends', mdlFactory.auth, httpService.getMutualFriendsAPI.bind(httpService));
  router.get('/users/:id/suggestions', mdlFactory.auth, httpService.getFriendSuggestionsAPI.bind(httpService));

  return router;
};
