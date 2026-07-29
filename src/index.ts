import "./share/component/module-aliases";

import { config } from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import morgan from "morgan";
import {
  config as appConfig,
  validateRuntimeConfig,
} from "@share/component/config";
import { responseFormatMiddleware, setupMiddlewares } from "@share/middleware";
import { createRateLimitMiddleware } from "@share/utils/rate-limiter";
import { healthCheck } from "@share/middleware/health-check";
import { setupUserHexagon } from "@modules/user";
import { setupAuthHexagon } from "@modules/auth";
import Logger from "@share/utils/logger";
import { responseErr } from "@share/app-error";
import { setupMediaHexagon } from "@modules/media";
import {
  createSocketIOServer,
  connectionRegistry,
  setSocketTokenIntrospector,
} from "@share/component/socket-io";
import { setupMessagingHexagon } from "@modules/chat";
import { setupBlockHexagon } from "@modules/blocks";
import { setupFriendRequestHexagon } from "@modules/friend-requests";
import { setupFriendshipHexagon } from "@modules/friendships";
import { setupSearchHexagon } from "@modules/search";
import { setupAiHexagon } from "@modules/ai";
import { setupCallHexagon } from "@modules/call";
// import { seedAiTestData } from "@modules/ai/infras/ai-seed";
import {
  DynamoMessageRepository,
  DynamoConversationRepository,
} from "@modules/chat";
import path from "path";
import swaggerUi from "swagger-ui-express";
import SwaggerParser from "@apidevtools/swagger-parser";
import { RedisClient } from "@share/component/redis-pubsub/redis";
import { initDynamoDBTables } from "@share/repository/dynamodb/auto-init";
import cors from "cors";

config();

const getRateLimitClientIp = (req: Request): string => {
  const cfConnectingIp = req.header("cf-connecting-ip")?.trim();
  return cfConnectingIp || req.ip || "unknown";
};

(async () => {
  Logger.info(`Starting server in  mode...`);
  validateRuntimeConfig();

  const connectionUrl = appConfig.redis.url as string;
  await RedisClient.init(connectionUrl);
  const redisClient = RedisClient.getClient();

  try {
    await initDynamoDBTables();
    Logger.info("DynamoDB tables initialized successfully.");
  } catch (error) {
    console.error("DynamoDB tables initialization error:", error);
    process.exit(1);
  }

  const app = express();
  const httpServer = createServer(app);
  const port = process.env.PORT || 3000;

  app.set("trust proxy", 1);

  app.get("/health", healthCheck);
  app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/health/ready", healthCheck);

  app.use(express.json());
  app.use(morgan("dev"));

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.use(
    cors({
      origin: (origin, callback) => {
        // Dev convenience: allow all origins when explicitly configured.
        // Note: When `credentials: true`, CORS cannot use `*` as Access-Control-Allow-Origin.
        const origins = appConfig.cors.origins;
        const allowAll = origins.includes("*");

        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowAll) {
          callback(null, true);
          return;
        }

        if (origins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
      methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      allowedHeaders: "*",
      exposedHeaders: [
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After",
      ],
      credentials: appConfig.auth.refreshCookie.enabled,
    }),
  );
  // app.use((req, res, next) => {
  //   res.header("Access-Control-Allow-Origin", "*");
  //   res.header(
  //     "Access-Control-Allow-Methods",
  //     "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  //   );
  //   res.header(
  //     "Access-Control-Allow-Headers",
  //     "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Device-Id, x-display-label",
  //   );

  //   if (req.method === "OPTIONS") {
  //     return res.sendStatus(200);
  //   }

  //   next();
  // });

  if (appConfig.rateLimit.enabled) {
    const globalLimiter = createRateLimitMiddleware({
      max: appConfig.rateLimit.global.max,
      windowSec: appConfig.rateLimit.global.windowSec,
      keyPrefix: "global",
      keyGenerator: (req: Request) => getRateLimitClientIp(req),
    });
    app.use(globalLimiter);
  }

  try {
    const swaggerDocument = (await SwaggerParser.dereference(
      path.join(process.cwd(), "docs/swagger/main.yaml"),
    )) as any;

    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument, {
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "BE Chat API Documentation",
      }),
    );
  } catch (error) {
    Logger.error("Failed to load swagger documentation: " + error);
  }

  const io = createSocketIOServer(httpServer);

  const { router: _authRouter, authUseCase } = setupAuthHexagon(
    { mdlFactory: null as any },
    redisClient,
  );
  const sctx = { mdlFactory: setupMiddlewares(authUseCase) };
  const { router: authRouter, authUseCase: mountedAuthUseCase } = setupAuthHexagon(sctx, redisClient);
  setSocketTokenIntrospector(mountedAuthUseCase);

  // if (appConfig.envName === "development") {
  //   setTimeout(() => {
  //     if (authUseCase) {
  //       authUseCase.seedTestUsers().catch(console.error);
  //     }
  //     seedAiTestData().catch(console.error);
  //   }, 2000);
  // }

  app.use("/v1", responseFormatMiddleware);

  const {
    router: userRouter,
    v2Router: userV2Router,
  } = setupUserHexagon(sctx, io);

  app.use("/v1", authRouter);
  app.use("/v1", userV2Router);
  app.use("/v1", userRouter);

  const mediaRouter = setupMediaHexagon(sctx);
  const {
    router: messagingRouter,
    v2Router: messagingV2Router,
    socketService: messagingSocketService,
  } = setupMessagingHexagon(io, sctx);
  const { router: blockRouter } = setupBlockHexagon(sctx, io);
  const { router: friendRequestRouter, socketService } =
    setupFriendRequestHexagon(sctx, io);
  const friendshipRouter = setupFriendshipHexagon(sctx, socketService);
  app.use("/v1", mediaRouter);
  app.use("/v1", messagingV2Router);
  app.use("/v1", messagingRouter);
  app.use("/v1", blockRouter);
  app.use("/v1", friendRequestRouter);
  app.use("/v1", friendshipRouter);

  const searchRouter = setupSearchHexagon(sctx);
  app.use("/v1", searchRouter);

  const { router: callRouter } = setupCallHexagon(
    io,
    sctx,
    messagingSocketService,
  );
  app.use("/v1", callRouter);

  const { router: aiRouter } = setupAiHexagon({
    messageRepo: new DynamoMessageRepository(),
    conversationRepo: new DynamoConversationRepository(),
    io,
  });
  app.use("/v1/ai", sctx.mdlFactory.auth, aiRouter);

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    responseErr(err, res);
    return;
  });

  httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(
      `[Socket.IO] Initialized with ${connectionRegistry.getOnlineUsers().length} online users (from previous session)`,
    );
  });
})();
