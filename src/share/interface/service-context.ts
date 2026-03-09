import { Handler } from "express";
import { UserRole } from "./index";

export interface MdlFactory {
  auth: Handler;
  allowRoles: (roles: UserRole[]) => Handler;
}

export type ServiceContext = {
  mdlFactory: MdlFactory;
};
