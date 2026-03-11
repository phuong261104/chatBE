import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { jwtProvider } from "./jwt";

export interface AuthenticatedSocket {
  userId?: string;
  id: string;
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, ...args: any[]) => boolean;
  on: (event: string, listener: (...args: any[]) => void) => void;
  disconnect: (close?: boolean) => void;
}

export function createSocketIOServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*", // Configure properly in production
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.use(async (socket: any, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const payload = await jwtProvider.verifyToken(token as string);

      if (!payload || !payload.sub) {
        return next(new Error("Authentication error: Invalid token"));
      }

      socket.userId = payload.sub;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error"));
    }
  });

  // Global connection logging
  io.on("connection", (socket: any) => {
    console.log(
      `[Socket.IO] User ${socket.userId} connected (socket: ${socket.id})`,
    );

    socket.on("disconnect", () => {
      console.log(
        `[Socket.IO] User ${socket.userId} disconnected (socket: ${socket.id})`,
      );
    });
  });

  return io;
}
