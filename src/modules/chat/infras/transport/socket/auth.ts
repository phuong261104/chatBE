import { Namespace } from "socket.io";
import { authenticateSocketConnection } from "@share/component/socket-io";
import { AuthenticatedSocket } from "./types";

export function setupMessagesSocketAuth(namespace: Namespace) {
  namespace.use(async (socket: AuthenticatedSocket, next) => {
    await authenticateSocketConnection(socket, next);
  });
}
