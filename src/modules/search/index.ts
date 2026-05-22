import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { SearchUseCase } from "./usecase";
import { SearchHTTPService } from "./infras/transport";
import { DynamoBlockRepository } from "@modules/blocks/infras/repository/dynamodb";
import {
  DynamoConversationMemberRepository,
  DynamoConversationRepository,
  DynamoMessageClassificationRepository,
  DynamoMessageRepository,
} from "@modules/chat/infras/repository/dynamodb";
import { DynamoUserRepository } from "@modules/user/infras/repository/dynamodb";

export * from "./model";
export * from "./interface";

export const setupSearchHexagon = (sctx: ServiceContext) => {
  const useCase = new SearchUseCase({
    userRepo: new DynamoUserRepository(),
    conversationRepo: new DynamoConversationRepository(),
    conversationMemberRepo: new DynamoConversationMemberRepository(),
    messageRepo: new DynamoMessageRepository(),
    classificationRepo: new DynamoMessageClassificationRepository(),
    blockRepo: new DynamoBlockRepository(),
  });
  const httpService = new SearchHTTPService(useCase);

  const router = Router();
  const mdlFactory = sctx.mdlFactory;

  router.get("/search", mdlFactory.auth, httpService.globalSearchAPI.bind(httpService));

  return router;
};
