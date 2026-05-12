import { Request, Response } from "express";
import { z } from "zod";
import { IMyCloudUseCase } from "../../interface";
import {
  CreateCloudItemDTOSchema,
  UpdateCloudItemDTOSchema,
  LoadCloudItemsDTOSchema,
  BatchDeleteCloudItemDTOSchema,
  ShareCloudItemDTOSchema,
  CreateCollectionDTOSchema,
  UpdateCollectionDTOSchema,
  AddItemToCollectionDTOSchema,
} from "../../model";
import { CloudItemType } from "../../model";
import { v7 } from "uuid";
import { createUploadMiddleware } from "@share/middleware/upload/upload-middleware";
import { CloudStorage } from "@share/middleware/upload/cloud-storage";
import { config } from "@share/component/config";

const DEFAULT_UPLOAD_CONFIG = {
  maxFileSize: 50 * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/mpeg", "video/quicktime",
    "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
};

function detectItemType(mimetype: string): CloudItemType {
  if (mimetype.startsWith("image/")) return CloudItemType.IMAGE;
  if (mimetype.startsWith("video/")) return CloudItemType.VIDEO;
  if (mimetype.startsWith("audio/")) return CloudItemType.VOICE;
  return CloudItemType.FILE;
}

const PageLimitSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const PresignedUploadDTOSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().optional(),
});

export class MyCloudHTTPService {
  private uploadMiddleware: any;
  private cloudStorage: CloudStorage;

  constructor(private readonly useCase: IMyCloudUseCase) {
    const cloudConfig = config.upload.cloud;
    this.cloudStorage = new CloudStorage(
      { ...DEFAULT_UPLOAD_CONFIG } as any,
      cloudConfig.bucketName || "your-bucket-name",
      cloudConfig.region || "us-east-1",
    );
    this.uploadMiddleware = createUploadMiddleware({ ...DEFAULT_UPLOAD_CONFIG } as any, this.cloudStorage);
  }

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
      const shareToken = req.params.shareToken;
      if (!shareToken) {
        res.status(400).json({ error: "shareToken is required" });
        return;
      }

      const item = await this.useCase.getByShareToken(shareToken);
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

  // ========== UPLOAD ==========

  async uploadAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const file = req.file as any;
      if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const itemType = detectItemType(file.mimetype);
      const item = await this.useCase.createItem(userId, {
        type: itemType,
        title: req.body.title || file.originalname,
        fileUrl: file.url,
        fileName: file.originalname,
        fileSize: file.size,
        mimetype: file.mimetype,
        thumbnailUrl: itemType === CloudItemType.IMAGE ? file.url : undefined,
      });

      res.status(201).json({ data: item });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getPresignedUploadUrlAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const parsed = PresignedUploadDTOSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "Validation error", details: parsed.error.errors });
        return;
      }

      const { fileName, contentType } = parsed.data;
      const draftToken = v7();
      const filename = this.cloudStorage.generateFilename(fileName);

      const uploadUrl = await this.cloudStorage.getPresignedUploadUrl(filename, contentType, 3600);

      res.status(200).json({
        data: {
          uploadUrl,
          fileKey: filename,
          draftToken,
          expiresIn: 3600,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async confirmUploadAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const { draftToken, fileKey, fileName, contentType, fileSize, title, collectionId } = req.body;

      if (!fileKey || !contentType) {
        res.status(400).json({ error: "Missing fileKey or contentType" });
        return;
      }

      const itemType = detectItemType(contentType);
      const fileUrl = this.cloudStorage.getFileUrl(fileKey);

      const item = await this.useCase.createItem(userId, {
        type: itemType,
        title: title || fileName,
        fileUrl,
        fileName: fileName || fileKey,
        fileSize: fileSize || 0,
        mimetype: contentType,
        thumbnailUrl: itemType === CloudItemType.IMAGE ? fileUrl : undefined,
        collectionId,
      });

      res.status(201).json({ data: item });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  getUploadMiddleware(): any {
    return this.uploadMiddleware;
  }

  // ========== UPLOAD ==========

  async forwardToChatAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const { conversationId } = req.body;
      const itemId = req.params.id;

      if (!conversationId) {
        res.status(400).json({ error: "conversationId is required" });
        return;
      }

      const item = await this.useCase.forwardToChat(
        userId,
        itemId,
        conversationId,
        (req as any).messagingFacade
      );

      res.status(200).json({ data: item });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ========== COLLECTIONS ==========

  async createCollectionAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const parsed = CreateCollectionDTOSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "Validation error", details: parsed.error.errors });
        return;
      }

      const collection = await this.useCase.createCollection(userId, parsed.data);
      res.status(201).json({ data: collection });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listCollectionsAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const collections = await this.useCase.listCollections(userId);
      res.status(200).json({ data: collections });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getCollectionAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const collection = await this.useCase.getCollection(userId, req.params.id);
      if (!collection) {
        res.status(404).json({ error: "Collection not found" });
        return;
      }
      res.status(200).json({ data: collection });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateCollectionAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const parsed = UpdateCollectionDTOSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "Validation error", details: parsed.error.errors });
        return;
      }

      const collection = await this.useCase.updateCollection(userId, req.params.id, parsed.data);
      res.status(200).json({ data: collection });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteCollectionAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      await this.useCase.deleteCollection(userId, req.params.id);
      res.status(204).send();
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async addItemToCollectionAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const parsed = AddItemToCollectionDTOSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "Validation error", details: parsed.error.errors });
        return;
      }

      await this.useCase.addItemToCollection(userId, req.params.id, parsed.data.itemId);
      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async removeItemFromCollectionAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      await this.useCase.removeItemFromCollection(userId, req.params.id, req.params.itemId);
      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getCollectionItemsAPI(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req, res);
      if (!userId) return;

      const items = await this.useCase.getCollectionItems(userId, req.params.id);
      res.status(200).json({ data: items });
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
