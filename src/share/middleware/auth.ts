import { Handler, NextFunction, Request, Response } from "express";
import { ITokenIntrospect, Requester } from "../interface";

export function authMiddleware(
  introspector: ITokenIntrospect,
): Handler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Get token from header
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // 2. Introspect token
      const { payload, error, isOk } = await introspector.introspect(token);
      
      if (!isOk) {
        res.status(401).json({ error: error?.message || 'Unauthorized' });
        return;
      }

      const requester = payload as Requester;

      // 3. Set requester to res.locals
      res.locals['requester'] = requester;

      return next();
    } catch (error) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  };
}