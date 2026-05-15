import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { jwtProvider } from '@share/component/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
}

export class CallV2SocketService {
  private namespace: Namespace;
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer) {
    this.namespace = io.of('/v2/calls');
    this.namespace.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.query?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) return next(new Error('Authentication error: No token provided'));

        const payload = await jwtProvider.verifyToken(token);
        if (!payload || !payload.sub) return next(new Error('Authentication error: Invalid token'));

        socket.userId = payload.sub;
        socket.deviceId = socket.handshake.auth?.deviceId || socket.handshake.query?.deviceId as string;
        next();
      } catch {
        next(new Error('Authentication error'));
      }
    });
    this.setupEventHandlers();
  }

  notifyIncomingCall(userId: string, callData: unknown) {
    this.emitToUser(userId, 'call:incoming', callData);
  }

  notifyOngoingCall(userId: string, callData: unknown) {
    this.emitToUser(userId, 'call:ongoing', callData);
  }

  notifyJoined(callId: string, payload: unknown) {
    this.emitToCall(callId, 'call:joined', payload);
  }

  notifyLeft(callId: string, payload: unknown) {
    this.emitToCall(callId, 'call:left', payload);
  }

  notifyDeclined(callId: string, payload: unknown) {
    this.emitToCall(callId, 'call:declined', payload);
  }

  notifyMissed(callId: string, payload: unknown) {
    this.emitToCall(callId, 'call:missed', payload);
  }

  notifyBusy(userId: string, payload: unknown) {
    this.emitToUser(userId, 'call:busy', payload);
  }

  notifyEnded(callId: string, payload: unknown) {
    this.emitToCall(callId, 'call:ended', payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.namespace.to(`user:${userId}`).emit(event, payload);
  }

  emitToCall(callId: string, event: string, payload: unknown) {
    this.namespace.to(`call:${callId}`).emit(event, payload);
  }

  private setupEventHandlers() {
    this.namespace.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId;
      if (!userId) {
        socket.disconnect();
        return;
      }

      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(socket.id);

      socket.join(`user:${userId}`);

      socket.on('call:join', (payload: { callId: string }) => {
        if (!payload?.callId) return;
        socket.join(`call:${payload.callId}`);
        socket.emit('call:joined', { callId: payload.callId, socketOnly: true });
      });

      socket.on('call:leave', (payload: { callId: string }) => {
        if (!payload?.callId) return;
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
}
