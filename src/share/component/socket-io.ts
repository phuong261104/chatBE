import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { jwtProvider } from "./jwt";

export enum ConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
}

export interface AuthenticatedSocket {
  userId?: string;
  id: string;
  deviceId?: string;
  platform?: string;
  connectionState: ConnectionState;
  connectedAt: number;
  lastActivityAt: number;
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, ...args: any[]) => boolean;
  on: (event: string, listener: (...args: any[]) => void) => void;
  disconnect: (close?: boolean) => void;
}

export interface ConnectionRegistry {
  getSocketsByUserId(userId: string): string[];
  addSocket(userId: string, socketId: string, metadata?: ConnectionMetadata): void;
  removeSocket(socketId: string): string | null;
  isUserOnline(userId: string): boolean;
  getOnlineUsers(): string[];
  getAllConnections(): Map<string, ConnectionMetadata>;
}

interface SocketPresencePort {
  registerSocket(userId: string, socketId: string): Promise<{ becameOnline: boolean; connectionCount: number }>;
  touchSocket(userId: string, socketId: string): Promise<{ isOnline: boolean; connectionCount: number }>;
  unregisterSocket(userId: string, socketId: string): Promise<{ becameOffline: boolean; connectionCount: number }>;
  getUserPresence(userId: string): Promise<{ isOnline: boolean; lastSeen: number | null }>;
}

let socketPresencePort: SocketPresencePort | null = null;

export function setSocketPresencePort(port: SocketPresencePort): void {
  socketPresencePort = port;
}

interface AddSocketMetadata {
  deviceId?: string;
  platform?: string;
}

interface ConnectionMetadata {
  socketId: string;
  userId: string;
  deviceId?: string;
  platform?: string;
  connectedAt: number;
  lastActivityAt: number;
}

class InMemoryConnectionRegistry implements ConnectionRegistry {
  private connections: Map<string, ConnectionMetadata> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();

  getSocketsByUserId(userId: string): string[] {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  addSocket(userId: string, socketId: string, metadata?: AddSocketMetadata): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);

    const connMeta: ConnectionMetadata = {
      socketId,
      userId,
      deviceId: metadata?.deviceId,
      platform: metadata?.platform,
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    this.connections.set(socketId, connMeta);
  }

  removeSocket(socketId: string): string | null {
    const metadata = this.connections.get(socketId);
    if (!metadata) return null;

    this.connections.delete(socketId);

    const userSockets = this.userSockets.get(metadata.userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.userSockets.delete(metadata.userId);
        return metadata.userId;
      }
    }
    return null;
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets ? sockets.size > 0 : false;
  }

  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  getAllConnections(): Map<string, ConnectionMetadata> {
    return this.connections;
  }

  updateLastActivity(socketId: string): void {
    const conn = this.connections.get(socketId);
    if (conn) {
      conn.lastActivityAt = Date.now();
    }
  }
}

export const connectionRegistry = new InMemoryConnectionRegistry();

