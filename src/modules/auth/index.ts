import { Router } from "express";
import { ServiceContext } from "@share/interface/service-context";
import { AuthUseCase, IAuthUseCase } from "./usecase";
import { AuthHTTPService } from "./infras/transport";
import { MongoUserRepository } from "@modules/user/infras/repository/nosql/mongodb-repo";
import { RedisSessionStore } from "@modules/auth/infras/session/redis-session";
import { TokenBlacklistService } from "@modules/auth/infras/token/blacklist";

let redisClient: any = null;
let authUseCase: AuthUseCase;
let httpService: AuthHTTPService;

export const setAuthRedisClient = (client: any) => {
  redisClient = client;
};

export const getAuthUseCase = (): AuthUseCase => authUseCase;

export const setupAuthHexagon = (sctx: ServiceContext, redis: any) => {
  setAuthRedisClient(redis);

  const userRepository = new MongoUserRepository();
  const sessionStore = new RedisSessionStore(redis);
  const blacklistService = new TokenBlacklistService(redis);

  authUseCase = new AuthUseCase(userRepository, sessionStore, blacklistService);
  authUseCase.setRedisClient(redis);

  httpService = new AuthHTTPService(authUseCase);

  const router = Router();
  const mdlFactory = sctx.mdlFactory;

  router.post("/auth/register", httpService.registerAPI.bind(httpService));
  router.post("/auth/login", httpService.loginAPI.bind(httpService));
  router.post("/auth/refresh", httpService.refreshAPI.bind(httpService));
  router.post("/auth/logout", mdlFactory.auth, httpService.logoutAPI.bind(httpService));
  router.post("/auth/logout-all", mdlFactory.auth, httpService.logoutAllAPI.bind(httpService));
  router.post("/auth/introspect", mdlFactory.auth, httpService.introspectAPI.bind(httpService));
  router.post("/auth/send-verification", mdlFactory.auth, httpService.sendVerificationAPI.bind(httpService));
  router.post("/auth/verify-email", httpService.verifyEmailAPI.bind(httpService));
  router.post("/auth/resend-verification", mdlFactory.auth, httpService.resendVerificationAPI.bind(httpService));
  router.post("/auth/forgot-password", httpService.forgotPasswordAPI.bind(httpService));
  router.post("/auth/verify-reset-otp", httpService.verifyResetOTPAPI.bind(httpService));
  router.post("/auth/resend-reset-otp", httpService.resendResetOTPAPI.bind(httpService));
  router.post("/auth/reset-password", httpService.resetPasswordAPI.bind(httpService));
  router.post("/auth/change-password", mdlFactory.auth, httpService.changePasswordAPI.bind(httpService));
  router.get("/auth/sessions", mdlFactory.auth, httpService.listSessionsAPI.bind(httpService));
  router.delete("/auth/sessions/:deviceId", mdlFactory.auth, httpService.revokeSessionAPI.bind(httpService));
  router.delete("/auth/sessions", mdlFactory.auth, httpService.revokeAllSessionsAPI.bind(httpService));
  router.patch("/auth/avatar", mdlFactory.auth, httpService.updateAvatarAPI.bind(httpService));

  return { router, authUseCase };
};
