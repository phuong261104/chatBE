import { SocketEvent } from "../../../constants/socket-events";
import { AuthenticatedSocket, SocketHandlerContext } from "./types";

export const connectionSocketHandlers = {
  async handleJoinGroup(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { conversationId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { conversationId } = payload;

      if (!conversationId) {
        if (callback) callback({ success: false, error: "conversationId is required" });
        return;
      }

      await this.useCase.getConversationDetail(conversationId, userId);

      socket.join(`group:${conversationId}`);
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
  },

  async handleLeaveGroup(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { conversationId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { conversationId } = payload;

      if (!conversationId) {
        if (callback) callback({ success: false, error: "conversationId is required" });
        return;
      }

      await this.useCase.leaveGroup(conversationId, userId);

      this.emitToGroupRoom(conversationId, SocketEvent.GROUP_MEMBER_LEFT, {
        conversationId,
        leftUserId: userId,
        leftBy: userId,
      });

      socket.leave(`group:${conversationId}`);
      socket.leave(`group_room:${conversationId}`);

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling leaveGroup:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleMessageSeen(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { conversationId: string; lastSeenMessageId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { conversationId, lastSeenMessageId } = payload;

      if (!conversationId || !lastSeenMessageId) {
        if (callback) callback({ success: false, error: "conversationId and lastSeenMessageId are required" });
        return;
      }

      await this.useCase.markAsSeen(conversationId, userId, lastSeenMessageId);

      const memberUserIds = await this.getMemberUserIds(conversationId, userId);

      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, SocketEvent.MESSAGE_SEEN, {
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
  },

  async handleMessageDelivered(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { conversationId: string; lastDeliveredMessageId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { conversationId, lastDeliveredMessageId } = payload;

      if (!conversationId || !lastDeliveredMessageId) {
        if (callback) callback({ success: false, error: "conversationId and lastDeliveredMessageId are required" });
        return;
      }

      await this.useCase.markAsDelivered(conversationId, userId, lastDeliveredMessageId);

      const memberUserIds = await this.getMemberUserIds(conversationId, userId);

      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, SocketEvent.MESSAGE_DELIVERED, {
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
  },

  async handleTypingStart(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { toUserId?: string; groupId?: string },
  ) {
    try {
      const userId = socket.userId;
      if (!userId) return;

      const { toUserId, groupId } = payload;

      if (toUserId) {
        this.namespace.to(`user_room:${toUserId}`).emit(SocketEvent.TYPING_START, {
          userId,
          toUserId,
        });
      } else if (groupId) {
        await this.useCase.getConversationDetail(groupId, userId);
        socket.to(`group_room:${groupId}`).emit(SocketEvent.TYPING_START, {
          userId,
          groupId,
        });
      }
    } catch (error) {
      console.error("Error handling typing:start:", error);
    }
  },

  async handleTypingStop(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { toUserId?: string; groupId?: string },
  ) {
    try {
      const userId = socket.userId;
      if (!userId) return;

      const { toUserId, groupId } = payload;

      if (toUserId) {
        this.namespace.to(`user_room:${toUserId}`).emit(SocketEvent.TYPING_STOP, {
          userId,
          toUserId,
        });
      } else if (groupId) {
        await this.useCase.getConversationDetail(groupId, userId);
        socket.to(`group_room:${groupId}`).emit(SocketEvent.TYPING_STOP, {
          userId,
          groupId,
        });
      }
    } catch (error) {
      console.error("Error handling typing:stop:", error);
    }
  },

  async handleMarkAllSeen(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { conversationId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { conversationId } = payload;

      if (!conversationId) {
        if (callback) callback({ success: false, error: "conversationId is required" });
        return;
      }

      const messages = await this.useCase.loadMessages(conversationId, userId, undefined, 1);

      if (messages.messages.length > 0) {
        const lastMessage = messages.messages[0];
        await this.useCase.markAsSeen(conversationId, userId, lastMessage.id);

        const memberUserIds = await this.getMemberUserIds(conversationId, userId);

        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.MESSAGE_SEEN, {
            conversationId,
            userId,
            lastSeenMessageId: lastMessage.id,
          });
        }
      }

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling markAllSeen:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },
};
