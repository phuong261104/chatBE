import { UserRole } from "@share/interface";
import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { Server as SocketIOServer } from "socket.io";
import { UserHTTPService } from "./infras/transport";
import { UserSocketService } from "./infras/transport/socket-service";
import { UserUseCase } from "./usecase";
import { PresenceUseCase } from "./usecase/presence-usecase";
import { RedisPresenceRepository } from "./infras/repository/redis/presence-repo";
import { DynamoUserRepository } from "./infras/repository/dynamodb/dynamodb-repo";
import { setSocketPresencePort } from "@share/component/socket-io";
import { setupUserV2Routes } from "./infras/transport/user-v2.routes";

export const setupUserHexagon = (sctx: ServiceContext, io?: SocketIOServer) => {
  const repository = new DynamoUserRepository();
  const presenceRepo = new RedisPresenceRepository();
  const presenceUseCase = new PresenceUseCase(presenceRepo);
  const useCase = new UserUseCase(repository);
  const httpService = new UserHTTPService(useCase, presenceUseCase);
  const v2Router = setupUserV2Routes(sctx, useCase, presenceUseCase, repository);

  let socketService = null;

  if (io) {
    setSocketPresencePort(presenceUseCase);
    socketService = new UserSocketService(io, presenceUseCase);
  }

  const router = Router();
  const mdlFactory = sctx.mdlFactory;
  const adminChecker = mdlFactory.allowRoles([UserRole.USER]);

  router.post("/users", mdlFactory.auth, adminChecker, httpService.createAPI.bind(httpService));
  router.get("/users/search", mdlFactory.auth, httpService.searchUsersAPI.bind(httpService));
  router.get("/users/search-by-phone", mdlFactory.auth, httpService.searchByPhoneAPI.bind(httpService));
  router.get("/users/:id/presence", mdlFactory.auth, httpService.getPresenceAPI.bind(httpService));
  router.get("/users/:id/public", httpService.publicProfileAPI.bind(httpService));
  router.get("/users/:id", httpService.getDetailAPI.bind(httpService));
  router.get("/users", httpService.listAPI.bind(httpService));
  router.patch("/users/:id", mdlFactory.auth, adminChecker, httpService.updateAPI.bind(httpService));
  router.delete("/users/:id", mdlFactory.auth, adminChecker, httpService.deleteAPI.bind(httpService));

  return {
    router,
    v2Router,
    profileAPI: httpService.profileAPI.bind(httpService),
    updateProfileAPI: httpService.updateProfileAPI.bind(httpService),
    socketService,
  };
};
