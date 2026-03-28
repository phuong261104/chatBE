import { Server as SocketIOServer, Socket } from "socket.io";
import { IPresenceUseCase } from "../../interface";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export class UserSocketService {
  private onlineUsers: Set<string> = new Set();

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

      this.onlineUsers.add(userId);
      await this.presenceUseCase.markUserOnline(userId);

      this.io.emit("user:online", { userId });

      socket.on("heartbeat", async () => {
        if (!this.onlineUsers.has(userId)) {
          this.onlineUsers.add(userId);
          this.io.emit("user:online", { userId });
        }
        await this.presenceUseCase.markUserOnline(userId);
      });

      socket.on("disconnect", async () => {
        this.onlineUsers.delete(userId);
        await this.presenceUseCase.markUserOffline(userId);
        this.io.emit("user:offline", { userId });
      });
    });
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}
