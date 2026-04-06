import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { MongoCloudItemRepository } from "./infras/repository";
import { DynamoCloudItemRepository } from "./infras/repository/dynamodb";
import { MyCloudUseCase } from "./usecase";
import { MyCloudHTTPService } from "./infras/transport";
import { config } from "@share/component/config";

export * from "./model";
export * from "./interface";

export const setupMyCloudHexagon = (sctx: ServiceContext) => {
  const dbType = config.dbType;

  const repository = (dbType === "dynamodb"
    ? new DynamoCloudItemRepository()
    : new MongoCloudItemRepository()) as any;
  const useCase = new MyCloudUseCase(repository);
  const httpService = new MyCloudHTTPService(useCase);

  const router = Router();
  const mdlFactory = sctx.mdlFactory;

  router.get("/my-cloud", mdlFactory.auth, httpService.getItemsAPI.bind(httpService));
  router.post("/my-cloud", mdlFactory.auth, httpService.createItemAPI.bind(httpService));
  router.delete("/my-cloud/:id", mdlFactory.auth, httpService.deleteItemAPI.bind(httpService));

  return router;
};
