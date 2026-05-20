import { Server as SocketIOServer, Namespace } from "socket.io";
import { IMessagingUseCase } from "../../interface";
import { IPresenceUseCase } from "@modules/user/interface";
import { setupMessagesSocketAuth } from "./socket/auth";
import { connectionSocketHandlers } from "./socket/connection.handlers";
import { conversationSocketHandlers } from "./socket/conversation.handlers";
import { memberSocketHandlers } from "./socket/member.handlers";
import { messageSocketHandlers } from "./socket/message.handlers";
import { reactionSocketHandlers } from "./socket/reaction.handlers";
import { registerMessagingSocketHandlers } from "./socket/register-handlers";
import { SocketRateLimiter } from "./socket/rate-limiter";
import { AuthenticatedSocket, SocketHandlerContext } from "./socket/types";
import { socketNotifiers, SocketNotifierMethods } from "./socket/notifiers";

export class MessagingSocketService implements SocketHandlerContext {
  public readonly namespace: Namespace;
  private readonly rateLimiter = new SocketRateLimiter();

  constructor(
    io: SocketIOServer,
    public readonly useCase: IMessagingUseCase,
    public readonly presenceUseCase?: IPresenceUseCase,
  ) {
    this.namespace = io.of("/messages");
    setupMessagesSocketAuth(this.namespace);
    registerMessagingSocketHandlers(this as any);
  }

  public checkRateLimit(userId: string, eventType: string): boolean {
    return this.rateLimiter.check(userId, eventType);
  }

  public emitToUser(userId: string, event: string, data: any) {
    this.namespace.to("user:" + userId).emit(event, data);
  }

  public emitToGroupRoom(conversationId: string, event: string, data: any) {
    this.namespace.to("group:" + conversationId).emit(event, data);
  }

  public async getMemberUserIds(conversationId: string, excludeUserId?: string): Promise<string[]> {
    return this.useCase.getConversationMembers(conversationId, excludeUserId);
  }

  public presenceSocketId(socket: AuthenticatedSocket): string {
    return "messages:" + socket.id;
  }

  public async touchPresence(socket: AuthenticatedSocket): Promise<void> {
    if (!socket.userId) return;
    await this.presenceUseCase?.touchSocket(socket.userId, this.presenceSocketId(socket));
  }
}

export interface MessagingSocketService extends SocketNotifierMethods {}

Object.assign(
  MessagingSocketService.prototype,
  connectionSocketHandlers,
  messageSocketHandlers,
  reactionSocketHandlers,
  conversationSocketHandlers,
  memberSocketHandlers,
  socketNotifiers,
);
