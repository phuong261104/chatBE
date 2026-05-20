import { SocketEvent } from "../../../constants/socket-events";
import { AuthenticatedSocket, SocketHandlerContext } from "./types";

export const reactionSocketHandlers = {
  async handleAddReaction(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { messageId: string; emoji: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      if (!this.checkRateLimit(userId, "addReaction")) {
        if (callback) callback({ success: false, error: "Rate limit exceeded. Please slow down." });
        return;
      }

      const { messageId, emoji } = payload;

      if (!messageId || !emoji) {
        if (callback) callback({ success: false, error: "messageId and emoji are required" });
        return;
      }

      const message = await this.useCase.getMessage(messageId);
      if (!message) {
        if (callback) callback({ success: false, error: "Message not found" });
        return;
      }

      const reaction = await this.useCase.addReaction(messageId, userId, emoji);

      const memberUserIds = await this.getMemberUserIds(message.conversationId);

      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, SocketEvent.MESSAGE_REACTION, {
          messageId,
          reaction,
        });
      }

      if (callback) {
        callback({ success: true, reaction });
      }
    } catch (error) {
      console.error("Error handling addReaction:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleRemoveReaction(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { messageId: string; emoji?: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { messageId, emoji } = payload;

      if (!messageId) {
        if (callback) callback({ success: false, error: "messageId is required" });
        return;
      }

      const message = await this.useCase.getMessage(messageId);
      if (!message) {
        if (callback) callback({ success: false, error: "Message not found" });
        return;
      }

      const deletedCount = await this.useCase.removeReaction(messageId, userId, emoji);

      const memberUserIds = await this.getMemberUserIds(message.conversationId);

      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, SocketEvent.MESSAGE_REACTION_REMOVE, {
          messageId,
          userId,
          emoji: emoji || undefined,
        });
      }

      if (callback) {
        callback({ success: true, deletedCount });
      }
    } catch (error) {
      console.error("Error handling removeReaction:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },
};
