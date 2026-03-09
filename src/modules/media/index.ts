import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { MediaHttpService } from "./infras/transport";
import { UploadMediaCmdHandler } from "./usecase/upload-media";
import { UploadMultipleMediaCmdHandler } from "./usecase/upload-multiple-media";
import { DeleteMediaCmdHandler } from "./usecase/delete-media";

export const setupMediaHexagon = (sctx: ServiceContext) => {
  const mdlFactory = sctx.mdlFactory;

  const uploadMediaHandler = new UploadMediaCmdHandler();
  const uploadMultipleMediaHandler = new UploadMultipleMediaCmdHandler();
  const deleteMediaHandler = new DeleteMediaCmdHandler(mdlFactory.upload);

  const httpService = new MediaHttpService(
    uploadMediaHandler,
    uploadMultipleMediaHandler,
    deleteMediaHandler,
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

  return router;
};
