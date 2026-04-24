import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import { IMyCloudUseCase } from "../interface";
import {
  CloudItem,
  CloudItemType,
  CreateCloudItemDTOSchema,
  UpdateCloudItemDTOSchema,
  CloudItemStats,
  LoadCloudItemsDTO,
} from "../model";
import { DynamoCloudItemRepository } from "../infras/repository/dynamodb";
import { PagingDTO } from "@share/model/paging";

const notFound = () => AppError.from(new Error("Cloud item not found"), 404);
const forbidden = () => AppError.from(new Error("Unauthorized"), 403);

export class MyCloudUseCase implements IMyCloudUseCase {
  constructor(private readonly repository: DynamoCloudItemRepository) {}

  async getItems(
    userId: string,
    type?: string,
    paging?: PagingDTO
  ): Promise<{ items: CloudItem[]; total: number }> {
    const page = paging?.page || 1;
    const limit = paging?.limit || 20;

    const cond: any = { userId };
    if (type) cond.type = type;

    const total = await this.repository.countByUserId(userId, type);
    const items = await this.repository.list(cond, { page, limit });

    return { items, total };
  }

  async loadItems(
    userId: string,
    options: LoadCloudItemsDTO
  ): Promise<{ items: CloudItem[]; nextCursor?: string }> {
    const typeMap: Record<string, string> = {
      image: CloudItemType.IMAGE,
      video: CloudItemType.VIDEO,
      voice: CloudItemType.VOICE,
      file: CloudItemType.FILE,
      link: CloudItemType.LINK,
      note: CloudItemType.NOTE,
    };

    const cond: any = { userId };
    if (options.type && options.type !== "all") {
      cond.type = typeMap[options.type];
    }
    if (options.isDeleted !== undefined) {
      cond.isDeleted = String(options.isDeleted);
    }
    if (options.isPinned !== undefined) {
      cond.isPinned = String(options.isPinned);
    }

    return this.repository.loadByUserId({
      userId,
      type: cond.type,
      isDeleted: cond.isDeleted,
      isPinned: cond.isPinned,
      limit: options.limit,
      cursor: options.cursor,
      sortOrder: "desc",
    });
  }

  async createItem(userId: string, data: any): Promise<CloudItem> {
    const validated = CreateCloudItemDTOSchema.parse(data);

    const now = new Date();
    const newItem: CloudItem = {
      id: v7(),
      userId,
      type: validated.type,
      title: validated.title,
      content: validated.content,
      fileUrl: validated.fileUrl,
      fileName: validated.fileName,
      fileSize: validated.fileSize,
      mimetype: validated.mimetype,
      thumbnailUrl: validated.thumbnailUrl,
      isPinned: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.insert(newItem);
    return newItem;
  }

  async updateItem(
    userId: string,
    itemId: string,
    data: any
  ): Promise<CloudItem> {
    const item = await this.repository.get(itemId);
    if (!item) throw notFound();
    if (item.userId !== userId) throw forbidden();

    const validated = UpdateCloudItemDTOSchema.parse(data);
    await this.repository.update(itemId, validated);

    return { ...item, ...validated, updatedAt: new Date() };
  }

  async deleteItem(userId: string, itemId: string): Promise<void> {
    const item = await this.repository.get(itemId);
    if (!item) throw notFound();
    if (item.userId !== userId) throw forbidden();

    await this.repository.softDelete(itemId);
  }

  async restoreItem(userId: string, itemId: string): Promise<CloudItem> {
    const item = await this.repository.get(itemId);
    if (!item) throw notFound();
    if (item.userId !== userId) throw forbidden();

    await this.repository.restore(itemId);

    return { ...item, isDeleted: false, deletedAt: undefined };
  }

  async permanentDeleteItem(
    userId: string,
    itemId: string
  ): Promise<void> {
    const item = await this.repository.get(itemId);
    if (!item) throw notFound();
    if (item.userId !== userId) throw forbidden();

    await this.repository.delete(itemId, true);
  }

  async emptyTrash(userId: string): Promise<{ deleted: number }> {
    const deleted = await this.repository.emptyTrash(userId);
    return { deleted };
  }

  async pinItem(
    userId: string,
    itemId: string,
    pinned: boolean
  ): Promise<CloudItem> {
    const item = await this.repository.get(itemId);
    if (!item) throw notFound();
    if (item.userId !== userId) throw forbidden();

    await this.repository.pin(itemId, pinned);
    return { ...item, isPinned: pinned };
  }

  async getStats(userId: string): Promise<CloudItemStats> {
    return this.repository.getStats(userId);
  }

  async searchItems(
    userId: string,
    query: string,
    limit: number = 20
  ): Promise<CloudItem[]> {
    return this.repository.search(userId, query, limit);
  }

  async batchDelete(
    userId: string,
    itemIds: string[]
  ): Promise<{ deleted: number }> {
    let deleted = 0;
    for (const itemId of itemIds) {
      const item = await this.repository.get(itemId);
      if (item && item.userId === userId) {
        await this.repository.softDelete(itemId);
        deleted++;
      }
    }
    return { deleted };
  }

  async shareItem(
    userId: string,
    itemId: string,
    expiresInDays: number = 7
  ): Promise<import("../model").ShareResult> {
    const item = await this.repository.get(itemId);
    if (!item) throw notFound();
    if (item.userId !== userId) throw forbidden();

    const shareToken = v7();
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000
    );

    await this.repository.setShareToken(itemId, shareToken, expiresAt);

    return {
      shareToken,
      shareUrl: `/my-cloud/shared/${shareToken}`,
      expiresAt,
    };
  }

  async getByShareToken(token: string): Promise<CloudItem | null> {
    return this.repository.getByShareToken(token);
  }
}
