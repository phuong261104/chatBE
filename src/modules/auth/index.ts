import { Router } from "express";
import { ServiceContext } from "@share/interface/service-context";
import { AuthUseCase } from "./usecase";
import { AuthRedisClient } from "./interface";
import { AuthHTTPService } from "./infras/transport";
import { DynamoUserRepository } from "@modules/user/infras/repository/dynamodb/dynamodb-repo";
import { RedisSessionStore } from "@modules/auth/infras/session/redis-session";
import { TokenBlacklistService } from "@modules/auth/infras/token/blacklist";
import { AccessTokenService } from "@modules/auth/infras/token/access-token";
import { RefreshTokenService } from "@modules/auth/infras/token/refresh-token";
import { RedisRefreshTokenStore } from "@modules/auth/infras/redis/refresh-store";
import { Handler } from "express";

let redisClient: AuthRedisClient | null = null;
let authUseCase: AuthUseCase;
let httpService: AuthHTTPService;

export const setAuthRedisClient = (client: AuthRedisClient) => {
  redisClient = client;
};

export const getAuthUseCase = (): AuthUseCase => authUseCase;

export const setupAuthHexagon = (sctx: ServiceContext | { mdlFactory: { auth: Handler } | null }, redis: AuthRedisClient) => {
  setAuthRedisClient(redis);

  const userRepository = new DynamoUserRepository();
  const sessionStore = new RedisSessionStore(redis);
  const blacklistService = new TokenBlacklistService(redis);
  const refreshTokenStore = new RedisRefreshTokenStore(redis);
  const accessTokenService = new AccessTokenService(blacklistService);
  const refreshTokenService = new RefreshTokenService(refreshTokenStore);

  authUseCase = new AuthUseCase(userRepository, sessionStore, blacklistService, accessTokenService, refreshTokenService);
  authUseCase.setRedisClient(redis);

  httpService = new AuthHTTPService(authUseCase);

  const router = Router();

  router.post("/auth/register", httpService.registerAPI.bind(httpService));
  router.post("/auth/login", httpService.loginAPI.bind(httpService));
  router.post("/auth/refresh", httpService.refreshAPI.bind(httpService));
  router.post("/auth/introspect", httpService.introspectAPI.bind(httpService));
  router.get("/auth/unverified-email", httpService.getUnverifiedEmailAPI.bind(httpService));
  router.post("/auth/verify-email", httpService.verifyEmailAPI.bind(httpService));
  router.post("/auth/forgot-password", httpService.forgotPasswordAPI.bind(httpService));
  router.post("/auth/verify-reset-otp", httpService.verifyResetOTPAPI.bind(httpService));
  router.post("/auth/reset-password", httpService.resetPasswordAPI.bind(httpService));
  router.post("/auth/resend-reset-otp", httpService.resendResetOTPAPI.bind(httpService));

  const mdlAuth = sctx.mdlFactory?.auth;
  const logoutMw = mdlAuth ? [mdlAuth] : [];
  router.post("/auth/logout", ...logoutMw, httpService.logoutAPI.bind(httpService));
  router.post("/auth/logout-all", ...logoutMw, httpService.logoutAllAPI.bind(httpService));
  router.post("/auth/send-verification", ...logoutMw, httpService.sendVerificationAPI.bind(httpService));
  router.post("/auth/resend-verification", ...logoutMw, httpService.resendVerificationAPI.bind(httpService));
  router.post("/auth/change-password", ...logoutMw, httpService.changePasswordAPI.bind(httpService));
  router.get("/auth/sessions", ...logoutMw, httpService.listSessionsAPI.bind(httpService));
  router.delete("/auth/sessions/:deviceId", ...logoutMw, httpService.revokeSessionAPI.bind(httpService));
  router.delete("/auth/sessions", ...logoutMw, httpService.revokeAllSessionsAPI.bind(httpService));
  router.patch("/auth/avatar", ...logoutMw, httpService.updateAvatarAPI.bind(httpService));

  return { router, authUseCase };
};
