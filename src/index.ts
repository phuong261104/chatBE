import "module-alias/register";

import mongoose from "mongoose";
import { config } from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import morgan from "morgan";
import { config as appConfig } from "@share/component/config";
import { TokenIntrospectLocal } from "./share/repository/verify-token.rpc";
import { responseFormatMiddleware, setupMiddlewares } from "./share/middleware";
import { setupUserHexagon } from "./modules/user";
import { setupAuthHexagon } from "./modules/auth";
import Logger from "./share/utils/logger";
import { responseErr } from "./share/app-error";
import { setupMediaHexagon } from "./modules/media";
import { createSocketIOServer, connectionRegistry } from "@share/component/socket-io";
import { setupMessagingHexagon } from "@modules/chat";
import { setupBlockHexagon } from "@modules/blocks";
import { setupFriendRequestHexagon } from "@modules/friend-requests";
import { setupFriendshipHexagon } from "@modules/friendships";
import { setupMyCloudHexagon } from "@modules/my-cloud";
import { setupSearchHexagon } from "@modules/search";
import { setupPostHexagon } from "@modules/posts";
import { setupStoryHexagon } from "@modules/stories";
import path from "path";
import swaggerUi from "swagger-ui-express";
import SwaggerParser from "@apidevtools/swagger-parser";
import { RedisClient } from "./share/component/redis-pubsub/redis";
import { initDynamoDBTables } from "./share/repository/dynamodb/auto-init";

config();

(async () => {
  Logger.info(`Starting server in  mode...`);

  const connectionUrl = appConfig.redis.url as string;
  await RedisClient.init(connectionUrl);
  const redisClient = RedisClient.getClient();

  if (appConfig.dbType !== "dynamodb") {
    try {
      await mongoose.connect(appConfig.mongoose.uri);
      Logger.info("Connected to MongoDB successfully.");
    } catch (error) {
      console.error("MongoDB connection error:", error);
      process.exit(1);
    }
  } else {
    try {
      await initDynamoDBTables();
      Logger.info("DynamoDB tables initialized successfully.");
    } catch (error) {
      console.error("DynamoDB tables initialization error:", error);
      process.exit(1);
    }
  }

  const app = express();
  const httpServer = createServer(app);
  const port = process.env.PORT || 3000;

  app.use(express.json());
  app.use(morgan("dev"));

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Device-Id");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });

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

  const introspector = new TokenIntrospectLocal(appConfig.accessToken.secretKey);
  const sctx = { mdlFactory: setupMiddlewares(introspector) };

  app.use("/v1", responseFormatMiddleware);

  const io = createSocketIOServer(httpServer);

  const { router: authRouter, authUseCase } = setupAuthHexagon(sctx, redisClient);

  if (appConfig.envName === "development") {
    setTimeout(() => {
      if (authUseCase) {
        authUseCase.seedTestUsers().catch(console.error);
      }
    }, 2000);
  }

  const { router: userRouter, profileAPI, updateProfileAPI } = setupUserHexagon(sctx, io);

  app.use("/v1", authRouter);
  app.get("/v1/users/profile", sctx.mdlFactory.auth, profileAPI);
  app.patch("/v1/users/profile", sctx.mdlFactory.auth, updateProfileAPI);
  app.use("/v1", userRouter);

  const mediaRouter = setupMediaHexagon(sctx);
  const { router: messagingRouter } = setupMessagingHexagon(io, sctx);
  const blockRouter = setupBlockHexagon(sctx);
  const { router: friendRequestRouter, socketService } = setupFriendRequestHexagon(sctx, io);
  const friendshipRouter = setupFriendshipHexagon(sctx, socketService);
  app.use("/v1", mediaRouter);
  app.use("/v1", messagingRouter);
  app.use("/v1", blockRouter);
  app.use("/v1", friendRequestRouter);
  app.use("/v1", friendshipRouter);

  const myCloudRouter = setupMyCloudHexagon(sctx);
  const searchRouter = setupSearchHexagon(sctx);
  const postRouter = setupPostHexagon(sctx);
  const storyRouter = setupStoryHexagon(sctx);
  app.use("/v1", myCloudRouter);
  app.use("/v1", searchRouter);
  app.use("/v1", postRouter);
  app.use("/v1", storyRouter);

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    responseErr(err, res);
    return;
  });

  httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`[Socket.IO] Initialized with ${connectionRegistry.getOnlineUsers().length} online users (from previous session)`);
  });
})();
