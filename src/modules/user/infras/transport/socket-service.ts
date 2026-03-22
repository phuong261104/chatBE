import { Server as SocketIOServer, Socket } from "socket.io";
import { IPresenceUseCase } from "../../interface";
import Logger from "@share/utils/logger";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export class UserSocketService {
  constructor(
    private readonly io: SocketIOServer,
    private readonly presenceUseCase: IPresenceUseCase,
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on("connection", async (socket: AuthenticatedSocket) => {
      const userId = socket.userId;

      if (!userId) {
        return;
      }

      // Mark user online immediately
      await this.presenceUseCase.markUserOnline(userId);

      // Listen for heartbeat to keep online status
      socket.on("heartbeat", async () => {
        await this.presenceUseCase.markUserOnline(userId);
      });

      // Handle disconnect
      socket.on("disconnect", async () => {
        await this.presenceUseCase.markUserOffline(userId);
      });
    });
  }
}
