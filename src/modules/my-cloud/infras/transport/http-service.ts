import { Request, Response } from "express";
import { z } from "zod";
import { IMyCloudUseCase } from "../../interface";
import {
  CreateCloudItemDTOSchema,
  UpdateCloudItemDTOSchema,
  LoadCloudItemsDTOSchema,
  BatchDeleteCloudItemDTOSchema,
  ShareCloudItemDTOSchema,
} from "../../model";

const PageLimitSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class MyCloudHTTPService {
  constructor(private readonly useCase: IMyCloudUseCase) {}

  // ========== LOAD ==========

  async getItemsAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const parsed = PageLimitSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(422).json({ error: parsed.error.message });
        return;
      }
      const paging = parsed.data;
      const type = req.query.type as string | undefined;

      const result = await this.useCase.getItems(userId, type, paging);

      res.status(200).json({
        data: {
          items: result.items,
          total: result.total,
          page: paging.page,
          limit: paging.limit,
          hasMore: paging.page * paging.limit < result.total,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async loadItemsAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const parsed = LoadCloudItemsDTOSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(422).json({ error: "Validation error", details: parsed.error.errors });
        return;
      }

      const result = await this.useCase.loadItems(userId, parsed.data);
      res.status(200).json({ data: result.items, nextCursor: result.nextCursor });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ========== CREATE ==========

  async createItemAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const parsed = CreateCloudItemDTOSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "Validation error", details: parsed.error.errors });
        return;
      }

      const item = await this.useCase.createItem(userId, parsed.data);
      res.status(201).json({ data: item });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ========== UPDATE ==========

  async updateItemAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const parsed = UpdateCloudItemDTOSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "Validation error", details: parsed.error.errors });
        return;
      }

      const item = await this.useCase.updateItem(userId, req.params.id, parsed.data);
      res.status(200).json({ data: item });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ========== DELETE ==========

  async deleteItemAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      await this.useCase.deleteItem(userId, req.params.id);
      res.status(204).send();
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async restoreItemAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const item = await this.useCase.restoreItem(userId, req.params.id);
      res.status(200).json({ data: item });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async permanentDeleteItemAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      await this.useCase.permanentDeleteItem(userId, req.params.id);
      res.status(204).send();
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async emptyTrashAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const result = await this.useCase.emptyTrash(userId);
      res.status(200).json({ data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ========== PIN ==========

  async pinItemAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const pinned = req.body.pinned === true || req.body.pinned === "true";
      const item = await this.useCase.pinItem(userId, req.params.id, pinned);
      res.status(200).json({ data: item });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ========== STATS ==========

  async getStatsAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const stats = await this.useCase.getStats(userId);
      res.status(200).json({ data: stats });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ========== SEARCH ==========

  async searchAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const query = req.query.q as string;
      if (!query) {
        res.status(400).json({ error: "Query parameter 'q' is required" });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const items = await this.useCase.searchItems(userId, query, limit);
      res.status(200).json({ data: items });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ========== BATCH ==========

  async batchDeleteAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const parsed = BatchDeleteCloudItemDTOSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "Validation error", details: parsed.error.errors });
        return;
      }

      const result = await this.useCase.batchDelete(userId, parsed.data.itemIds);
      res.status(200).json({ data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ========== SHARE ==========

  async shareItemAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const parsed = ShareCloudItemDTOSchema.safeParse({
        itemId: req.params.id,
        ...req.body,
      });
      if (!parsed.success) {
        res.status(422).json({ error: "Validation error", details: parsed.error.errors });
        return;
      }

      const result = await this.useCase.shareItem(
        userId,
        parsed.data.itemId,
        parsed.data.expiresInDays
      );
      res.status(200).json({ data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getSharedItemAPI(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token;
      if (!token) {
        res.status(400).json({ error: "Token is required" });
        return;
      }

      const item = await this.useCase.getByShareToken(token);
      if (!item) {
        res.status(404).json({ error: "Shared item not found or expired" });
        return;
      }

      res.status(200).json({
        data: {
          fileUrl: item.fileUrl,
          title: item.title,
          type: item.type,
          thumbnailUrl: item.thumbnailUrl,
          mimetype: item.mimetype,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ========== HELPERS ==========

  private getUserId(req: Request, res: Response): string | null {
    const requester = res.locals["requester"];
    const userId = requester?.sub;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return userId;
  }

  private handleError(error: unknown, res: Response): void {
    if (error instanceof z.ZodError) {
      res.status(422).json({ error: "Validation error", details: error.errors });
      return;
    }
    const err = error as { statusCode?: number; message?: string };
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ error: err.message || "Internal error" });
  }
}
