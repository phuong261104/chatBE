import { IBlockUseCase } from '@modules/blocks/interface';
import { BaseHttpService } from '@share/transport/http-server';
import { Request, Response } from 'express';
import { Block, BlockCondDTO, BlockCreateDTO, BlockUpdateDTO } from '../../model';

export class BlockHTTPService extends BaseHttpService<Block, BlockCreateDTO, BlockUpdateDTO, BlockCondDTO> {
  constructor(readonly usecase: IBlockUseCase) {
    super(usecase);
  }

  async blockUserAPI(req: Request, res: Response) {
    try {
      const requester = res.locals['requester'];
      const blockerId = requester.sub;
      const { blockedUserId } = req.params;

      const blockId = await this.usecase.blockUser(blockerId, String(blockedUserId));
      res.status(200).json({ data: { id: blockId, message: 'User blocked successfully' } });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message
      });
    }
  }

  async unblockUserAPI(req: Request, res: Response) {
    try {
      const requester = res.locals['requester'];
      const blockerId = requester.sub;
      const { blockedUserId } = req.params;

      await this.usecase.unblockUser(blockerId, String(blockedUserId));
      res.status(200).json({ data: { message: 'User unblocked successfully' } });
    } catch (error) {
      const err = error as Error;
      const statusCode = err.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        message: err.message
      });
    }
  }

  async getBlockedUsersAPI(req: Request, res: Response) {
    try {
      const requester = res.locals['requester'];
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
          hasMore: endIndex < blocks.length
        }
      });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message
      });
    }
  }

  async checkBlockStatusAPI(req: Request, res: Response) {
    try {
      const requester = res.locals['requester'];
      const blockerId = requester.sub;
      const { blockedUserId } = req.params;

      const isBlocked = await this.usecase.isBlocked(blockerId, String(blockedUserId));
      res.status(200).json({ data: { isBlocked } });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message
      });
    }
  }
}
