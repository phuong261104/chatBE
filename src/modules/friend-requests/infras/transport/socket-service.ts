import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { authenticateSocketConnection } from '@share/component/socket-io';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
}

interface NotificationPayload {
  type: 'FRIEND_REQUEST_RECEIVED' | 'FRIEND_REQUEST_ACCEPTED' | 'FRIEND_REQUEST_REJECTED' | 'FRIEND_REQUEST_CANCELED' | 'BLOCK_DETECTED';
  data: any;
  timestamp: Date;
}

export class FriendNotificationSocketService {
  private namespace: Namespace;
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer) {
    this.namespace = io.of('/friends');

    this.namespace.use(async (socket: AuthenticatedSocket, next) => {
      await authenticateSocketConnection(socket, next);
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

  notifyFriendRequestReceived(userId: string, data: any) {
    const payload: NotificationPayload = {
      type: 'FRIEND_REQUEST_RECEIVED',
      data,
      timestamp: new Date(),
    };
    this.namespace.to(`user:${userId}`).emit('friend_request:received', payload);
  }

  notifyFriendRequestAccepted(userId: string, data: any) {
    const payload: NotificationPayload = {
      type: 'FRIEND_REQUEST_ACCEPTED',
      data,
      timestamp: new Date(),
    };
    this.namespace.to(`user:${userId}`).emit('friend_request:accepted', payload);
  }

  notifyFriendRequestRejected(userId: string, data: any) {
    const payload: NotificationPayload = {
      type: 'FRIEND_REQUEST_REJECTED',
      data,
      timestamp: new Date(),
    };
    this.namespace.to(`user:${userId}`).emit('friend_request:rejected', payload);
  }

  notifyFriendRequestCanceled(userId: string, data: any) {
    const payload: NotificationPayload = {
      type: 'FRIEND_REQUEST_CANCELED',
      data,
      timestamp: new Date(),
    };
    this.namespace.to(`user:${userId}`).emit('friend_request:canceled', payload);
  }

  notifyUnfriended(userId: string, data: any) {
    const payload = {
      type: 'UNFRIENDED',
      data,
      timestamp: new Date(),
    };
    this.namespace.to(`user:${userId}`).emit('friendship:unfriended', payload);
  }

  notifyBlockDetected(userId: string, direction: 'BLOCKING' | 'BLOCKED_BY', blockedUserId?: string, blockerId?: string) {
    const payload: NotificationPayload = {
      type: 'BLOCK_DETECTED',
      data: { direction, blockedUserId, blockerId },
      timestamp: new Date(),
    };
    this.namespace.to(`user:${userId}`).emit('block:detected', payload);
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  getUserConnectionCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }
}
