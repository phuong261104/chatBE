import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { DynamoCloudItemRepository, DynamoCollectionRepository } from "./infras/repository/dynamodb";
import { MyCloudUseCase } from "./usecase";
import { MyCloudHTTPService, MyCloudSocketService } from "./infras/transport";

export * from "./model";
export * from "./interface";

export const setupMyCloudHexagon = (
  sctx: ServiceContext,
  io?: any
): Router => {
  const repository = new DynamoCloudItemRepository();
  const collectionRepository = new DynamoCollectionRepository();
  const useCase = new MyCloudUseCase(repository, collectionRepository);
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
    "/my-cloud/shared/:shareToken",
    httpService.getSharedItemAPI.bind(httpService)
  );

  // Upload
  router.post(
    "/my-cloud/upload",
    mdlFactory.auth,
    httpService.getUploadMiddleware().single("file"),
    httpService.uploadAPI.bind(httpService)
  );
  router.post(
    "/my-cloud/upload/presigned",
    mdlFactory.auth,
    httpService.getPresignedUploadUrlAPI.bind(httpService)
  );
  router.post(
    "/my-cloud/upload/confirm",
    mdlFactory.auth,
    httpService.confirmUploadAPI.bind(httpService)
  );

  // Forward to chat
  router.post(
    "/my-cloud/:id/forward",
    mdlFactory.auth,
    httpService.forwardToChatAPI.bind(httpService)
  );

  // Collections
  router.post(
    "/my-cloud/collections",
    mdlFactory.auth,
    httpService.createCollectionAPI.bind(httpService)
  );
  router.get(
    "/my-cloud/collections",
    mdlFactory.auth,
    httpService.listCollectionsAPI.bind(httpService)
  );
  router.get(
    "/my-cloud/collections/:id",
    mdlFactory.auth,
    httpService.getCollectionAPI.bind(httpService)
  );
  router.patch(
    "/my-cloud/collections/:id",
    mdlFactory.auth,
    httpService.updateCollectionAPI.bind(httpService)
  );
  router.delete(
    "/my-cloud/collections/:id",
    mdlFactory.auth,
    httpService.deleteCollectionAPI.bind(httpService)
  );
  router.post(
    "/my-cloud/collections/:id/items",
    mdlFactory.auth,
    httpService.addItemToCollectionAPI.bind(httpService)
  );
  router.delete(
    "/my-cloud/collections/:id/items/:itemId",
    mdlFactory.auth,
    httpService.removeItemFromCollectionAPI.bind(httpService)
  );
  router.get(
    "/my-cloud/collections/:id/items",
    mdlFactory.auth,
    httpService.getCollectionItemsAPI.bind(httpService)
  );

  return router;
};
