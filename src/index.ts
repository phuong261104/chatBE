import "module-alias/register";

import mongoose from "mongoose";
import { config } from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import morgan from "morgan";
import { config as appConfig } from "@share/component/config";
import { TokenIntrospectLocal } from "./share/repository/verify-token.rpc";
import { setupMiddlewares } from "./share/middleware";
import { setupUserHexagon } from "./modules/user";
import Logger from "./share/utils/logger";
import { responseErr } from "./share/app-error";
import { setupMediaHexagon } from "./modules/media";

config();

(async () => {
  Logger.info(`Starting server in  mode...`);

  try {
    await mongoose.connect(appConfig.mongoose.uri);
    Logger.info("Connected to MongoDB successfully.");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }

  const app = express();
  const httpServer = createServer(app);
  const port = process.env.PORT || 3000;

  app.use(express.json());
  app.use(morgan("dev"));

  const introspector = new TokenIntrospectLocal(
    appConfig.accessToken.secretKey,
  );
  const sctx = { mdlFactory: setupMiddlewares(introspector) };

  const userRouter = setupUserHexagon(sctx);
  const mediaRouter = setupMediaHexagon(sctx);

  app.use("/v1", userRouter);
  app.use("/v1", mediaRouter);

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    responseErr(err, res);
    return next();
  });

  httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
})();
