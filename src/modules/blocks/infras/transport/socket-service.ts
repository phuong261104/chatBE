import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { jwtProvider } from '@share/component/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
}

interface NotificationPayload {
  type: 'USER_BLOCKED' | 'USER_UNBLOCKED';
  data: any;
  timestamp: Date;
}

export class BlockNotificationSocketService {
  private namespace: Namespace;
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer) {
    this.namespace = io.of('/blocks');

    this.namespace.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.query?.token ||
          socket.handshake.headers?.authorization?.replace("Bearer ", "");

        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        const payload = await jwtProvider.verifyToken(token);

        if (!payload || !payload.sub) {
          return next(new Error("Authentication error: Invalid token"));
        }

        socket.userId = payload.sub;
        socket.deviceId = socket.handshake.auth?.deviceId || socket.handshake.query?.deviceId as string;

        next();
      } catch (error) {
        next(new Error("Authentication error"));
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.namespace.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId;

      if (!userId) {
        socket.disconnect();
        return;
      }

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      socket.join(`user:${userId}`);

      socket.on('disconnect', () => {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.userSockets.delete(userId);
          }
        }
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  notifyUserBlocked(blockedUserId: string, blockerId: string) {
    const payload: NotificationPayload = {
      type: 'USER_BLOCKED',
      data: { blockedBy: blockerId },
      timestamp: new Date(),
    };

    this.namespace.to(`user:${blockedUserId}`).emit('block:blocked', payload);
  }

  notifyUserUnblocked(unblockedUserId: string, unblockedBy: string) {
    const payload: NotificationPayload = {
      type: 'USER_UNBLOCKED',
      data: { unblockedBy },
      timestamp: new Date(),
    };

    this.namespace.to(`user:${unblockedUserId}`).emit('block:unblocked', payload);
  }
}
