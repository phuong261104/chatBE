import { Request, Response } from "express";
import { z } from "zod";
import { IMyCloudUseCase } from "../../interface";

export class MyCloudHTTPService {
  constructor(private readonly useCase: IMyCloudUseCase) {}

  async getItemsAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester?.sub;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const type = req.query.type as string | undefined;

      const result = await this.useCase.getItems(userId, type, { page, limit });

      res.status(200).json({
        data: {
          items: result.items,
          total: result.total,
          page,
          limit,
          hasMore: page * limit < result.total,
        },
      });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async createItemAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester?.sub;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const item = await this.useCase.createItem(userId, req.body);

      res.status(201).json({ data: item });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async deleteItemAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const userId = requester?.sub;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const itemId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      await this.useCase.deleteItem(userId, String(itemId));

      res.status(204).send();
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }
}
