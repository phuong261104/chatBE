import "module-alias/register";

import mongoose from "mongoose";
import { config } from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import morgan from "morgan";
import { config as appConfig } from "@share/component/config";

config();

(async () => {
  try {
    await mongoose.connect(appConfig.mongoose.uri);
    console.log("Connected to MongoDB successfully.");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }

  const app = express();
  const httpServer = createServer(app);
  const port = process.env.PORT || 3000;

  app.use(express.json());
  app.use(morgan("dev"));

  httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
})();
