import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { jwtProvider } from '@share/component/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
}

interface NotificationPayload {
  type: 'FRIEND_REQUEST_RECEIVED' | 'FRIEND_REQUEST_ACCEPTED' | 'FRIEND_REQUEST_REJECTED' | 'FRIEND_REQUEST_CANCELED';
  data: any;
  timestamp: Date;
}

export class FriendNotificationSocketService {
  private namespace: Namespace;
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer) {
    this.namespace = io.of('/friends');

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
        console.error("[Friends Namespace] Socket auth error:", error);
        next(new Error("Authentication error"));
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.namespace.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId;
      console.log(`[Friends Namespace] User ${userId} connected (socket: ${socket.id})`);

      if (!userId) {
        console.log(`[Friends Namespace] Rejecting connection - no userId`);
        socket.disconnect();
        return;
      }

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      socket.join(`user:${userId}`);

      socket.on('disconnect', () => {
        console.log(`[Friends Namespace] User ${userId} disconnected (socket: ${socket.id})`);
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
      timestamp: new Date()
    };

    this.namespace.to(`user:${userId}`).emit('friend_request:received', payload);
    console.log(`[Friends] Notified user ${userId} about new friend request from ${data.fromUserId}`);
  }

  notifyFriendRequestAccepted(userId: string, data: any) {
    const payload: NotificationPayload = {
      type: 'FRIEND_REQUEST_ACCEPTED',
      data,
      timestamp: new Date()
    };

    this.namespace.to(`user:${userId}`).emit('friend_request:accepted', payload);
    console.log(`[Friends] Notified user ${userId} that friend request was accepted`);
  }

  notifyFriendRequestRejected(userId: string, data: any) {
    const payload: NotificationPayload = {
      type: 'FRIEND_REQUEST_REJECTED',
      data,
      timestamp: new Date()
    };

    this.namespace.to(`user:${userId}`).emit('friend_request:rejected', payload);
    console.log(`[Friends] Notified user ${userId} that friend request was rejected`);
  }

  notifyFriendRequestCanceled(userId: string, data: any) {
    const payload: NotificationPayload = {
      type: 'FRIEND_REQUEST_CANCELED',
      data,
      timestamp: new Date()
    };

    this.namespace.to(`user:${userId}`).emit('friend_request:canceled', payload);
    console.log(`[Friends] Notified user ${userId} that friend request was canceled`);
  }

  notifyUnfriended(userId: string, data: any) {
    const payload = {
      type: 'UNFRIENDED',
      data,
      timestamp: new Date()
    };

    this.namespace.to(`user:${userId}`).emit('friendship:unfriended', payload);
    console.log(`[Friends] Notified user ${userId} about being unfriended by ${data.unfriendedBy}`);
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  getUserConnectionCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }
}
