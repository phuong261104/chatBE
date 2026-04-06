import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { MongoStoryRepository, MongoStoryViewRepository } from "./infras/repository";
import { DynamoStoryRepository, DynamoStoryViewRepository } from "./infras/repository/dynamodb";
import { StoryUseCase } from "./usecase";
import { StoryHTTPService } from "./infras/transport";
import { MongoFriendshipRepository } from "@modules/friendships/infras/repository/nosql/mongodb-repo";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";
import { config } from "@share/component/config";

export * from "./model";
export * from "./interface";

export const setupStoryHexagon = (sctx: ServiceContext) => {
  const dbType = config.dbType;

  const storyRepo = (dbType === "dynamodb"
    ? new DynamoStoryRepository()
    : new MongoStoryRepository()) as any;
  const viewRepo = (dbType === "dynamodb"
    ? new DynamoStoryViewRepository()
    : new MongoStoryViewRepository()) as any;
  const friendshipRepo = (dbType === "dynamodb"
    ? new DynamoFriendshipRepository()
    : new MongoFriendshipRepository()) as any;
  const useCase = new StoryUseCase(storyRepo, viewRepo, friendshipRepo);
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
