import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { Sequelize } from "sequelize";
import { Server as SocketIOServer } from "socket.io";
import {
  FriendRequestHTTPService,
  FriendNotificationSocketService,
} from "./infras";
import { FriendRequestUseCase } from "./usecase";
import { MongoFriendRequestRepository } from "./infras/repository";
import { MongoBlockRepository } from "@modules/blocks/infras/repository/nosql/mongodb-repo";
import { MongoFriendshipRepository } from "@modules/friendships/infras/repository/nosql/mongodb-repo";
import { MongoUserRepository } from "@modules/user/infras/repository/nosql/mongodb-repo";

export { FriendNotificationSocketService };
export * from "./model";
export * from "./interface";
export { FriendRequestUseCase } from "./usecase";
export { FriendRequestHTTPService } from "./infras";

export const setupFriendRequestHexagon = (
  sctx: ServiceContext,
  io?: SocketIOServer,
): { router: Router; socketService?: FriendNotificationSocketService } => {
  const repository = new MongoFriendRequestRepository();
  const blockRepository = new MongoBlockRepository();
  const friendshipRepository = new MongoFriendshipRepository();
  const userRepository = new MongoUserRepository();
  const useCase = new FriendRequestUseCase(
    repository,
    blockRepository,
    friendshipRepository,
    userRepository,
  );
  const httpService = new FriendRequestHTTPService(useCase);

  let socketService: FriendNotificationSocketService | undefined;
  if (io) {
    socketService = new FriendNotificationSocketService(io);
    httpService.setSocketService(socketService);
  }

  const router = Router();
  const mdlFactory = sctx.mdlFactory;

  router.post(
    "/friend-requests/:receiverId",
    mdlFactory.auth,
    httpService.sendFriendRequestAPI.bind(httpService),
  );
  router.patch(
    "/friend-requests/:requestId",
    mdlFactory.auth,
    httpService.updateFriendRequestStatusAPI.bind(httpService),
  );
  router.delete(
    "/friend-requests/:requestId",
    mdlFactory.auth,
    httpService.cancelFriendRequestAPI.bind(httpService),
  );
  router.get(
    "/friend-requests/received",
    mdlFactory.auth,
    httpService.getReceivedRequestsAPI.bind(httpService),
  );
  router.get(
    "/friend-requests/sent",
    mdlFactory.auth,
    httpService.getSentRequestsAPI.bind(httpService),
  );

  return { router, socketService };
};
