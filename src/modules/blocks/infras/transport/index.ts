import { IBlockUseCase } from "@modules/blocks/interface";
import { BaseHttpService } from "@share/transport/http-server";
import { Request, Response } from "express";
import {
  Block,
  BlockCondDTO,
  BlockCreateDTO,
  BlockCursorListQuerySchema,
  BlockUpdateDTO,
} from "../../model";
import { AppError } from "@share/app-error";
import { BlockNotificationSocketService } from "./socket-service";

export { BlockNotificationSocketService };

export class BlockHTTPService extends BaseHttpService<
  Block,
  BlockCreateDTO,
  BlockUpdateDTO,
  BlockCondDTO
> {
  private socketService?: BlockNotificationSocketService;

  constructor(readonly usecase: IBlockUseCase) {
    super(usecase);
  }

  setSocketService(socketService: BlockNotificationSocketService) {
    this.socketService = socketService;
  }

  async blockUserAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const blockerId = requester.sub;
      const { blockedUserId } = req.params;

      const blockId = await this.usecase.blockUser(
        blockerId,
        String(blockedUserId),
      );

      if (this.socketService) {
        this.socketService.notifyUserBlocked(String(blockedUserId), blockerId);
      }

      res
        .status(200)
        .json({ data: { id: blockId, message: "User blocked successfully" } });
    } catch (error) {
      const err = error as Error;
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({
        message: err.message,
      });
    }
  }

  async unblockUserAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const blockerId = requester.sub;
      const { blockedUserId } = req.params;

      await this.usecase.unblockUser(blockerId, String(blockedUserId));

      if (this.socketService) {
        this.socketService.notifyUserUnblocked(String(blockedUserId), blockerId);
      }

      res.status(204).send();
    } catch (error) {
      const err = error as Error;
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({
        message: err.message,
      });
    }
  }

  async getBlockedUsersAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const blockerId = requester.sub;
      const blocks = await this.usecase.getBlockedUsers(blockerId);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      const paginatedBlocks = blocks.slice(startIndex, endIndex);

      res.status(200).json({
        data: {
          items: paginatedBlocks,
          total: blocks.length,
          page,
          limit,
          hasMore: endIndex < blocks.length,
        },
      });
    } catch (error) {
      const err = error as Error;
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({
        message: err.message,
      });
    }
  }

  async getBlockedUsersCursorAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const blockerId = requester.sub;
      const query = BlockCursorListQuerySchema.parse(req.query);
      const result = await this.usecase.getBlockedUsersCursor(blockerId, query);

      res.status(200).json({ data: result });
    } catch (error) {
      const err = error as Error;
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({
        message: err.message,
      });
    }
  }

  async checkBlockStatusAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const blockerId = requester.sub;
      const { blockedUserId } = req.params;

      const isBlocked = await this.usecase.isBlocked(
        blockerId,
        String(blockedUserId),
      );
      res.status(200).json({ data: { isBlocked } });
    } catch (error) {
      const err = error as Error;
      if (err instanceof AppError) {
        res.status((err as AppError).getStatusCode()).json({ message: err.message });
        return;
      }
      res.status(400).json({
        message: err.message,
      });
    }
  }
}
