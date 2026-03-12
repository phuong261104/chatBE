import { ServiceContext } from '@share/interface/service-context';
import { Router } from 'express';
import { Sequelize } from 'sequelize';
import { BlockHTTPService } from './infras';
import { BlockUseCase } from './usecase';
import { MongoBlockRepository } from './infras/repository';
import { MongoUserRepository } from '@modules/user/infras/repository/nosql/mongodb-repo';
import { MongoFriendshipRepository } from '@modules/friendships/infras/repository/nosql/mongodb-repo';
import { MongoFriendRequestRepository } from '@modules/friend-requests/infras/repository/nosql/mongodb-repo';

export * from './model';
export * from './interface';
export { BlockUseCase } from './usecase';
export { BlockHTTPService } from './infras';

export const setupBlockHexagon = (sctx: ServiceContext) => {
  const repository = new MongoBlockRepository();
  const userRepository = new MongoUserRepository();
  const friendshipRepository = new MongoFriendshipRepository();
  const friendRequestRepository = new MongoFriendRequestRepository();
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
