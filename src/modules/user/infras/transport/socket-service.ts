import { Server as SocketIOServer, Socket } from "socket.io";
import { IPresenceUseCase } from "../../interface";

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

      await this.presenceUseCase.touchSocket(userId, `default:${socket.id}`);

      socket.on("heartbeat", async () => {
        await this.presenceUseCase.touchSocket(userId, `default:${socket.id}`);
      });
    });
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const presence = await this.presenceUseCase.getUserPresence(userId);
    return presence.isOnline;
  }
}
