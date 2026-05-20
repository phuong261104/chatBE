import { SocketEvent } from "../../../constants/socket-events";
import { AuthenticatedSocket, SocketHandlerContext } from "./types";

export const conversationSocketHandlers = {
  async handleDissolveGroup(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { groupId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { groupId } = payload;

      if (!groupId) {
        if (callback) callback({ success: false, error: "groupId is required" });
        return;
      }

      const memberUserIds = await this.useCase.dissolveGroup(groupId, userId);

      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, SocketEvent.GROUP_DISSOLVED, {
          conversationId: groupId,
          dissolvedBy: userId,
        });
      }

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling dissolveGroup:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handlePinConversation(this: SocketHandlerContext, 
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

      await this.useCase.pinConversation(conversationId, userId);

      this.emitToUser(userId, SocketEvent.CONVERSATION_PIN_TOGGLED, {
        conversationId,
        pinnedBy: userId,
        pinned: true,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling pinConversation:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleUnpinConversation(this: SocketHandlerContext, 
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

      await this.useCase.unpinConversation(conversationId, userId);

      this.emitToUser(userId, SocketEvent.CONVERSATION_PIN_TOGGLED, {
        conversationId,
        pinnedBy: userId,
        pinned: false,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling unpinConversation:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleArchiveConversation(this: SocketHandlerContext, 
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

      await this.useCase.archiveConversation(conversationId, userId);

      this.emitToUser(userId, SocketEvent.CONVERSATION_ARCHIVED_TOGGLED, {
        conversationId,
        userId,
        archived: true,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling archiveConversation:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleUnarchiveConversation(this: SocketHandlerContext, 
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

      await this.useCase.unarchiveConversation(conversationId, userId);

      this.emitToUser(userId, SocketEvent.CONVERSATION_ARCHIVED_TOGGLED, {
        conversationId,
        userId,
        archived: false,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling unarchiveConversation:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleMuteConversation(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { conversationId: string; muteUntil?: string; duration?: number },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { conversationId, muteUntil, duration } = payload;

      if (!conversationId) {
        if (callback) callback({ success: false, error: "conversationId is required" });
        return;
      }

      await this.useCase.muteConversation(conversationId, userId, muteUntil, duration);

      this.emitToUser(userId, SocketEvent.CONVERSATION_MUTE_CHANGED, {
        conversationId,
        userId,
        mutedBy: userId,
        muteUntil,
        duration,
        muted: true,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling muteConversation:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleUnmuteConversation(this: SocketHandlerContext, 
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

      await this.useCase.unmuteConversation(conversationId, userId);

      this.emitToUser(userId, SocketEvent.CONVERSATION_MUTE_CHANGED, {
        conversationId,
        userId,
        mutedBy: userId,
        muted: false,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling unmuteConversation:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handlePinMessage(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { messageId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      if (!this.checkRateLimit(userId, "editMessage")) {
        if (callback) callback({ success: false, error: "Rate limit exceeded" });
        return;
      }

      const { messageId } = payload;

      if (!messageId) {
        if (callback) callback({ success: false, error: "messageId is required" });
        return;
      }

      const message = await this.useCase.pinMessage(messageId, userId);

      const memberUserIds = await this.getMemberUserIds(message.conversationId);
      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, SocketEvent.MESSAGE_PINNED, {
          conversationId: message.conversationId,
          message,
        });
      }

      if (callback) {
        callback({ success: true, message });
      }
    } catch (error) {
      console.error("Error handling pinMessage:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleUnpinMessage(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { messageId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      if (!this.checkRateLimit(userId, "editMessage")) {
        if (callback) callback({ success: false, error: "Rate limit exceeded" });
        return;
      }

      const { messageId } = payload;

      if (!messageId) {
        if (callback) callback({ success: false, error: "messageId is required" });
        return;
      }

      const message = await this.useCase.unpinMessage(messageId, userId);

      const memberUserIds = await this.getMemberUserIds(message.conversationId);
      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, SocketEvent.MESSAGE_UNPINNED, {
          conversationId: message.conversationId,
          message,
        });
      }

      if (callback) {
        callback({ success: true, message });
      }
    } catch (error) {
      console.error("Error handling unpinMessage:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },
};
