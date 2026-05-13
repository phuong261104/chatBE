import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { jwtProvider } from '@share/component/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
}

interface AnsweredPayload {
  callId: string;
  roomName: string;
  token?: string;
  wsUrl?: string;
}

export class CallSocketService {
  private namespace: Namespace;
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer) {
    this.namespace = io.of('/socket/calls');

    this.namespace.use(async (socket: AuthenticatedSocket, next) => {
      console.log('[CallSocket namespace] incoming connection, path:', socket.request?.url, 'method:', socket.request?.method);
      next();
    });

    this.namespace.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.query?.token ||
          socket.handshake.headers?.authorization?.replace("Bearer ", "");

        if (!token) return next(new Error("Authentication error: No token provided"));

        const payload = await jwtProvider.verifyToken(token);
        if (!payload || !payload.sub) return next(new Error("Authentication error: Invalid token"));

        socket.userId = payload.sub;
        socket.deviceId = socket.handshake.auth?.deviceId || socket.handshake.query?.deviceId as string;

        next();
      } catch {
        next(new Error("Authentication error"));
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.namespace.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId;
      if (!userId) { socket.disconnect(); return; }

      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(socket.id);

      socket.join(`user:${userId}`);

      socket.on('call:join', (payload: { callId: string }) => {
        socket.join(`call:${payload.callId}`);
        socket.emit('call:joined', { callId: payload.callId });
      });

      socket.on('call:leave', (payload: { callId: string }) => {
        socket.leave(`call:${payload.callId}`);
      });

      socket.on('disconnect', () => {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) this.userSockets.delete(userId);
        }
      });
    });
  }

  notifyIncomingCall(userId: string, callData: any) {
    this.namespace.to(`user:${userId}`).emit('call:incoming', callData);
  }

  notifyRinging(userId: string, callId: string) {
    this.namespace.to(`user:${userId}`).emit('call:ringing', { callId });
  }

  notifyAnswered(userId: string, callId: string, roomName: string, token?: string, wsUrl?: string) {
    const payload: AnsweredPayload = { callId, roomName, token, wsUrl };
    this.namespace.to(`user:${userId}`).emit('call:answered', payload);
  }

  notifyRejected(userId: string, callId: string) {
    this.namespace.to(`user:${userId}`).emit('call:rejected', { callId });
  }

  notifyEnded(userId: string, callId: string) {
    this.namespace.to(`user:${userId}`).emit('call:ended', { callId });
  }

  notifyMissed(userId: string, callId: string) {
    this.namespace.to(`user:${userId}`).emit('call:missed', { callId });
  }
}
