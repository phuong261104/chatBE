import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { jwtProvider } from "./jwt";
import { ITokenIntrospect, TokenPayload } from "@share/interface";
import { config } from "./config";

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

type RawPresence = { isOnline: boolean; lastSeen: number | null };

export type VisibleSocketPresence = {
  userId: string;
  visibility: "visible" | "hidden";
  isOnline: boolean;
  lastSeen: number | null;
};

interface SocketPresenceVisibilityPort {
  applyPresenceVisibility(viewerId: string, targetUserId: string, presence: RawPresence): Promise<VisibleSocketPresence>;
}

let socketPresencePort: SocketPresencePort | null = null;
let socketPresenceVisibilityPort: SocketPresenceVisibilityPort | null = null;
let activeSocketServer: SocketIOServer | null = null;
let socketTokenIntrospector: ITokenIntrospect | null = null;

export function setSocketPresencePort(port: SocketPresencePort): void {
  socketPresencePort = port;
}

export function setSocketPresenceVisibilityPort(port: SocketPresenceVisibilityPort): void {
  socketPresenceVisibilityPort = port;
}

export function setSocketTokenIntrospector(introspector: ITokenIntrospect | null): void {
  socketTokenIntrospector = introspector;
}

function extractSocketToken(socket: any): string | undefined {
  return (
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    socket.handshake.headers?.authorization?.replace("Bearer ", "")
  );
}

export async function verifySocketToken(token: string): Promise<TokenPayload | null> {
  if (socketTokenIntrospector) {
    const result = await socketTokenIntrospector.introspect(token);
    return result.isOk && result.payload ? (result.payload as TokenPayload) : null;
  }

  return jwtProvider.verifyToken(token);
}

export async function authenticateSocketConnection(socket: any, next: (err?: Error) => void): Promise<void> {
  try {
    const token = extractSocketToken(socket);

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const payload = await verifySocketToken(token);

    if (!payload || !payload.sub) {
      return next(new Error("Authentication error: Invalid token"));
    }

    socket.userId = payload.sub;
    socket.deviceId = payload.deviceId || socket.handshake.auth?.deviceId || socket.handshake.query?.deviceId;
    socket.platform = socket.handshake.auth?.platform || socket.handshake.query?.platform;

    next();
  } catch {
    next(new Error("Authentication error"));
  }
}

export async function resolveSocketPresenceForViewer(
  viewerId: string,
  targetUserId: string,
  presence: RawPresence,
): Promise<VisibleSocketPresence> {
  if (socketPresenceVisibilityPort) {
    return socketPresenceVisibilityPort.applyPresenceVisibility(viewerId, targetUserId, presence);
  }
  return {
    userId: targetUserId,
    visibility: "visible",
    isOnline: presence.isOnline,
    lastSeen: presence.lastSeen,
  };
}

export async function emitPresenceToVisibleSockets(
  namespace: NamespaceLike,
  event: string,
  targetUserId: string,
  payload: Record<string, any>,
  presence: RawPresence,
): Promise<void> {
  const sockets = Array.from(namespace.sockets?.values?.() || []) as any[];
  await Promise.all(
    sockets.map(async (socket) => {
      if (!socket.userId) return;
      const visible = await resolveSocketPresenceForViewer(socket.userId, targetUserId, presence);
      if (visible.visibility !== "visible") return;
      socket.emit(event, {
        ...payload,
        visibility: visible.visibility,
        isOnline: visible.isOnline,
        online: visible.isOnline,
        lastSeen: visible.lastSeen,
      });
    }),
  );
}

export function revokeUserDeviceSockets(userId: string, deviceId: string, reason = "session_revoked"): void {
  if (!activeSocketServer) return;

  const payload = {
    userId,
    deviceId,
    reason,
    timestamp: Date.now(),
  };
  const namespaces = Array.from(((activeSocketServer as any)._nsps as Map<string, NamespaceLike>)?.values?.() || []);

  for (const namespace of namespaces) {
    const sockets = Array.from(namespace.sockets?.values?.() || []) as any[];
    for (const socket of sockets) {
      if (socket.userId !== userId || socket.deviceId !== deviceId) continue;
      socket.emit("session:revoked", payload);
      socket.disconnect(true);
    }
  }
}

export type NamespaceLike = {
  sockets: Map<string, any>;
};

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
      origin: config.cors.origins.includes("*") ? "*" : config.cors.origins,
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
  activeSocketServer = io;

  io.use(authenticateSocketConnection);

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
          void emitPresenceToVisibleSockets(
            io.of("/") as any,
            "user:online",
            userId,
            {
              userId,
              socketId,
              timestamp: Date.now(),
            },
            { isOnline: true, lastSeen: Date.now() },
          );
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

      const rawPresence = socketPresencePort
        ? await socketPresencePort.getUserPresence(payload.userId)
        : null;
      const fallbackPresence = {
        isOnline: connectionRegistry.isUserOnline(payload.userId),
        lastSeen: null,
      };
      const visible = await resolveSocketPresenceForViewer(
        userId,
        payload.userId,
        rawPresence || fallbackPresence,
      );
      const socketIds = connectionRegistry.getSocketsByUserId(payload.userId);

      if (callback) {
        callback({
          userId: payload.userId,
          online: visible.isOnline,
          isOnline: visible.isOnline,
          visibility: visible.visibility,
          lastSeen: visible.lastSeen,
          connectionCount: visible.visibility === "visible" ? socketIds.length : 0,
          timestamp: Date.now(),
        });
      }
    });

    socket.on("getBatchOnlineStatus", async (payload: { userIds: string[] }, callback?: (response: any) => void) => {
      connectionRegistry.updateLastActivity(socketId);
      void socketPresencePort?.touchSocket(userId, presenceSocketId);

      const statuses = await Promise.all(
        payload.userIds.map(async (targetUserId) => {
          const rawPresence = socketPresencePort
            ? await socketPresencePort.getUserPresence(targetUserId)
            : null;
          const visible = await resolveSocketPresenceForViewer(
            userId,
            targetUserId,
            rawPresence || {
              isOnline: connectionRegistry.isUserOnline(targetUserId),
              lastSeen: null,
            },
          );
          return {
            userId: targetUserId,
            online: visible.isOnline,
            isOnline: visible.isOnline,
            visibility: visible.visibility,
            lastSeen: visible.lastSeen,
            connectionCount: visible.visibility === "visible"
              ? connectionRegistry.getSocketsByUserId(targetUserId).length
              : 0,
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
          await emitPresenceToVisibleSockets(
            io.of("/") as any,
            "user:offline",
            disconnectedUserId,
            {
              userId: disconnectedUserId,
              timestamp: Date.now(),
              reason,
            },
            { isOnline: false, lastSeen: Date.now() },
          );
        }
      }
    });
  });

  return io;
}

export { InMemoryConnectionRegistry };
