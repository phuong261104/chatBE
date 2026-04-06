import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { Sequelize } from "sequelize";
import { Server as SocketIOServer } from "socket.io";
import {
  FriendRequestHTTPService,
  FriendNotificationSocketService,
} from "./infras";
import { FriendRequestUseCase } from "./usecase";
import { MongoFriendRequestRepository } from "./infras/repository/nosql/mongodb-repo";
import { DynamoFriendRequestRepository } from "./infras/repository/dynamodb";
import { MongoBlockRepository } from "@modules/blocks/infras/repository/nosql/mongodb-repo";
import { DynamoBlockRepository } from "@modules/blocks/infras/repository/dynamodb";
import { MongoFriendshipRepository } from "@modules/friendships/infras/repository/nosql/mongodb-repo";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";
import { MongoUserRepository } from "@modules/user/infras/repository/nosql/mongodb-repo";
import { DynamoUserRepository } from "@modules/user/infras/repository/dynamodb";
import { config } from "@share/component/config";

export { FriendNotificationSocketService };
export * from "./model";
export * from "./interface";
export { FriendRequestUseCase } from "./usecase";
export { FriendRequestHTTPService } from "./infras";

export const setupFriendRequestHexagon = (
  sctx: ServiceContext,
  io?: SocketIOServer,
): { router: Router; socketService?: FriendNotificationSocketService } => {
  const dbType = config.dbType;

  const repository = (dbType === "dynamodb"
    ? new DynamoFriendRequestRepository()
    : new MongoFriendRequestRepository()) as any;
  const blockRepository = (dbType === "dynamodb"
    ? new DynamoBlockRepository()
    : new MongoBlockRepository()) as any;
  const friendshipRepository = (dbType === "dynamodb"
    ? new DynamoFriendshipRepository()
    : new MongoFriendshipRepository()) as any;
  const userRepository = (dbType === "dynamodb"
    ? new DynamoUserRepository()
    : new MongoUserRepository()) as any;
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
