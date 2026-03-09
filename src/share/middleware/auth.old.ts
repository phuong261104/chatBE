import { Status, User } from "@modules/user/model";
import { Handler, NextFunction, Request, Response } from "express";
import { IQueryRepository, ITokenProvider, Requester } from "../interface";

export function authMiddleware(
  userRepo: IQueryRepository<User, any>,
  tokenProvider: ITokenProvider,
): Handler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Get token from header
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // 2. Verify token
      const requester = await tokenProvider.verifyToken(token) as Requester;

      // 3. Get user from database
      const user = await userRepo.get(requester.sub);

      // 4. Check user is exist
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // 5. Check user is banned or deleted
      const { status, role, id: userId } = user;

      if (status == Status.DELETED || status == Status.BANNED) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // 6. Set requester to res.locals
      res.locals['requester'] = { userId, role };

      return next();
    } catch (error) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  };
}