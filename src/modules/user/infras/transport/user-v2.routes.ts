import { Router } from "express";
import { DynamoBlockRepository } from "@modules/blocks/infras/repository/dynamodb";
import { DynamoConversationMemberRepository, DynamoConversationRepository } from "@modules/chat/infras/repository/dynamodb";
import { DynamoFriendRequestRepository } from "@modules/friend-requests/infras/repository/dynamodb";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";
import { ServiceContext } from "@share/interface/service-context";
import { IPresenceUseCase, IUserUseCase } from "../../interface";
import {
  DynamoUserAvatarHistoryRepository,
  DynamoUserRepository,
} from "../repository/dynamodb";
import { RelationshipPrivacyPolicyV2 } from "../../usecase/relationship-privacy-policy-v2";
import { UserV2HTTPService } from "./user-v2-http-service";

export function setupUserV2Routes(
  sctx: ServiceContext,
  userUseCase: IUserUseCase,
  presenceUseCase: IPresenceUseCase,
  userRepo: DynamoUserRepository,
) {
  const router = Router();
  const friendshipRepo = new DynamoFriendshipRepository();
  const friendRequestRepo = new DynamoFriendRequestRepository();
  const blockRepo = new DynamoBlockRepository();
  const conversationRepo = new DynamoConversationRepository();
  const conversationMemberRepo = new DynamoConversationMemberRepository();
  const avatarHistoryRepo = new DynamoUserAvatarHistoryRepository();
  const privacyPolicy = new RelationshipPrivacyPolicyV2(userRepo, friendshipRepo, blockRepo);
  const service = new UserV2HTTPService(
    userUseCase,
    presenceUseCase,
    userRepo,
    avatarHistoryRepo,
    privacyPolicy,
    friendshipRepo,
    friendRequestRepo,
    blockRepo,
    conversationRepo,
    conversationMemberRepo,
  );

  const auth = sctx.mdlFactory.auth;
  router.get("/users/me/profile", auth, service.getMyProfileAPI);
  router.patch("/users/me/profile", auth, service.updateMyProfileAPI);
  router.patch("/users/me/privacy", auth, service.updateMyPrivacyAPI);
  router.get("/users/me/avatar-history", auth, service.getAvatarHistoryAPI);
  router.get("/users/search", auth, service.searchUsersAPI);
  router.get("/users/search-by-phone", auth, service.searchByPhoneAPI);
  router.get("/users/:id/presence", auth, service.getPresenceAPI);
  router.get("/users/:id/public", auth, service.getPublicProfileAPI);
  router.get("/friends/suggestions", auth, service.getFriendSuggestionsAPI);

  return router;
}
