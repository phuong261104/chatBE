import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { MongoCloudItemRepository } from "./infras/repository";
import { MyCloudUseCase } from "./usecase";
import { MyCloudHTTPService } from "./infras/transport";

export * from "./model";
export * from "./interface";

export const setupMyCloudHexagon = (sctx: ServiceContext) => {
  const repository = new MongoCloudItemRepository();
  const useCase = new MyCloudUseCase(repository);
  const httpService = new MyCloudHTTPService(useCase);

  const router = Router();
  const mdlFactory = sctx.mdlFactory;

  router.get("/my-cloud", mdlFactory.auth, httpService.getItemsAPI.bind(httpService));
  router.post("/my-cloud", mdlFactory.auth, httpService.createItemAPI.bind(httpService));
  router.delete("/my-cloud/:id", mdlFactory.auth, httpService.deleteItemAPI.bind(httpService));

  return router;
};
