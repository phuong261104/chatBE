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
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from "../model";
import { DynamoCloudItemRepository, DynamoCollectionRepository } from "../infras/repository/dynamodb";
import { PagingDTO } from "@share/model/paging";
import { MediaType } from "@modules/chat/model/model";

const notFound = () => AppError.from(new Error("Cloud item not found"), 404);
const forbidden = () => AppError.from(new Error("Unauthorized"), 403);
const collectionNotFound = () => AppError.from(new Error("Collection not found"), 404);
const cannotDeleteDefault = () => AppError.from(new Error("Cannot delete default collection"), 400);

export class MyCloudUseCase implements IMyCloudUseCase {
  constructor(
    private readonly repository: DynamoCloudItemRepository,
    private readonly collectionRepository: DynamoCollectionRepository
  ) {}

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

    let collectionId = validated.collectionId;
    if (!collectionId) {
      const defaultCollection = await this.collectionRepository.ensureDefaultCollection(userId);
      collectionId = defaultCollection.id;
    }

    const now = new Date();
    const newItem: CloudItem = {
      id: v7(),
      userId,
      collectionId,
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
    await this.collectionRepository.updateItemCount(collectionId, 1);

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

    if (item.collectionId) {
      await this.collectionRepository.updateItemCount(item.collectionId, -1);
    }
  }

  async restoreItem(userId: string, itemId: string): Promise<CloudItem> {
    const item = await this.repository.get(itemId);
    if (!item) throw notFound();
    if (item.userId !== userId) throw forbidden();

    await this.repository.restore(itemId);

    if (item.collectionId) {
      await this.collectionRepository.updateItemCount(item.collectionId, 1);
    }

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

    if (item.collectionId) {
      await this.collectionRepository.updateItemCount(item.collectionId, -1);
    }
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

  async createCollection(userId: string, data: CreateCollectionDTO): Promise<Collection> {
    await this.collectionRepository.ensureDefaultCollection(userId);

    const now = new Date();
    const collection: Collection = {
      id: v7(),
      userId,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      coverImageUrl: data.coverImageUrl,
      parentId: data.parentId,
      isDefault: false,
      isDeleted: false,
      itemCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.collectionRepository.insert(collection);
    return collection;
  }

  async updateCollection(
    userId: string,
    collectionId: string,
    data: UpdateCollectionDTO
  ): Promise<Collection> {
    const collection = await this.collectionRepository.get(collectionId);
    if (!collection) throw collectionNotFound();
    if (collection.userId !== userId) throw forbidden();
    if (collection.isDefault) {
      throw AppError.from(new Error("Cannot update default collection"), 400);
    }

    await this.collectionRepository.update(collectionId, data);
    return { ...collection, ...data, updatedAt: new Date() };
  }

  async deleteCollection(userId: string, collectionId: string): Promise<void> {
    const collection = await this.collectionRepository.get(collectionId);
    if (!collection) throw collectionNotFound();
    if (collection.userId !== userId) throw forbidden();
    if (collection.isDefault) throw cannotDeleteDefault();

    const defaultCollection = await this.collectionRepository.getDefaultCollection(userId);
    if (defaultCollection && collection.itemCount > 0) {
      const { itemIds } = await this.collectionRepository.getCollectionItems(collectionId);
      for (const itemId of itemIds) {
        await this.collectionRepository.addItemToCollection(defaultCollection.id, itemId, userId);
        await this.collectionRepository.updateItemCount(defaultCollection.id, 1);
      }
    }

    if (collection.itemCount > 0) {
      await this.collectionRepository.updateItemCount(collectionId, -collection.itemCount);
    }

    await this.collectionRepository.softDelete(collectionId);
  }

  async listCollections(userId: string): Promise<Collection[]> {
    return this.collectionRepository.list({ userId });
  }

  async getCollection(userId: string, collectionId: string): Promise<Collection | null> {
    const collection = await this.collectionRepository.get(collectionId);
    if (!collection) return null;
    if (collection.userId !== userId) return null;
    return collection;
  }

  async addItemToCollection(
    userId: string,
    collectionId: string,
    itemId: string
  ): Promise<void> {
    const collection = await this.collectionRepository.get(collectionId);
    if (!collection) throw collectionNotFound();
    if (collection.userId !== userId) throw forbidden();

    const item = await this.repository.get(itemId);
    if (!item) throw notFound();
    if (item.userId !== userId) throw forbidden();

    if (item.collectionId && item.collectionId !== collectionId) {
      await this.collectionRepository.removeItemFromCollection(item.collectionId, itemId);
      const oldCollection = await this.collectionRepository.get(item.collectionId);
      if (oldCollection) {
        await this.collectionRepository.updateItemCount(oldCollection.id, -1);
      }
    }

    await this.collectionRepository.addItemToCollection(collectionId, itemId, userId);
    await this.collectionRepository.updateItemCount(collectionId, 1);

    await this.repository.update(itemId, { collectionId } as any);
  }

  async removeItemFromCollection(
    userId: string,
    collectionId: string,
    itemId: string
  ): Promise<void> {
    const collection = await this.collectionRepository.get(collectionId);
    if (!collection) throw collectionNotFound();
    if (collection.userId !== userId) throw forbidden();

    const item = await this.repository.get(itemId);
    if (!item) throw notFound();
    if (item.userId !== userId) throw forbidden();

    await this.collectionRepository.removeItemFromCollection(collectionId, itemId);
    await this.collectionRepository.updateItemCount(collectionId, -1);

    const defaultCollection = await this.collectionRepository.ensureDefaultCollection(userId);
    await this.collectionRepository.addItemToCollection(defaultCollection.id, itemId, userId);
    await this.collectionRepository.updateItemCount(defaultCollection.id, 1);

    await this.repository.update(itemId, { collectionId: defaultCollection.id } as any);
  }

  async getCollectionItems(userId: string, collectionId: string): Promise<CloudItem[]> {
    const collection = await this.collectionRepository.get(collectionId);
    if (!collection) throw collectionNotFound();
    if (collection.userId !== userId) throw forbidden();

    const { itemIds } = await this.collectionRepository.getCollectionItems(collectionId);
    return this.repository.listByIds(itemIds);
  }

  async getDefaultCollection(userId: string): Promise<Collection> {
    return this.collectionRepository.ensureDefaultCollection(userId);
  }

  async forwardToChat(
    userId: string,
    cloudItemId: string,
    conversationId: string,
    messagingFacade: any
  ): Promise<any> {
    const item = await this.repository.get(cloudItemId);
    if (!item) throw notFound();
    if (item.userId !== userId) throw forbidden();

    const mediaType = this.getMediaType(item.type);
    const media = [{
      url: item.fileUrl!,
      mediaType,
      name: item.fileName || item.title,
      size: item.fileSize,
      thumbnailUrl: item.thumbnailUrl,
    }];

    return messagingFacade.sendMessage(conversationId, userId, item.title, media);
  }

  private getMediaType(type: CloudItemType): MediaType {
    switch (type) {
      case CloudItemType.IMAGE:
        return MediaType.IMAGE;
      case CloudItemType.VIDEO:
        return MediaType.VIDEO;
      case CloudItemType.VOICE:
        return MediaType.AUDIO;
      default:
        return MediaType.FILE;
    }
  }
}
