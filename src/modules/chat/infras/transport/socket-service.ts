import { IMessagingUseCase } from "../../interface";
import { Server as SocketIOServer, Namespace, Socket } from "socket.io";
import { MediaAttachment, Message } from "../../model/model";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
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

interface SendMessageSocketPayload {
  conversationId: string;
  text?: string;
  media?: MediaAttachment[];
}

interface EditMessageSocketPayload {
  messageId: string;
  text: string;
}

interface DeleteMessageSocketPayload {
  messageId: string;
}

interface DeleteMessageForEveryoneSocketPayload {
  messageId: string;
}

interface RevokeMessageSocketPayload {
  messageId: string;
}

interface AddReactionSocketPayload {
  messageId: string;
  emoji: string;
}

interface RemoveReactionSocketPayload {
  messageId: string;
  emoji?: string;
}

interface MarkAllSeenPayload {
  conversationId: string;
}

interface GetOnlineStatusPayload {
  userId: string;
}

interface GetBatchOnlineStatusPayload {
  userIds: string[];
}

export class MessagingSocketService {
  private namespace: Namespace;
  private rateLimiter: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60000;
  private readonly RATE_LIMITS = {
    sendMessage: 60,
    typing: 30,
    addReaction: 60,
    editMessage: 30,
    deleteMessage: 30,
  };

  constructor(
    io: SocketIOServer,
    private readonly useCase: IMessagingUseCase,
  ) {
    this.namespace = io.of("/messages");
    this.setupEventHandlers();
  }

