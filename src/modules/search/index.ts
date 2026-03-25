import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { SearchUseCase } from "./usecase";
import { SearchHTTPService } from "./infras/transport";

export * from "./model";
export * from "./interface";

export const setupSearchHexagon = (sctx: ServiceContext) => {
  const useCase = new SearchUseCase();
  const httpService = new SearchHTTPService(useCase);

  const router = Router();
  const mdlFactory = sctx.mdlFactory;

  router.get("/search", mdlFactory.auth, httpService.globalSearchAPI.bind(httpService));

  return router;
};
