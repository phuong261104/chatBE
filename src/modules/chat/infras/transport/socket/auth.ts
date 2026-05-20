import { Namespace } from "socket.io";
import { jwtProvider } from "@share/component/jwt";
import { AuthenticatedSocket } from "./types";

export function setupMessagesSocketAuth(namespace: Namespace) {
  namespace.use(async (socket: AuthenticatedSocket, next) => {
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
      socket.deviceId = socket.handshake.auth?.deviceId || (socket.handshake.query?.deviceId as string);
      next();
    } catch {
      next(new Error("Authentication error"));
    }
  });
}