export function createSocketIOServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ["websocket", "polling"],
    allowUpgrades: true,
    perMessageDeflate: false,
    cookie: false,
  });

  io.use(async (socket: any, next) => {
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
      socket.deviceId = socket.handshake.auth?.deviceId || socket.handshake.query?.deviceId;
      socket.platform = socket.handshake.auth?.platform || socket.handshake.query?.platform;

      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket: any) => {
    const userId = socket.userId;
    const socketId = socket.id;
    const presenceSocketId = `default:${socketId}`;

    connectionRegistry.addSocket(userId, socketId, {
      deviceId: socket.deviceId,
      platform: socket.platform,
    });

    socket.join(`user:${userId}`);
    socket.join(`user_room:${userId}`);

    socket.connectionState = ConnectionState.CONNECTED;
    socket.connectedAt = Date.now();
    socket.lastActivityAt = Date.now();
    socket.reconnectAttempts = 0;

    const totalConnections = connectionRegistry.getSocketsByUserId(userId).length;

    console.log(
      `[Socket.IO] User ${userId} connected (socket: ${socketId}, device: ${socket.deviceId || "unknown"}, platform: ${socket.platform || "unknown"}, total: ${totalConnections})`
    );

    socket.emit("connected", {
      socketId,
      userId,
      connectionState: ConnectionState.CONNECTED,
      timestamp: Date.now(),
      activeConnections: totalConnections,
      reconnectAttempts: socket.reconnectAttempts,
      serverTime: Date.now(),
      heartbeatConfig: {
        interval: 30000,
        timeout: 10000,
      },
    });

    if (socketPresencePort) {
      void socketPresencePort.registerSocket(userId, presenceSocketId).then((state) => {
        if (state.becameOnline) {
          io.emit("user:online", {
            userId,
            socketId,
            timestamp: Date.now(),
          });
        }
      });
    }

    socket.on("ping", () => {
      socket.emit("pong", {
        timestamp: Date.now(),
        serverTime: Date.now(),
        latency: Date.now() - (socket.pingSentAt || Date.now()),
      });
      connectionRegistry.updateLastActivity(socketId);
      void socketPresencePort?.touchSocket(userId, presenceSocketId);
    });

    socket.on("subscribeConversation", async (payload: { conversationId: string }, callback?: (response: any) => void) => {
      try {
        const roomName = `group:${payload.conversationId}`;
        socket.join(roomName);
        socket.join(`group_room:${payload.conversationId}`);

        connectionRegistry.updateLastActivity(socketId);
        void socketPresencePort?.touchSocket(userId, presenceSocketId);

        if (callback) {
          callback({
            success: true,
            room: roomName,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error("Error subscribing to conversation:", error);
        if (callback) {
          callback({ success: false, error: (error as Error).message });
        }
      }
    });

    socket.on("unsubscribeConversation", async (payload: { conversationId: string }, callback?: (response: any) => void) => {
      try {
        const roomName = `group:${payload.conversationId}`;
        socket.leave(roomName);
        socket.leave(`group_room:${payload.conversationId}`);

        connectionRegistry.updateLastActivity(socketId);
        void socketPresencePort?.touchSocket(userId, presenceSocketId);

        if (callback) {
          callback({ success: true, room: roomName });
        }
      } catch (error) {
        console.error("Error unsubscribing from conversation:", error);
        if (callback) {
          callback({ success: false, error: (error as Error).message });
        }
      }
    });

    socket.on("getOnlineStatus", async (payload: { userId: string }, callback?: (response: any) => void) => {
      connectionRegistry.updateLastActivity(socketId);
      void socketPresencePort?.touchSocket(userId, presenceSocketId);

      const presence = socketPresencePort
        ? await socketPresencePort.getUserPresence(payload.userId)
        : null;
      const isOnline = presence?.isOnline ?? connectionRegistry.isUserOnline(payload.userId);
      const socketIds = connectionRegistry.getSocketsByUserId(payload.userId);

      if (callback) {
        callback({
          userId: payload.userId,
          online: isOnline,
          connectionCount: socketIds.length,
          timestamp: Date.now(),
        });
      }
    });

    socket.on("getBatchOnlineStatus", async (payload: { userIds: string[] }, callback?: (response: any) => void) => {
      connectionRegistry.updateLastActivity(socketId);
      void socketPresencePort?.touchSocket(userId, presenceSocketId);

      const statuses = await Promise.all(
        payload.userIds.map(async (targetUserId) => {
          const presence = socketPresencePort
            ? await socketPresencePort.getUserPresence(targetUserId)
            : null;
          return {
            userId: targetUserId,
            online: presence?.isOnline ?? connectionRegistry.isUserOnline(targetUserId),
            connectionCount: connectionRegistry.getSocketsByUserId(targetUserId).length,
          };
        }),
      );

      if (callback) {
        callback({ statuses, timestamp: Date.now() });
      }
    });

    socket.on("typing:start", (payload: any) => {
      connectionRegistry.updateLastActivity(socketId);
      void socketPresencePort?.touchSocket(userId, presenceSocketId);
    });

    socket.on("typing:stop", (payload: any) => {
      connectionRegistry.updateLastActivity(socketId);
      void socketPresencePort?.touchSocket(userId, presenceSocketId);
    });

    socket.on("messageSeen", (payload: any) => {
      connectionRegistry.updateLastActivity(socketId);
      void socketPresencePort?.touchSocket(userId, presenceSocketId);
    });

    socket.on("messageDelivered", (payload: any) => {
      connectionRegistry.updateLastActivity(socketId);
      void socketPresencePort?.touchSocket(userId, presenceSocketId);
    });

    socket.on("disconnect", async (reason: string) => {
      const registryOfflineUserId = connectionRegistry.removeSocket(socketId);
      const disconnectedUserId = registryOfflineUserId || userId;
      const presenceState = userId
        ? await socketPresencePort?.unregisterSocket(userId, presenceSocketId)
        : null;
      const isUserStillOnline = presenceState
        ? !presenceState.becameOffline
        : userId
          ? connectionRegistry.isUserOnline(userId)
          : false;

      console.log(
        `[Socket.IO] User ${userId} disconnected (socket: ${socketId}, reason: ${reason})`
      );

      if (disconnectedUserId) {
        if (!isUserStillOnline) {
          io.emit("user:offline", {
            userId: disconnectedUserId,
            timestamp: Date.now(),
            reason,
          });
        }
      }
    });
  });

  return io;
}

export { InMemoryConnectionRegistry };
