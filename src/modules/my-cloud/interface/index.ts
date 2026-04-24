import {
  CloudItem,
  CloudItemStats,
  CloudItemCondDTO,
  LoadCloudItemsDTO,
  ShareResult,
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
  CollectionCondDTO,
} from "../model";
import { PagingDTO } from "@share/model/paging";

export interface ICollectionRepository {
  get(id: string): Promise<Collection | null>;
  findByCond(cond: CollectionCondDTO): Promise<Collection | null>;
  list(cond: CollectionCondDTO): Promise<Collection[]>;
  insert(data: Collection): Promise<boolean>;
  update(id: string, data: UpdateCollectionDTO): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  softDelete(id: string): Promise<boolean>;
  ensureDefaultCollection(userId: string): Promise<Collection>;
  getDefaultCollection(userId: string): Promise<Collection | null>;
  addItemToCollection(collectionId: string, itemId: string, userId: string): Promise<boolean>;
  removeItemFromCollection(collectionId: string, itemId: string): Promise<boolean>;
  getCollectionItems(collectionId: string, limit?: number, cursor?: string): Promise<{ itemIds: string[]; nextCursor?: string }>;
  updateItemCount(collectionId: string, delta: number): Promise<void>;
}

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

  // Collections
  createCollection(userId: string, data: CreateCollectionDTO): Promise<Collection>;
  updateCollection(userId: string, collectionId: string, data: UpdateCollectionDTO): Promise<Collection>;
  deleteCollection(userId: string, collectionId: string): Promise<void>;
  listCollections(userId: string): Promise<Collection[]>;
  getCollection(userId: string, collectionId: string): Promise<Collection | null>;
  addItemToCollection(userId: string, collectionId: string, itemId: string): Promise<void>;
  removeItemFromCollection(userId: string, collectionId: string, itemId: string): Promise<void>;
  getCollectionItems(userId: string, collectionId: string): Promise<CloudItem[]>;
  getDefaultCollection(userId: string): Promise<Collection>;

  // Forward to chat
  forwardToChat(userId: string, cloudItemId: string, conversationId: string, messagingFacade: any): Promise<any>;
}
