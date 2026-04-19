import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { DynamoStoryRepository, DynamoStoryViewRepository } from "./infras/repository/dynamodb";
import { StoryUseCase } from "./usecase";
import { StoryHTTPService } from "./infras/transport";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";
import { DynamoConversationRepository } from "@modules/chat/infras/repository/dynamodb";

export * from "./model";
export * from "./interface";

export const setupStoryHexagon = (sctx: ServiceContext) => {
  const storyRepo = new DynamoStoryRepository();
  const viewRepo = new DynamoStoryViewRepository();
  const friendshipRepo = new DynamoFriendshipRepository();
  const conversationRepo = new DynamoConversationRepository();
  const useCase = new StoryUseCase(storyRepo, viewRepo, friendshipRepo, conversationRepo);
  const httpService = new StoryHTTPService(useCase);

  const router = Router();
  const mdl = sctx.mdlFactory;

  router.post("/stories", mdl.auth, httpService.createStoryAPI.bind(httpService));
  router.get("/stories", mdl.auth, httpService.getStoriesAPI.bind(httpService));
  router.get("/stories/:id", mdl.auth, httpService.getStoryByIdAPI.bind(httpService));
  router.delete("/stories/:id", mdl.auth, httpService.deleteStoryAPI.bind(httpService));
  router.post("/stories/:id/view", mdl.auth, httpService.viewStoryAPI.bind(httpService));
  router.get("/stories/:id/views", mdl.auth, httpService.getStoryViewsAPI.bind(httpService));
  router.post("/stories/:id/reply", mdl.auth, httpService.replyStoryAPI.bind(httpService));

  return router;
};