  private checkRateLimit(userId: string, eventType: string): boolean {
    const key = `${userId}:${eventType}`;
    const now = Date.now();
    const limit = this.RATE_LIMITS[eventType as keyof typeof this.RATE_LIMITS] || 30;

    const entry = this.rateLimiter.get(key);

    if (!entry || now > entry.resetAt) {
      this.rateLimiter.set(key, { count: 1, resetAt: now + this.RATE_LIMIT_WINDOW });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
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

      socket.on("typing:start", async (payload: TypingPayload) => {
        await this.handleTyping(socket, payload, "typing:start");
      });

      socket.on("typing:stop", async (payload: TypingPayload) => {
        await this.handleTyping(socket, payload, "typing:stop");
      });

      socket.on("sendMessage", async (payload: SendMessageSocketPayload, callback) => {
        await this.handleSendMessage(socket, payload, callback);
      });

      socket.on("editMessage", async (payload: EditMessageSocketPayload, callback) => {
        await this.handleEditMessage(socket, payload, callback);
      });

      socket.on("deleteMessage", async (payload: DeleteMessageSocketPayload, callback) => {
        await this.handleDeleteMessage(socket, payload, callback);
      });

      socket.on("revokeMessage", async (payload: RevokeMessageSocketPayload, callback) => {
        await this.handleRevokeMessage(socket, payload, callback);
      });

      socket.on("addReaction", async (payload: AddReactionSocketPayload, callback) => {
        await this.handleAddReaction(socket, payload, callback);
      });

      socket.on("removeReaction", async (payload: RemoveReactionSocketPayload, callback) => {
        await this.handleRemoveReaction(socket, payload, callback);
      });

      socket.on("markAllSeen", async (payload: MarkAllSeenPayload, callback) => {
        await this.handleMarkAllSeen(socket, payload, callback);
      });

      socket.on("deleteMessageForEveryone", async (payload: DeleteMessageForEveryoneSocketPayload, callback) => {
        await this.handleDeleteMessageForEveryone(socket, payload, callback);
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

  private async handleSendMessage(
    socket: AuthenticatedSocket,
    payload: SendMessageSocketPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      if (!this.checkRateLimit(userId, "sendMessage")) {
        const error = { success: false, error: "Rate limit exceeded. Please slow down." };
        if (callback) callback(error);
        return;
      }

      const { conversationId, text, media } = payload;

      if (!conversationId) {
        const error = { success: false, error: "conversationId is required" };
        if (callback) callback(error);
        return;
      }

      if (!text && (!media || media.length === 0)) {
        const error = { success: false, error: "Either text or media is required" };
        if (callback) callback(error);
        return;
      }

      const conversationDetail = await this.useCase.getConversationDetail(
        conversationId,
        userId,
      );

      const isGroup = conversationDetail.conversation.type === "group";

      const message = isGroup
        ? await this.useCase.sendGroupMessage(conversationId, userId, text, media)
        : await this.useCase.sendMessage(conversationId, userId, text, media);

      const memberUserIds = await this.useCase.getConversationMembers(
        conversationId,
        userId,
      );

      for (const memberId of memberUserIds) {
        this.namespace.to(`user:${memberId}`).emit("receiveMessage", {
          message,
          conversationId,
        });
      }

      if (callback) {
        callback({ success: true, message });
      }
    } catch (error) {
      console.error("Error handling sendMessage:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleEditMessage(
    socket: AuthenticatedSocket,
    payload: EditMessageSocketPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      const { messageId, text } = payload;

      if (!messageId || !text) {
        const error = { success: false, error: "messageId and text are required" };
        if (callback) callback(error);
        return;
      }

      const message = await this.useCase.editMessage(messageId, userId, text);

      const memberUserIds = await this.useCase.getConversationMembers(
        message.conversationId,
      );

      for (const memberId of memberUserIds) {
        this.namespace.to(`user:${memberId}`).emit("message:edited", {
          conversationId: message.conversationId,
          message,
        });
      }

      if (callback) {
        callback({ success: true, message });
      }
    } catch (error) {
      console.error("Error handling editMessage:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleDeleteMessage(
    socket: AuthenticatedSocket,
    payload: DeleteMessageSocketPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      const { messageId } = payload;

      if (!messageId) {
        const error = { success: false, error: "messageId is required" };
        if (callback) callback(error);
        return;
      }

      const message = await this.useCase.getMessage(messageId);
      if (!message) {
        const error = { success: false, error: "Message not found" };
        if (callback) callback(error);
        return;
      }

      await this.useCase.deleteMessageForMe(messageId, userId);

      const memberUserIds = await this.useCase.getConversationMembers(message.conversationId);
      for (const memberId of memberUserIds) {
        this.namespace.to(`user:${memberId}`).emit("message:deleted", {
          conversationId: message.conversationId,
          messageId,
          deletedBy: userId,
        });
      }

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling deleteMessage:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleRevokeMessage(
    socket: AuthenticatedSocket,
    payload: RevokeMessageSocketPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      const { messageId } = payload;

      if (!messageId) {
        const error = { success: false, error: "messageId is required" };
        if (callback) callback(error);
        return;
      }

      const message = await this.useCase.revokeMessage(messageId, userId);

      const memberUserIds = await this.useCase.getConversationMembers(
        message.conversationId,
      );

      for (const memberId of memberUserIds) {
        this.namespace.to(`user:${memberId}`).emit("message:revoked", {
          conversationId: message.conversationId,
          messageId,
          revokedBy: userId,
        });
      }

      if (callback) {
        callback({ success: true, message });
      }
    } catch (error) {
      console.error("Error handling revokeMessage:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleAddReaction(
    socket: AuthenticatedSocket,
    payload: AddReactionSocketPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      if (!this.checkRateLimit(userId, "addReaction")) {
        const error = { success: false, error: "Rate limit exceeded. Please slow down." };
        if (callback) callback(error);
        return;
      }

      const { messageId, emoji } = payload;

      if (!messageId || !emoji) {
        const error = { success: false, error: "messageId and emoji are required" };
        if (callback) callback(error);
        return;
      }

      const message = await this.useCase.getMessage(messageId);
      if (!message) {
        const error = { success: false, error: "Message not found" };
        if (callback) callback(error);
        return;
      }

      const reaction = await this.useCase.addReaction(messageId, userId, emoji);

      const memberUserIds = await this.useCase.getConversationMembers(
        message.conversationId,
      );

      for (const memberId of memberUserIds) {
        this.namespace.to(`user:${memberId}`).emit("message:reaction", {
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
  }

  private async handleRemoveReaction(
    socket: AuthenticatedSocket,
    payload: RemoveReactionSocketPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      const { messageId, emoji } = payload;

      if (!messageId) {
        const error = { success: false, error: "messageId is required" };
        if (callback) callback(error);
        return;
      }

      const message = await this.useCase.getMessage(messageId);
      if (!message) {
        const error = { success: false, error: "Message not found" };
        if (callback) callback(error);
        return;
      }

      const deletedCount = await this.useCase.removeReaction(messageId, userId, emoji);

      const memberUserIds = await this.useCase.getConversationMembers(message.conversationId);

      for (const memberId of memberUserIds) {
        this.namespace.to(`user:${memberId}`).emit("message:reaction:remove", {
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
  }

  private async handleDeleteMessageForEveryone(
    socket: AuthenticatedSocket,
    payload: DeleteMessageForEveryoneSocketPayload,
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        const error = { success: false, error: "Unauthorized" };
        if (callback) callback(error);
        return;
      }

      const { messageId } = payload;

      if (!messageId) {
        const error = { success: false, error: "messageId is required" };
        if (callback) callback(error);
        return;
      }

      const message = await this.useCase.deleteMessageForEveryone(messageId, userId);

      const memberUserIds = await this.useCase.getConversationMembers(message.conversationId);
      for (const memberId of memberUserIds) {
        this.namespace.to(`user:${memberId}`).emit("message:deleted_for_everyone", {
          conversationId: message.conversationId,
          messageId,
          deletedBy: userId,
        });
      }

      if (callback) {
        callback({ success: true, message });
      }
    } catch (error) {
      console.error("Error handling deleteMessageForEveryone:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleMarkAllSeen(
    socket: AuthenticatedSocket,
    payload: MarkAllSeenPayload,
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

      const detail = await this.useCase.getConversationDetail(conversationId, userId);
      const messages = await this.useCase.loadMessages(conversationId, userId, undefined, 1);

      if (messages.messages.length > 0) {
        const lastMessage = messages.messages[0];
        await this.useCase.markAsSeen(conversationId, userId, lastMessage.id);

        const memberUserIds = await this.useCase.getConversationMembers(
          conversationId,
          userId,
        );

        for (const memberId of memberUserIds) {
          this.namespace.to(`user:${memberId}`).emit("messageSeen", {
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
    eventName: "typing:start" | "typing:stop",
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
      this.namespace.to(`user:${userId}`).emit("conversation:created", groupData);
    }
  }

  public notifyMembersAdded(conversationId: string, newMembers: any[]) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("conversation:members_added", {
      conversationId,
      newMembers,
    });
  }

  public notifyMemberRemoved(conversationId: string, removedUserId: string) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("conversation:member_removed", {
      conversationId,
      removedUserId,
    });
  }

  public notifyGroupUpdated(conversationId: string, updatedData: any) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("conversation:updated", {
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

  public notifyMessageDeleted(
    conversationId: string,
    messageId: string,
    deletedBy: string,
  ) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("message:deleted", {
      conversationId,
      messageId,
      deletedBy,
    });
  }

  public notifyAdminChanged(conversationId: string, targetUserId: string, isAdmin: boolean) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("group:admin_changed", {
      conversationId,
      targetUserId,
      isAdmin,
    });
  }

  public notifyOwnerTransferred(conversationId: string, oldOwnerId: string, newOwnerId: string) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("group:owner_transferred", {
      conversationId,
      oldOwnerId,
      newOwnerId,
    });
  }

  public notifyPollCreated(conversationId: string, poll: any) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("poll:new", {
      conversationId,
      poll,
    });
  }

  public notifyPollVoted(conversationId: string, pollId: string, userId: string, poll: any) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("poll:vote", {
      conversationId,
      pollId,
      userId,
      poll,
    });
  }

  public notifyMemberApproved(conversationId: string, userId: string, member: any) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("group:member_approved", {
      conversationId,
      userId,
      member,
    });
    this.namespace.to(`user:${userId}`).emit("group:member_approved", {
      conversationId,
      userId,
      member,
    });
  }

  public notifyMemberRejected(conversationId: string, userId: string) {
    this.namespace.to(`user:${userId}`).emit("group:member_rejected", {
      conversationId,
      userId,
    });
  }

  public notifyGroupSettingsUpdated(conversationId: string, settings: any) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit("group:settings_updated", {
      conversationId,
      settings,
    });
  }
}