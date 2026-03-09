import { Handler, NextFunction, Request, Response } from "express";
import { ErrForbidden, ErrUnauthorized, responseErr } from "../app-error";
import { Requester, UserRole } from "../interface";

export function allowRoles(roles: UserRole[]): Handler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.requester) {
      responseErr(ErrUnauthorized, res);
      return;
    }

    const requester = res.locals.requester as Requester;

    if (roles.indexOf(requester.role) === -1) {
      responseErr(ErrForbidden.withLog(`This user has role: ${requester.role}`), res);
      return;
    }

    next();
  };
}