import { ServiceContext } from '@share/interface/service-context';
import { Router } from 'express';
import { Sequelize } from 'sequelize';
import { BlockHTTPService } from './infras';
import { BlockUseCase } from './usecase';
import { MongoBlockRepository } from './infras/repository/nosql/mongodb-repo';
import { DynamoBlockRepository } from './infras/repository/dynamodb';
import { MongoUserRepository } from '@modules/user/infras/repository/nosql/mongodb-repo';
import { DynamoUserRepository } from '@modules/user/infras/repository/dynamodb';
import { MongoFriendshipRepository } from '@modules/friendships/infras/repository/nosql/mongodb-repo';
import { DynamoFriendshipRepository } from '@modules/friendships/infras/repository/dynamodb';
import { MongoFriendRequestRepository } from '@modules/friend-requests/infras/repository/nosql/mongodb-repo';
import { DynamoFriendRequestRepository } from '@modules/friend-requests/infras/repository/dynamodb';
import { config } from '@share/component/config';

export * from './model';
export * from './interface';
export { BlockUseCase } from './usecase';
export { BlockHTTPService } from './infras';

export const setupBlockHexagon = (sctx: ServiceContext) => {
  const dbType = config.dbType;

  const repository = (dbType === "dynamodb"
    ? new DynamoBlockRepository()
    : new MongoBlockRepository()) as any;
  const userRepository = (dbType === "dynamodb"
    ? new DynamoUserRepository()
    : new MongoUserRepository()) as any;
  const friendshipRepository = (dbType === "dynamodb"
    ? new DynamoFriendshipRepository()
    : new MongoFriendshipRepository()) as any;
  const friendRequestRepository = (dbType === "dynamodb"
    ? new DynamoFriendRequestRepository()
    : new MongoFriendRequestRepository()) as any;
  const useCase = new BlockUseCase(repository, userRepository, friendshipRepository, friendRequestRepository);
  const httpService = new BlockHTTPService(useCase);

  const router = Router();
  const mdlFactory = sctx.mdlFactory;

  router.post('/blocks/:blockedUserId', mdlFactory.auth, httpService.blockUserAPI.bind(httpService));
  router.delete('/blocks/:blockedUserId', mdlFactory.auth, httpService.unblockUserAPI.bind(httpService));
  router.get('/blocks', mdlFactory.auth, httpService.getBlockedUsersAPI.bind(httpService));
  router.get('/blocks/:blockedUserId/check', mdlFactory.auth, httpService.checkBlockStatusAPI.bind(httpService));

  return router;
};
