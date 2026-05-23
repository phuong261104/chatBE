import "module-alias/register";

import { config } from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import morgan from "morgan";
import { config as appConfig } from "@share/component/config";
import { responseFormatMiddleware, setupMiddlewares } from "@share/middleware";
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
import { setupMyCloudHexagon } from "@modules/my-cloud";
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

(async () => {
  Logger.info(`Starting server in  mode...`);

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

  app.use(express.json());
  app.use(morgan("dev"));

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.use(
    cors({
      origin: (origin, callback) => {
        const origins = appConfig.cors.origins;
        const allowWildcard = origins.includes("*") && !appConfig.auth.refreshCookie.enabled;
        if (!origin || allowWildcard || origins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      allowedHeaders: "*",
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
  app.use("/v2", responseFormatMiddleware);

  const {
    router: userRouter,
    v2Router: userV2Router,
    profileAPI,
    updateProfileAPI,
  } = setupUserHexagon(sctx, io);

  app.use("/v1", authRouter);
  app.get("/v1/users/profile", sctx.mdlFactory.auth, profileAPI);
  app.patch("/v1/users/profile", sctx.mdlFactory.auth, updateProfileAPI);
  app.use("/v1", userRouter);
  app.use("/v2", userV2Router);

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
  app.use("/v1", messagingRouter);
  app.use("/v2", messagingV2Router);
  app.use("/v1", blockRouter);
  app.use("/v1", friendRequestRouter);
  app.use("/v1", friendshipRouter);
  app.use("/v2", blockRouter);
  app.use("/v2", friendRequestRouter);
  app.use("/v2", friendshipRouter);

  const myCloudRouter = setupMyCloudHexagon(sctx, io);
  const searchRouter = setupSearchHexagon(sctx);
  app.use("/v1", myCloudRouter);
  app.use("/v1", searchRouter);

  const { router: callRouter, v2Router: callV2Router } = setupCallHexagon(
    io,
    sctx,
    messagingSocketService,
  );
  app.use("/v1", callRouter);
  app.use("/v2", callV2Router);

  const { router: aiRouter } = setupAiHexagon({
    messageRepo: new DynamoMessageRepository(),
    conversationRepo: new DynamoConversationRepository(),
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
