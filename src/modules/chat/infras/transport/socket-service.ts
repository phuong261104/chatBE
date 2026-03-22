import { IMessagingUseCase } from "../../interface";
import { Server as SocketIOServer, Namespace, Socket } from "socket.io";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

interface JoinGroupPayload {
  conversationId: string;
}

interface MessageSeenPayload {
  conversationId: string;
  lastSeenMessageId: string;
}

interface MessageDeliveredPayload {
  conversationId: string;
  lastDeliveredMessageId: string;
}

interface TypingPayload {
  toUserId?: string;
  groupId?: string;
}

export class MessagingSocketService {
  private namespace: Namespace;

  constructor(
    io: SocketIOServer,
    private readonly useCase: IMessagingUseCase,
  ) {
    this.namespace = io.of("/messages");
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.namespace.on("connection", (socket: AuthenticatedSocket) => {
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
        socket.join(`user_room:${socket.userId}`);
      }

      socket.on("joinGroup", async (payload: JoinGroupPayload, callback) => {
        await this.handleJoinGroup(socket, payload, callback);
      });

      socket.on("leaveGroup", async (payload: JoinGroupPayload, callback) => {
        await this.handleLeaveGroup(socket, payload, callback);
      });

      socket.on(
        "messageSeen",
        async (payload: MessageSeenPayload, callback) => {
          await this.handleMessageSeen(socket, payload, callback);
        },
      );

      socket.on(
        "messageDelivered",
        async (payload: MessageDeliveredPayload, callback) => {
          await this.handleMessageDelivered(socket, payload, callback);
        },
      );

      socket.on("typing_start", async (payload: TypingPayload) => {
        await this.handleTyping(socket, payload, "typing_start");
      });

      socket.on("typing_stop", async (payload: TypingPayload) => {
        await this.handleTyping(socket, payload, "typing_stop");
      });

      socket.on("disconnect", () => {});
    });
  }

  private async handleJoinGroup(
    socket: AuthenticatedSocket,
    payload: JoinGroupPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      const { conversationId } = payload;

      if (!conversationId) {
        const error = { success: false, error: "conversationId is required" };
        if (callback) callback(error);
        return;
      }

      const roomName = `group:${conversationId}`;
      socket.join(roomName);
      socket.join(`group_room:${conversationId}`);

      if (callback) {
        callback({ success: true, message: `Joined group ${conversationId}` });
      }
    } catch (error) {
      console.error("Error handling joinGroup:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleLeaveGroup(
    socket: AuthenticatedSocket,
    payload: JoinGroupPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      const { conversationId } = payload;

      if (!conversationId) {
        const error = { success: false, error: "conversationId is required" };
        if (callback) callback(error);
        return;
      }

      const roomName = `group:${conversationId}`;
      socket.leave(roomName);
      socket.leave(`group_room:${conversationId}`);

      if (callback) {
        callback({ success: true, message: `Left group ${conversationId}` });
      }
    } catch (error) {
      console.error("Error handling leaveGroup:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleMessageSeen(
    socket: AuthenticatedSocket,
    payload: MessageSeenPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      const { conversationId, lastSeenMessageId } = payload;

      if (!conversationId || !lastSeenMessageId) {
        const error = {
          success: false,
          error: "conversationId and lastSeenMessageId are required",
        };
        if (callback) callback(error);
        return;
      }

      await this.useCase.markAsSeen(conversationId, userId, lastSeenMessageId);

      const memberUserIds = await this.useCase.getConversationMembers(
        conversationId,
        userId,
      );

      for (const memberId of memberUserIds) {
        this.namespace.to(`user:${memberId}`).emit("messageSeen", {
          conversationId,
          userId,
          lastSeenMessageId,
        });
      }

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling messageSeen:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleMessageDelivered(
    socket: AuthenticatedSocket,
    payload: MessageDeliveredPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      const { conversationId, lastDeliveredMessageId } = payload;

      if (!conversationId || !lastDeliveredMessageId) {
        const error = {
          success: false,
          error: "conversationId and lastDeliveredMessageId are required",
        };
        if (callback) callback(error);
        return;
      }

      await this.useCase.markAsDelivered(
        conversationId,
        userId,
        lastDeliveredMessageId,
      );

      const memberUserIds = await this.useCase.getConversationMembers(
        conversationId,
        userId,
      );

      for (const memberId of memberUserIds) {
        this.namespace.to(`user:${memberId}`).emit("messageDelivered", {
          conversationId,
          userId,
          lastDeliveredMessageId,
        });
      }

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling messageDelivered:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleTyping(
    socket: AuthenticatedSocket,
    payload: TypingPayload,
    eventName: "typing_start" | "typing_stop",
  ) {
    try {
      const userId = socket.userId;
      if (!userId) return;

      const { toUserId, groupId } = payload;

      if (toUserId) {
        this.namespace.to(`user_room:${toUserId}`).emit(eventName, {
          userId,
          toUserId,
        });
      } else if (groupId) {
        socket.to(`group_room:${groupId}`).emit(eventName, {
          userId,
          groupId,
        });
      }
    } catch (error) {
      console.error(`Error handling ${eventName}:`, error);
    }
  }

  public notifyNewGroup(memberUserIds: string[], groupData: any) {
    for (const userId of memberUserIds) {
      this.namespace.to(`user:${userId}`).emit("newGroupCreated", groupData);
    }
  }

  public notifyMembersAdded(conversationId: string, newMembers: any[]) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("membersAdded", {
      conversationId,
      newMembers,
    });
  }

  public notifyMemberRemoved(conversationId: string, removedUserId: string) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("memberRemoved", {
      conversationId,
      removedUserId,
    });
  }

  public notifyGroupUpdated(conversationId: string, updatedData: any) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("groupUpdated", {
      conversationId,
      data: updatedData,
    });
  }

  public notifyMessageSeen(
    userId: string,
    conversationId: string,
    seenByUserId: string,
    lastSeenMessageId: string,
  ) {
    this.namespace.to(`user:${userId}`).emit("messageSeen", {
      conversationId,
      userId: seenByUserId,
      lastSeenMessageId,
    });
  }

  public notifyMessageDelivered(
    userId: string,
    conversationId: string,
    deliveredByUserId: string,
    lastDeliveredMessageId: string,
  ) {
    this.namespace.to(`user:${userId}`).emit("messageDelivered", {
      conversationId,
      userId: deliveredByUserId,
      lastDeliveredMessageId,
    });
  }

  public emitToGroupRoom(conversationId: string, event: string, data: any) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit(event, data);
  }

  public emitToUser(userId: string, event: string, data: any) {
    this.namespace.to(`user:${userId}`).emit(event, data);
  }
}
