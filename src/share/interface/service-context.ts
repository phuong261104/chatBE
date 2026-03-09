import { Handler } from "express";
import { UserRole } from "./index";
import { UploadMiddleware } from "../middleware/upload/upload-middleware";

export interface MdlFactory {
  auth: Handler;
  allowRoles: (roles: UserRole[]) => Handler;
  upload: UploadMiddleware;
}

export type ServiceContext = {
  mdlFactory: MdlFactory;
};
