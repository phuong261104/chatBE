import { UserRole } from "@share/interface";
import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { Sequelize } from "sequelize";
import { UserHTTPService } from "./infras/transport";
import { UserUseCase } from "./usecase";
import { MongoUserRepository } from "./infras/repository/nosql/mongodb-repo";

export const setupUserHexagon = (sctx: ServiceContext) => {
  const repository = new MongoUserRepository();
  const useCase = new UserUseCase(repository);
  const httpService = new UserHTTPService(useCase);

  const router = Router();
  const mdlFactory = sctx.mdlFactory;
  const adminChecker = mdlFactory.allowRoles([UserRole.USER]);

  router.post("/register", httpService.registerAPI.bind(httpService));
  router.post("/authenticate", httpService.loginAPI.bind(httpService));
  router.get(
    "/profile",
    mdlFactory.auth,
    httpService.profileAPI.bind(httpService),
  );
  router.patch(
    "/profile",
    mdlFactory.auth,
    httpService.updateProfileAPI.bind(httpService),
  );

  router.post(
    "/users",
    mdlFactory.auth,
    adminChecker,
    httpService.createAPI.bind(httpService),
  );
  router.get("/users/:id", httpService.getDetailAPI.bind(httpService));
  router.get("/users", httpService.listAPI.bind(httpService));
  router.patch(
    "/users/:id",
    mdlFactory.auth,
    adminChecker,
    httpService.updateAPI.bind(httpService),
  );
  router.delete(
    "/users/:id",
    mdlFactory.auth,
    adminChecker,
    httpService.deleteAPI.bind(httpService),
  );

  // RPC API (use internally)
  router.post("/rpc/introspect", httpService.introspectAPI.bind(httpService));

  return router;
};
