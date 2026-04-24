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
    });
  }

  // ========== HANDLERS ==========

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
      socket.emit(MyCloudSocketEvents.ITEMS_LOADED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleCreateItem(socket: any, data: any): Promise<void> {
    try {
      const result = await this.useCase.createItem(socket.userId, data);
      socket.emit(MyCloudSocketEvents.ITEM_CREATED, { data: result });
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
      socket.emit(MyCloudSocketEvents.ITEM_UPDATED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleDeleteItem(socket: any, data: any): Promise<void> {
    try {
      await this.useCase.deleteItem(socket.userId, data.itemId);
      socket.emit(MyCloudSocketEvents.ITEM_DELETED, { data: { deleted: true } });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleRestoreItem(socket: any, data: any): Promise<void> {
    try {
      const result = await this.useCase.restoreItem(socket.userId, data.itemId);
      socket.emit(MyCloudSocketEvents.ITEM_RESTORED, { data: result });
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
      socket.emit(MyCloudSocketEvents.ITEM_PINNED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleGetStats(socket: any, _data: any): Promise<void> {
    try {
      const result = await this.useCase.getStats(socket.userId);
      socket.emit(MyCloudSocketEvents.STATS_LOADED, { data: result });
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
      socket.emit(MyCloudSocketEvents.SEARCH_RESULT, { data: result });
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
      socket.emit(MyCloudSocketEvents.ITEM_SHARED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private async handleEmptyTrash(socket: any, _data: any): Promise<void> {
    try {
      const result = await this.useCase.emptyTrash(socket.userId);
      socket.emit(MyCloudSocketEvents.TRASH_EMPTIED, { data: result });
    } catch (error) {
      this.emitError(socket, error);
    }
  }

  private emitError(socket: any, error: unknown): void {
    const err = error as { message?: string };
    socket.emit("error", { message: err.message || "Internal error" });
  }
}
