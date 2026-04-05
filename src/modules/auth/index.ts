import { Router } from "express";
import { ServiceContext } from "@share/interface/service-context";
import { AuthUseCase } from "./usecase";
import { AuthHTTPService } from "./infras/transport";
import { MongoUserRepository } from "@modules/user/infras/repository/nosql/mongodb-repo";

export const setupAuthHexagon = (sctx: ServiceContext) => {
  const userRepository = new MongoUserRepository();
  const authUseCase = new AuthUseCase(userRepository);
  const httpService = new AuthHTTPService(authUseCase);

  const router = Router();

  router.post("/auth/register", httpService.registerAPI.bind(httpService));
  router.post("/auth/login", httpService.loginAPI.bind(httpService));
  router.post("/auth/introspect", httpService.introspectAPI.bind(httpService));

  return { router, authUseCase };
};
