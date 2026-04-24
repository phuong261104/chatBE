import {
  CloudItem,
  CloudItemStats,
  CloudItemCondDTO,
  LoadCloudItemsDTO,
  ShareResult,
} from "../model";
import { PagingDTO } from "@share/model/paging";

export interface IMyCloudUseCase {
  // Load items (page-based)
  getItems(
    userId: string,
    type?: string,
    paging?: PagingDTO
  ): Promise<{ items: CloudItem[]; total: number }>;

  // Load items (cursor-based)
  loadItems(
    userId: string,
    options: LoadCloudItemsDTO
  ): Promise<{ items: CloudItem[]; nextCursor?: string }>;

  // CRUD
  createItem(userId: string, data: any): Promise<CloudItem>;
  updateItem(userId: string, itemId: string, data: any): Promise<CloudItem>;
  deleteItem(userId: string, itemId: string): Promise<void>;

  // Trash
  restoreItem(userId: string, itemId: string): Promise<CloudItem>;
  permanentDeleteItem(userId: string, itemId: string): Promise<void>;
  emptyTrash(userId: string): Promise<{ deleted: number }>;

  // Pin
  pinItem(
    userId: string,
    itemId: string,
    pinned: boolean
  ): Promise<CloudItem>;

  // Stats
  getStats(userId: string): Promise<CloudItemStats>;

  // Search
  searchItems(
    userId: string,
    query: string,
    limit?: number
  ): Promise<CloudItem[]>;

  // Batch
  batchDelete(
    userId: string,
    itemIds: string[]
  ): Promise<{ deleted: number }>;

  // Share
  shareItem(
    userId: string,
    itemId: string,
    expiresInDays?: number
  ): Promise<ShareResult>;
  getByShareToken(token: string): Promise<CloudItem | null>;
}
