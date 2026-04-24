import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { DynamoCloudItemRepository } from "./infras/repository/dynamodb";
import { MyCloudUseCase } from "./usecase";
import { MyCloudHTTPService, MyCloudSocketService } from "./infras/transport";

export * from "./model";
export * from "./interface";

export const setupMyCloudHexagon = (
  sctx: ServiceContext,
  io?: any
): Router => {
  const repository = new DynamoCloudItemRepository();
  const useCase = new MyCloudUseCase(repository);
  const httpService = new MyCloudHTTPService(useCase);
  const socketService = io ? new MyCloudSocketService(io, useCase) : null;

  const router = Router();
  const mdlFactory = sctx.mdlFactory;

  // Load
  router.get("/my-cloud", mdlFactory.auth, httpService.getItemsAPI.bind(httpService));
  router.get(
    "/my-cloud/items",
    mdlFactory.auth,
    httpService.loadItemsAPI.bind(httpService)
  );

  // Create
  router.post(
    "/my-cloud",
    mdlFactory.auth,
    httpService.createItemAPI.bind(httpService)
  );

  // Update
  router.patch(
    "/my-cloud/:id",
    mdlFactory.auth,
    httpService.updateItemAPI.bind(httpService)
  );

  // Delete (soft)
  router.delete(
    "/my-cloud/:id",
    mdlFactory.auth,
    httpService.deleteItemAPI.bind(httpService)
  );

  // Restore / Permanent Delete / Empty Trash
  router.post(
    "/my-cloud/:id/restore",
    mdlFactory.auth,
    httpService.restoreItemAPI.bind(httpService)
  );
  router.delete(
    "/my-cloud/:id/permanent",
    mdlFactory.auth,
    httpService.permanentDeleteItemAPI.bind(httpService)
  );
  router.post(
    "/my-cloud/trash/empty",
    mdlFactory.auth,
    httpService.emptyTrashAPI.bind(httpService)
  );

  // Pin
  router.patch(
    "/my-cloud/:id/pin",
    mdlFactory.auth,
    httpService.pinItemAPI.bind(httpService)
  );

  // Stats & Search
  router.get(
    "/my-cloud/stats",
    mdlFactory.auth,
    httpService.getStatsAPI.bind(httpService)
  );
  router.get(
    "/my-cloud/search",
    mdlFactory.auth,
    httpService.searchAPI.bind(httpService)
  );

  // Batch
  router.post(
    "/my-cloud/batch-delete",
    mdlFactory.auth,
    httpService.batchDeleteAPI.bind(httpService)
  );

  // Share
  router.post(
    "/my-cloud/:id/share",
    mdlFactory.auth,
    httpService.shareItemAPI.bind(httpService)
  );
  router.get(
    "/my-cloud/shared/:token",
    httpService.getSharedItemAPI.bind(httpService)
  );

  return router;
};
