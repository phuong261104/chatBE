import { IMessagingUseCase } from "../../interface";
import { Server as SocketIOServer, Namespace, Socket } from "socket.io";
import { MediaAttachment } from "../../model";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
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

  protected checkRateLimit(userId: string, eventType: string): boolean {
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

  public emitToUser(userId: string, event: string, data: any) {
    this.namespace.to(`user:${userId}`).emit(event, data);
  }

  public emitToGroupRoom(conversationId: string, event: string, data: any) {
    const groupRoomName = `group:${conversationId}`;
    this.namespace.to(groupRoomName).emit(event, data);
  }

  protected async getMemberUserIds(conversationId: string, excludeUserId?: string): Promise<string[]> {
    const members = await this.useCase.getConversationMembers(conversationId, excludeUserId);
    return members;
  }

  private setupEventHandlers() {
    this.namespace.on("connection", (socket: AuthenticatedSocket) => {
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
        socket.join(`user_room:${socket.userId}`);
      }

      socket.on("joinGroup", async (payload: any, callback) => {
        await this.handleJoinGroup(socket, payload, callback);
      });

      socket.on("leaveGroup", async (payload: any, callback) => {
        await this.handleLeaveGroup(socket, payload, callback);
      });

      socket.on("messageSeen", async (payload: any, callback) => {
        await this.handleMessageSeen(socket, payload, callback);
      });

      socket.on("messageDelivered", async (payload: any, callback) => {
        await this.handleMessageDelivered(socket, payload, callback);
      });

      socket.on("typing:start", async (payload: any) => {
        await this.handleTyping(socket, payload, "typing:start");
      });

      socket.on("typing:stop", async (payload: any) => {
        await this.handleTyping(socket, payload, "typing:stop");
      });

      socket.on("sendMessage", async (payload: any, callback) => {
        await this.handleSendMessage(socket, payload, callback);
      });

      socket.on("editMessage", async (payload: any, callback) => {
        await this.handleEditMessage(socket, payload, callback);
      });

      socket.on("deleteMessage", async (payload: any, callback) => {
        await this.handleDeleteMessage(socket, payload, callback);
      });

      socket.on("revokeMessage", async (payload: any, callback) => {
        await this.handleRevokeMessage(socket, payload, callback);
      });

      socket.on("addReaction", async (payload: any, callback) => {
        await this.handleAddReaction(socket, payload, callback);
      });

      socket.on("removeReaction", async (payload: any, callback) => {
        await this.handleRemoveReaction(socket, payload, callback);
      });

      socket.on("markAllSeen", async (payload: any, callback) => {
        await this.handleMarkAllSeen(socket, payload, callback);
      });

      socket.on("deleteMessageForEveryone", async (payload: any, callback) => {
        await this.handleDeleteMessageForEveryone(socket, payload, callback);
      });

      socket.on("disconnect", () => {});
    });
  }

  private async handleJoinGroup(
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
  }

  private async handleLeaveGroup(
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

      socket.leave(`group:${conversationId}`);
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
        this.emitToUser(memberId, "messageSeen", {
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
        this.emitToUser(memberId, "messageDelivered", {
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
    payload: { toUserId?: string; groupId?: string },
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

  private async handleSendMessage(
    socket: AuthenticatedSocket,
    payload: { conversationId: string; text?: string; media?: MediaAttachment[] },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      if (!this.checkRateLimit(userId, "sendMessage")) {
        if (callback) callback({ success: false, error: "Rate limit exceeded. Please slow down." });
        return;
      }

      const { conversationId, text, media } = payload;

      if (!conversationId) {
        if (callback) callback({ success: false, error: "conversationId is required" });
        return;
      }

      if (!text && (!media || media.length === 0)) {
        if (callback) callback({ success: false, error: "Either text or media is required" });
        return;
      }

      const conversationDetail = await this.useCase.getConversationDetail(conversationId, userId);
      const isGroup = conversationDetail.conversation.type === "group";

      const message = isGroup
        ? await this.useCase.sendGroupMessage(conversationId, userId, text, media)
        : await this.useCase.sendMessage(conversationId, userId, text, media);

      const memberUserIds = await this.getMemberUserIds(conversationId, userId);

      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, "receiveMessage", {
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
    payload: { messageId: string; text: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { messageId, text } = payload;

      if (!messageId || !text) {
        if (callback) callback({ success: false, error: "messageId and text are required" });
        return;
      }

      const message = await this.useCase.editMessage(messageId, userId, text);

      const memberUserIds = await this.getMemberUserIds(message.conversationId);

      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, "message:edited", {
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
    payload: { messageId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { messageId } = payload;

      if (!messageId) {
        if (callback) callback({ success: false, error: "messageId is required" });
        return;
      }

      const message = await this.useCase.getMessage(messageId);
      if (!message) {
        if (callback) callback({ success: false, error: "Message not found" });
        return;
      }

      await this.useCase.deleteMessageForMe(messageId, userId);

      const memberUserIds = await this.getMemberUserIds(message.conversationId);
      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, "message:deleted", {
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
    payload: { messageId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { messageId } = payload;

      if (!messageId) {
        if (callback) callback({ success: false, error: "messageId is required" });
        return;
      }

      const message = await this.useCase.revokeMessage(messageId, userId);

      const memberUserIds = await this.getMemberUserIds(message.conversationId);

      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, "message:revoked", {
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
        this.emitToUser(memberId, "message:reaction", {
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
        this.emitToUser(memberId, "message:reaction:remove", {
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
    payload: { messageId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { messageId } = payload;

      if (!messageId) {
        if (callback) callback({ success: false, error: "messageId is required" });
        return;
      }

      const message = await this.useCase.deleteMessageForEveryone(messageId, userId);

      const memberUserIds = await this.getMemberUserIds(message.conversationId);
      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, "message:deleted_for_everyone", {
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
          this.emitToUser(memberId, "messageSeen", {
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

  public notifyNewGroup(memberUserIds: string[], groupData: any) {
    for (const userId of memberUserIds) {
      this.namespace.to(`user:${userId}`).emit("conversation:created", groupData);
    }
  }

  public notifyMembersAdded(conversationId: string, newMembers: any[]) {
    this.emitToGroupRoom(conversationId, "conversation:members_added", {
      conversationId,
      newMembers,
    });
  }

  public notifyMemberRemoved(conversationId: string, removedUserId: string) {
    this.emitToGroupRoom(conversationId, "conversation:member_removed", {
      conversationId,
      removedUserId,
    });
  }

  public notifyGroupUpdated(conversationId: string, updatedData: any) {
    this.emitToGroupRoom(conversationId, "conversation:updated", {
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
    this.emitToUser(userId, "messageSeen", {
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
    this.emitToUser(userId, "messageDelivered", {
      conversationId,
      userId: deliveredByUserId,
      lastDeliveredMessageId,
    });
  }

  public notifyMessageDeleted(
    conversationId: string,
    messageId: string,
    deletedBy: string,
  ) {
    this.emitToGroupRoom(conversationId, "message:deleted", {
      conversationId,
      messageId,
      deletedBy,
    });
  }

  public notifyAdminChanged(conversationId: string, targetUserId: string, isAdmin: boolean) {
    this.emitToGroupRoom(conversationId, "group:admin_changed", {
      conversationId,
      targetUserId,
      isAdmin,
    });
  }

  public notifyOwnerTransferred(conversationId: string, oldOwnerId: string, newOwnerId: string) {
    this.emitToGroupRoom(conversationId, "group:owner_transferred", {
      conversationId,
      oldOwnerId,
      newOwnerId,
    });
  }

  public notifyPollCreated(conversationId: string, poll: any) {
    this.emitToGroupRoom(conversationId, "poll:new", {
      conversationId,
      poll,
    });
  }

  public notifyPollVoted(conversationId: string, pollId: string, userId: string, poll: any) {
    this.emitToGroupRoom(conversationId, "poll:vote", {
      conversationId,
      pollId,
      userId,
      poll,
    });
  }

  public notifyMemberApproved(conversationId: string, userId: string, member: any) {
    this.emitToGroupRoom(conversationId, "group:member_approved", {
      conversationId,
      userId,
      member,
    });
    this.emitToUser(userId, "group:member_approved", {
      conversationId,
      userId,
      member,
    });
  }

  public notifyMemberRejected(conversationId: string, userId: string) {
    this.emitToUser(userId, "group:member_rejected", {
      conversationId,
      userId,
    });
  }

  public notifyGroupSettingsUpdated(conversationId: string, settings: any) {
    this.emitToGroupRoom(conversationId, "group:settings_updated", {
      conversationId,
      settings,
    });
  }
}
