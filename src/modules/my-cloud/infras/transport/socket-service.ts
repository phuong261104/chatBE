import { Server as SocketIOServer } from "socket.io";
import { MyCloudUseCase } from "../../usecase";
import { MyCloudSocketEvents } from "../../constants/socket-events";

export class MyCloudSocketService {
  constructor(
    private readonly io: SocketIOServer,
    private readonly useCase: MyCloudUseCase
  ) {
    this.registerHandlers();
  }

  private async verifyToken(token: string): Promise<string | null> {
    try {
      const jwtProvider = require("@share/component/jwt").jwtProvider;
      const payload = await jwtProvider.verifyToken(token);
      return payload?.sub || null;
    } catch {
      return null;
    }
  }

  private emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  private registerHandlers(): void {
    this.io.on("connection", async (socket: any) => {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) return;

      const userId = await this.verifyToken(token);
      if (!userId) return;

      socket.userId = userId;
      socket.join(`user:${userId}`);

      socket.on(MyCloudSocketEvents.LOAD_ITEMS, (data: any) =>
        this.handleLoadItems(socket, data)
      );
      socket.on(MyCloudSocketEvents.CREATE_ITEM, (data: any) =>
        this.handleCreateItem(socket, data)
      );
      socket.on(MyCloudSocketEvents.UPDATE_ITEM, (data: any) =>
        this.handleUpdateItem(socket, data)
      );
      socket.on(MyCloudSocketEvents.DELETE_ITEM, (data: any) =>
        this.handleDeleteItem(socket, data)
      );
      socket.on(MyCloudSocketEvents.RESTORE_ITEM, (data: any) =>
        this.handleRestoreItem(socket, data)
      );
      socket.on(MyCloudSocketEvents.PIN_ITEM, (data: any) =>
        this.handlePinItem(socket, data)
      );
      socket.on(MyCloudSocketEvents.GET_STATS, (data: any) =>
        this.handleGetStats(socket, data)
      );
      socket.on(MyCloudSocketEvents.SEARCH_ITEMS, (data: any) =>
        this.handleSearchItems(socket, data)
      );
      socket.on(MyCloudSocketEvents.SHARE_ITEM, (data: any) =>
        this.handleShareItem(socket, data)
      );
      socket.on(MyCloudSocketEvents.EMPTY_TRASH, (data: any) =>
        this.handleEmptyTrash(socket, data)
      );

      socket.on(MyCloudSocketEvents.CREATE_COLLECTION, (data: any) =>
        this.handleCreateCollection(socket, data)
      );
      socket.on(MyCloudSocketEvents.UPDATE_COLLECTION, (data: any) =>
        this.handleUpdateCollection(socket, data)
      );
      socket.on(MyCloudSocketEvents.DELETE_COLLECTION, (data: any) =>
        this.handleDeleteCollection(socket, data)
      );
      socket.on(MyCloudSocketEvents.LIST_COLLECTIONS, (_data: any) =>
        this.handleListCollections(socket)
      );
      socket.on(MyCloudSocketEvents.ADD_ITEM_TO_COLLECTION, (data: any) =>
        this.handleAddItemToCollection(socket, data)
      );
      socket.on(MyCloudSocketEvents.REMOVE_ITEM_FROM_COLLECTION, (data: any) =>
        this.handleRemoveItemFromCollection(socket, data)
      );
    });
  }

  private async handleLoadItems(socket: any, data: any): Promise<void> {
    try {
      const { limit, type, isDeleted, isPinned, cursor } = data || {};
      const result = await this.useCase.loadItems(socket.userId, {
        limit: limit || 20,
        type,
        isDeleted,
        isPinned,
        cursor,
      });
      this.emitToUser(socket.userId, MyCloudSocketEvents.ITEMS_LOADED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleCreateItem(socket: any, data: any): Promise<void> {
    try {
      const result = await this.useCase.createItem(socket.userId, data);
      this.emitToUser(socket.userId, MyCloudSocketEvents.ITEM_CREATED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleUpdateItem(socket: any, data: any): Promise<void> {
    try {
      const { itemId, ...updates } = data;
      const result = await this.useCase.updateItem(
        socket.userId,
        itemId,
        updates
      );
      this.emitToUser(socket.userId, MyCloudSocketEvents.ITEM_UPDATED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleDeleteItem(socket: any, data: any): Promise<void> {
    try {
      await this.useCase.deleteItem(socket.userId, data.itemId);
      this.emitToUser(socket.userId, MyCloudSocketEvents.ITEM_DELETED, { data: { deleted: true } });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleRestoreItem(socket: any, data: any): Promise<void> {
    try {
      const result = await this.useCase.restoreItem(socket.userId, data.itemId);
      this.emitToUser(socket.userId, MyCloudSocketEvents.ITEM_RESTORED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handlePinItem(socket: any, data: any): Promise<void> {
    try {
      const result = await this.useCase.pinItem(
        socket.userId,
        data.itemId,
        data.pinned
      );
      this.emitToUser(socket.userId, MyCloudSocketEvents.ITEM_PINNED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleGetStats(socket: any, _data: any): Promise<void> {
    try {
      const result = await this.useCase.getStats(socket.userId);
      this.emitToUser(socket.userId, MyCloudSocketEvents.STATS_LOADED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleSearchItems(socket: any, data: any): Promise<void> {
    try {
      const { query, limit } = data || {};
      const result = await this.useCase.searchItems(
        socket.userId,
        query,
        limit || 20
      );
      this.emitToUser(socket.userId, MyCloudSocketEvents.SEARCH_RESULT, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleShareItem(socket: any, data: any): Promise<void> {
    try {
      const result = await this.useCase.shareItem(
        socket.userId,
        data.itemId,
        data.expiresInDays
      );
      this.emitToUser(socket.userId, MyCloudSocketEvents.ITEM_SHARED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleEmptyTrash(socket: any, _data: any): Promise<void> {
    try {
      const result = await this.useCase.emptyTrash(socket.userId);
      this.emitToUser(socket.userId, MyCloudSocketEvents.TRASH_EMPTIED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleCreateCollection(socket: any, data: any): Promise<void> {
    try {
      const result = await this.useCase.createCollection(socket.userId, data);
      this.emitToUser(socket.userId, MyCloudSocketEvents.COLLECTION_CREATED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleUpdateCollection(socket: any, data: any): Promise<void> {
    try {
      const { collectionId, ...updates } = data;
      const result = await this.useCase.updateCollection(socket.userId, collectionId, updates);
      this.emitToUser(socket.userId, MyCloudSocketEvents.COLLECTION_UPDATED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleDeleteCollection(socket: any, data: any): Promise<void> {
    try {
      await this.useCase.deleteCollection(socket.userId, data.collectionId);
      this.emitToUser(socket.userId, MyCloudSocketEvents.COLLECTION_DELETED, { data: { deleted: true, collectionId: data.collectionId } });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleListCollections(socket: any): Promise<void> {
    try {
      const result = await this.useCase.listCollections(socket.userId);
      this.emitToUser(socket.userId, MyCloudSocketEvents.COLLECTIONS_LISTED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleAddItemToCollection(socket: any, data: any): Promise<void> {
    try {
      await this.useCase.addItemToCollection(socket.userId, data.collectionId, data.itemId);
      this.emitToUser(socket.userId, MyCloudSocketEvents.COLLECTION_ITEM_ADDED, { data: { success: true, collectionId: data.collectionId, itemId: data.itemId } });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleRemoveItemFromCollection(socket: any, data: any): Promise<void> {
    try {
      await this.useCase.removeItemFromCollection(socket.userId, data.collectionId, data.itemId);
      this.emitToUser(socket.userId, MyCloudSocketEvents.COLLECTION_ITEM_REMOVED, { data: { success: true, collectionId: data.collectionId, itemId: data.itemId } });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private emitError(socket: any, error: unknown): void {
    const err = error as { message?: string };
    socket.emit("error", { message: err.message || "Internal error" });
  }
}
