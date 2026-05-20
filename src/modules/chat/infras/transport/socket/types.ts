import { Namespace, Socket } from "socket.io";
import { IMessagingUseCase } from "../../../interface";
import { IPresenceUseCase } from "@modules/user/interface";

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
}

export interface SocketHandlerContext {
  namespace: Namespace;
  useCase: IMessagingUseCase;
  presenceUseCase?: IPresenceUseCase;
  checkRateLimit(userId: string, eventType: string): boolean;
  emitToUser(userId: string, event: string, data: any): void;
  emitToGroupRoom(conversationId: string, event: string, data: any): void;
  getMemberUserIds(conversationId: string, excludeUserId?: string): Promise<string[]>;
  presenceSocketId(socket: AuthenticatedSocket): string;
  touchPresence(socket: AuthenticatedSocket): Promise<void>;
}
