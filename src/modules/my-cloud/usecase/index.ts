import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import { IMyCloudUseCase } from "../interface";
import {
  CloudItem,
  createCloudItemDTOSchema,
  ErrCloudItemNotFound,
  ErrCloudItemUnauthorized,
} from "../model";
import { PagingDTO } from "@share/model/paging";
import { MongoCloudItemRepository } from "../infras/repository";

export class MyCloudUseCase implements IMyCloudUseCase {
  constructor(private readonly repository: MongoCloudItemRepository) {}

  async getItems(
    userId: string,
    type?: string,
    paging?: PagingDTO,
  ): Promise<{ items: CloudItem[]; total: number }> {
    const page = paging?.page || 1;
    const limit = paging?.limit || 20;

    const cond: any = { userId };
    if (type) cond.type = type;

    const total = await this.repository.countByUserId(userId, type);
    const items = await this.repository.list(cond, { page, limit });

    return { items, total };
  }

  async createItem(userId: string, data: any): Promise<CloudItem> {
    const validated = createCloudItemDTOSchema.parse(data);

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
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.insert(newItem);
    return newItem;
  }

  async deleteItem(userId: string, itemId: string): Promise<void> {
    const item = await this.repository.get(itemId);

    if (!item) {
      throw AppError.from(ErrCloudItemNotFound, 404);
    }

    if (item.userId !== userId) {
      throw AppError.from(ErrCloudItemUnauthorized, 403);
    }

    await this.repository.delete(itemId, true);
  }
}
