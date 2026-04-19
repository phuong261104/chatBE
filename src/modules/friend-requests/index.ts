import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { Server as SocketIOServer } from "socket.io";
import {
  FriendRequestHTTPService,
  FriendNotificationSocketService,
} from "./infras";
import { FriendRequestUseCase } from "./usecase";
import { DynamoFriendRequestRepository } from "./infras/repository/dynamodb";
import { DynamoBlockRepository } from "@modules/blocks/infras/repository/dynamodb";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";
import { DynamoUserRepository } from "@modules/user/infras/repository/dynamodb";
import { DynamoConversationRepository, DynamoConversationMemberRepository, DynamoMessageRepository } from "@modules/chat/infras/repository/dynamodb";

export { FriendNotificationSocketService };
export * from "./model";
export * from "./interface";
export { FriendRequestUseCase } from "./usecase";
export { FriendRequestHTTPService } from "./infras";

export const setupFriendRequestHexagon = (
  sctx: ServiceContext,
  io?: SocketIOServer,
): { router: Router; socketService?: FriendNotificationSocketService } => {
  const repository = new DynamoFriendRequestRepository();
  const blockRepository = new DynamoBlockRepository();
  const friendshipRepository = new DynamoFriendshipRepository();
  const userRepository = new DynamoUserRepository();
  const conversationRepo = new DynamoConversationRepository();
  const conversationMemberRepo = new DynamoConversationMemberRepository();
  const messageRepo = new DynamoMessageRepository();
  const useCase = new FriendRequestUseCase(
    repository,
    blockRepository,
    friendshipRepository,
    userRepository,
    conversationRepo,
    conversationMemberRepo,
    messageRepo,
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
  router.get(
    "/friend-requests/check/:targetUserId",
    mdlFactory.auth,
    httpService.checkFriendRequestStatusAPI.bind(httpService),
  );
  router.get(
    "/friend-requests/count",
    mdlFactory.auth,
    httpService.getFriendRequestsCountAPI.bind(httpService),
  );

  return { router, socketService };
};
