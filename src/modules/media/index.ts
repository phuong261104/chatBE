import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { MediaHttpService } from "./infras/transport";
import { UploadMediaCmdHandler } from "./usecase/upload-media";
import { UploadMultipleMediaCmdHandler } from "./usecase/upload-multiple-media";
import { DeleteMediaCmdHandler } from "./usecase/delete-media";
import { RequestPresignedUrlCmdHandler } from "./usecase/request-presigned-url";
import { ConfirmUploadCmdHandler } from "./usecase/confirm-upload";

export const setupMediaHexagon = (sctx: ServiceContext) => {
  const mdlFactory = sctx.mdlFactory;

  const uploadMediaHandler = new UploadMediaCmdHandler();
  const uploadMultipleMediaHandler = new UploadMultipleMediaCmdHandler();
  const deleteMediaHandler = new DeleteMediaCmdHandler(mdlFactory.upload);
  const requestPresignedUrlHandler = new RequestPresignedUrlCmdHandler(mdlFactory.upload.getStorage());
  const confirmUploadHandler = new ConfirmUploadCmdHandler();

  const httpService = new MediaHttpService(
    uploadMediaHandler,
    uploadMultipleMediaHandler,
    deleteMediaHandler,
    requestPresignedUrlHandler,
    confirmUploadHandler,
  );

  const router = Router();

  router.post(
    "/media/upload",
    mdlFactory.auth,
    mdlFactory.upload.single("file"),
    httpService.uploadSingleAPI.bind(httpService),
  );

  router.post(
    "/media/upload-multiple",
    mdlFactory.auth,
    mdlFactory.upload.array("files", 10),
    httpService.uploadMultipleAPI.bind(httpService),
  );

  router.delete(
    "/media/:filename",
    mdlFactory.auth,
    httpService.deleteAPI.bind(httpService),
  );

  router.post(
    "/media/request-upload-url",
    mdlFactory.auth,
    httpService.requestPresignedUrlAPI.bind(httpService),
  );

  router.post(
    "/media/confirm-upload",
    mdlFactory.auth,
    httpService.confirmUploadAPI.bind(httpService),
  );

  router.get(
    "/media/upload-methods",
    mdlFactory.auth,
    httpService.getUploadMethodsAPI.bind(httpService),
  );

  return router;
};
