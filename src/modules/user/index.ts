import { UserRole } from "@share/interface";
import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { Server as SocketIOServer } from "socket.io";
import { UserHTTPService } from "./infras/transport";
import { UserSocketService } from "./infras/transport/socket-service";
import { UserUseCase } from "./usecase";
import { PresenceUseCase } from "./usecase/presence-usecase";
import { MongoUserRepository } from "./infras/repository/nosql/mongodb-repo";
import { RedisPresenceRepository } from "./infras/repository/redis/presence-repo";

export const setupUserHexagon = (sctx: ServiceContext, io?: SocketIOServer) => {
  const repository = new MongoUserRepository();
  const presenceRepo = new RedisPresenceRepository();
  const presenceUseCase = new PresenceUseCase(presenceRepo);
  const useCase = new UserUseCase(repository);
  const httpService = new UserHTTPService(useCase, presenceUseCase);

  let socketService = null;

  if (io) {
    socketService = new UserSocketService(io, presenceUseCase);
  }

  const router = Router();
  const mdlFactory = sctx.mdlFactory;
  const adminChecker = mdlFactory.allowRoles([UserRole.USER]);

  router.post("/auth/register", httpService.registerAPI.bind(httpService));
  router.post("/auth/login", httpService.loginAPI.bind(httpService));
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
  router.get(
    "/users/search",
    mdlFactory.auth,
    httpService.searchByPhoneAPI.bind(httpService),
  );
  router.get(
    "/users/:id/presence",
    mdlFactory.auth,
    httpService.getPresenceAPI.bind(httpService),
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

  return { router, socketService };
};
