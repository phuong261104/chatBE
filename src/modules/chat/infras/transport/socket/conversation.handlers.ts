import { SocketEvent } from "../../../constants/socket-events";
import { AuthenticatedSocket, SocketHandlerContext } from "./types";
import { getAttachedMessages } from "../../../usecase/utility-messages";

export const conversationSocketHandlers = {
  async handleUpdateGroupSettings(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: {
      groupId: string;
      allowSendLink?: boolean;
      requireApproval?: boolean;
      allowMemberInvite?: boolean;
      whoCanSendMessages?: "all" | "admins";
      whoCanAddMembers?: "all" | "admins";
      utilityPermissions?: {
        poll?: "all" | "admins";
        reminder?: "all" | "admins";
        note?: "all" | "admins";
      };
    },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { groupId, ...settings } = payload;
      if (!groupId) {
        if (callback) callback({ success: false, error: "groupId is required" });
        return;
      }

      const conversation = await this.useCase.updateGroupSettings(groupId, userId, settings);
      this.emitToGroupRoom(groupId, SocketEvent.GROUP_SETTINGS_UPDATED, {
        conversationId: groupId,
        settings: conversation.settings,
      });
      if (callback) callback({ success: true, conversation });
    } catch (error) {
      console.error("Error handling updateGroupSettings:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleUpdateGroupInfo(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { groupId: string; name?: string; avatarUrl?: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { groupId, name, avatarUrl } = payload;
      if (!groupId || (!name && !avatarUrl)) {
        if (callback) callback({ success: false, error: "groupId and name or avatarUrl are required" });
        return;
      }

      const conversation = await this.useCase.updateGroupInfo(groupId, userId, { name, avatarUrl });
      if (name) {
        this.emitToGroupRoom(groupId, SocketEvent.GROUP_RENAMED, {
          conversationId: groupId,
          newName: name,
          renamedBy: userId,
        });
      }
      if (avatarUrl) {
        this.emitToGroupRoom(groupId, SocketEvent.GROUP_AVATAR_CHANGED, {
          conversationId: groupId,
          avatarUrl,
          changedBy: userId,
        });
      }
      await (this as any).notifySystemMessages(
        groupId,
        getAttachedMessages(conversation, "systemMessages"),
      );
      if (callback) callback({ success: true, conversation });
    } catch (error) {
      console.error("Error handling updateGroupInfo:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

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

      const { message, systemMessage } = await this.useCase.pinMessage(messageId, userId);

      const memberUserIds = await this.getMemberUserIds(message.conversationId);
      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, SocketEvent.MESSAGE_PINNED, {
          conversationId: message.conversationId,
          message,
        });
        this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
          conversationId: systemMessage.conversationId,
          message: systemMessage,
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

      const { message, systemMessage } = await this.useCase.unpinMessage(messageId, userId);

      const memberUserIds = await this.getMemberUserIds(message.conversationId);
      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, SocketEvent.MESSAGE_UNPINNED, {
          conversationId: message.conversationId,
          message,
        });
        this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
          conversationId: systemMessage.conversationId,
          message: systemMessage,
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
