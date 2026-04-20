import { IMessagingUseCase } from "../../interface";
import { Server as SocketIOServer, Namespace, Socket } from "socket.io";
import { MediaAttachment, MessageType } from "../../model";
import { SocketEvent } from "../../constants/socket-events";

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
    forwardMessages: 30,
    quoteMessage: 60,
  };

  constructor(
    io: SocketIOServer,
    private readonly useCase: IMessagingUseCase,
  ) {
    this.namespace = io.of("/messages");
    
    // Add authentication middleware for the /messages namespace
    this.namespace.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.query?.token ||
          socket.handshake.headers?.authorization?.replace("Bearer ", "");

        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        const jwtProvider = require("../../../../share/component/jwt").jwtProvider;
        const payload = await jwtProvider.verifyToken(token);

        if (!payload || !payload.sub) {
          return next(new Error("Authentication error: Invalid token"));
        }

        socket.userId = payload.sub;
        socket.deviceId = socket.handshake.auth?.deviceId || (socket.handshake.query?.deviceId as string);
        next();
      } catch (error) {
        next(new Error("Authentication error"));
      }
    });

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

      socket.on(SocketEvent.JOIN_GROUP, async (payload: any, callback) => {
        await this.handleJoinGroup(socket, payload, callback);
      });

      socket.on(SocketEvent.LEAVE_GROUP, async (payload: any, callback) => {
        await this.handleLeaveGroup(socket, payload, callback);
      });

      socket.on(SocketEvent.MESSAGE_SEEN, async (payload: any, callback) => {
        await this.handleMessageSeen(socket, payload, callback);
      });

      socket.on(SocketEvent.MESSAGE_DELIVERED, async (payload: any, callback) => {
        await this.handleMessageDelivered(socket, payload, callback);
      });

      socket.on(SocketEvent.TYPING_START, async (payload: any) => {
        await this.handleTypingStart(socket, payload);
      });

      socket.on(SocketEvent.TYPING_STOP, async (payload: any) => {
        await this.handleTypingStop(socket, payload);
      });

      socket.on(SocketEvent.SEND_MESSAGE, async (payload: any, callback) => {
        await this.handleSendMessage(socket, payload, callback);
      });

      socket.on(SocketEvent.EDIT_MESSAGE, async (payload: any, callback) => {
        await this.handleEditMessage(socket, payload, callback);
      });

      socket.on(SocketEvent.DELETE_MESSAGE, async (payload: any, callback) => {
        await this.handleDeleteMessage(socket, payload, callback);
      });

      socket.on(SocketEvent.REVOKE_MESSAGE, async (payload: any, callback) => {
        await this.handleRevokeMessage(socket, payload, callback);
      });

      socket.on(SocketEvent.ADD_REACTION, async (payload: any, callback) => {
        await this.handleAddReaction(socket, payload, callback);
      });

      socket.on(SocketEvent.REMOVE_REACTION, async (payload: any, callback) => {
        await this.handleRemoveReaction(socket, payload, callback);
      });

      socket.on(SocketEvent.MARK_ALL_SEEN, async (payload: any, callback) => {
        await this.handleMarkAllSeen(socket, payload, callback);
      });

      socket.on(SocketEvent.DELETE_MESSAGE_FOR_EVERYONE, async (payload: any, callback) => {
        await this.handleDeleteMessageForEveryone(socket, payload, callback);
      });

      socket.on(SocketEvent.FORWARD_MESSAGES, async (payload: any, callback) => {
        await this.handleForwardMessages(socket, payload, callback);
      });

      socket.on(SocketEvent.QUOTE_MESSAGE, async (payload: any, callback) => {
        await this.handleQuoteMessage(socket, payload, callback);
      });

      socket.on(SocketEvent.DISSOLVE_GROUP, async (payload: any, callback) => {
        await this.handleDissolveGroup(socket, payload, callback);
      });

      socket.on(SocketEvent.PIN_CONVERSATION, async (payload: any, callback) => {
        await this.handlePinConversation(socket, payload, callback);
      });

      socket.on(SocketEvent.UNPIN_CONVERSATION, async (payload: any, callback) => {
        await this.handleUnpinConversation(socket, payload, callback);
      });

      socket.on(SocketEvent.ARCHIVE_CONVERSATION, async (payload: any, callback) => {
        await this.handleArchiveConversation(socket, payload, callback);
      });

      socket.on(SocketEvent.UNARCHIVE_CONVERSATION, async (payload: any, callback) => {
        await this.handleUnarchiveConversation(socket, payload, callback);
      });

      socket.on(SocketEvent.MUTE_CONVERSATION, async (payload: any, callback) => {
        await this.handleMuteConversation(socket, payload, callback);
      });

      socket.on(SocketEvent.UNMUTE_CONVERSATION, async (payload: any, callback) => {
        await this.handleUnmuteConversation(socket, payload, callback);
      });

      socket.on(SocketEvent.PIN_MESSAGE, async (payload: any, callback) => {
        await this.handlePinMessage(socket, payload, callback);
      });

      socket.on(SocketEvent.UNPIN_MESSAGE, async (payload: any, callback) => {
        await this.handleUnpinMessage(socket, payload, callback);
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
  }

  private async handleTypingStart(
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
        socket.to(`group_room:${groupId}`).emit(SocketEvent.TYPING_START, {
          userId,
          groupId,
        });
      }
    } catch (error) {
      console.error("Error handling typing:start:", error);
    }
  }

  private async handleTypingStop(
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
        socket.to(`group_room:${groupId}`).emit(SocketEvent.TYPING_STOP, {
          userId,
          groupId,
        });
      }
    } catch (error) {
      console.error("Error handling typing:stop:", error);
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

      const messages = isGroup
        ? await this.useCase.sendGroupMessage(conversationId, userId, text, media)
        : await this.useCase.sendMessage(conversationId, userId, text, media);

      const memberUserIds = await this.getMemberUserIds(conversationId, userId);

      for (const msg of messages) {
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            message: msg,
            conversationId,
          });
        }
      }

      if (callback) {
        callback({ success: true, messages });
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
        this.emitToUser(memberId, SocketEvent.MESSAGE_EDITED, {
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

      this.emitToUser(userId, SocketEvent.MESSAGE_DELETED, {
        conversationId: message.conversationId,
        messageId,
        deletedBy: userId,
      });

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
        this.emitToUser(memberId, SocketEvent.MESSAGE_REVOKED, {
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
        this.emitToUser(memberId, SocketEvent.MESSAGE_DELETED_FOR_EVERYONE, {
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
  }

  public notifyNewGroup(memberUserIds: string[], groupData: any) {
    for (const userId of memberUserIds) {
      this.namespace.to(`user:${userId}`).emit(SocketEvent.CONVERSATION_CREATED, groupData);
    }
  }

  public notifyMembersAdded(conversationId: string, newMembers: any[]) {
    this.emitToGroupRoom(conversationId, SocketEvent.CONVERSATION_MEMBERS_ADDED, {
      conversationId,
      newMembers,
    });
  }

  public notifyMemberRemoved(conversationId: string, removedUserId: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.CONVERSATION_MEMBER_REMOVED, {
      conversationId,
      removedUserId,
    });
  }

  public notifyMemberLeft(conversationId: string, leftUserId: string, leftBy: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_MEMBER_LEFT, {
      conversationId,
      leftUserId,
      leftBy,
    });
  }

  public notifyGroupDissolved(conversationId: string, dissolvedBy: string, memberUserIds: string[]) {
    for (const userId of memberUserIds) {
      this.emitToUser(userId, SocketEvent.GROUP_DISSOLVED, {
        conversationId,
        dissolvedBy,
      });
    }
  }

  public notifyConversationPinned(conversationId: string, pinnedBy: string, pinned: boolean) {
    this.namespace.to(`user:${pinnedBy}`).emit(SocketEvent.CONVERSATION_PIN_TOGGLED, {
      conversationId,
      pinnedBy,
      pinned,
    });
  }

  public notifyConversationArchived(conversationId: string, userId: string, archived: boolean) {
    this.namespace.to(`user:${userId}`).emit(SocketEvent.CONVERSATION_ARCHIVED_TOGGLED, {
      conversationId,
      userId,
      archived,
    });
  }

  public notifyConversationMuted(conversationId: string, userId: string, mutedBy: string, muteUntil?: string) {
    this.namespace.to(`user:${userId}`).emit(SocketEvent.CONVERSATION_MUTE_CHANGED, {
      conversationId,
      userId,
      mutedBy,
      muteUntil,
    });
  }

  public notifyGroupRenamed(conversationId: string, newName: string, renamedBy: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_RENAMED, {
      conversationId,
      newName,
      renamedBy,
    });
  }

  public notifyGroupAvatarChanged(conversationId: string, avatarUrl: string, changedBy: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_AVATAR_CHANGED, {
      conversationId,
      avatarUrl,
      changedBy,
    });
  }

  public notifyGroupUpdated(conversationId: string, updatedData: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.CONVERSATION_UPDATED, {
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
    this.emitToUser(userId, SocketEvent.MESSAGE_SEEN, {
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
    this.emitToUser(userId, SocketEvent.MESSAGE_DELIVERED, {
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
    this.emitToGroupRoom(conversationId, SocketEvent.MESSAGE_DELETED, {
      conversationId,
      messageId,
      deletedBy,
    });
  }

  public notifyAdminChanged(conversationId: string, targetUserId: string, isAdmin: boolean) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_ADMIN_CHANGED, {
      conversationId,
      targetUserId,
      isAdmin,
    });
  }

  public notifyOwnerTransferred(conversationId: string, oldOwnerId: string, newOwnerId: string) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_OWNER_TRANSFERRED, {
      conversationId,
      oldOwnerId,
      newOwnerId,
    });
  }

  public notifyPollCreated(conversationId: string, poll: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.POLL_NEW, {
      conversationId,
      poll,
    });
  }

  public notifyPollVoted(conversationId: string, pollId: string, userId: string, poll: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.POLL_VOTE, {
      conversationId,
      pollId,
      userId,
      poll,
    });
  }

  public notifyMemberApproved(conversationId: string, userId: string, member: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_MEMBER_APPROVED, {
      conversationId,
      userId,
      member,
    });
    this.emitToUser(userId, SocketEvent.GROUP_MEMBER_APPROVED, {
      conversationId,
      userId,
      member,
    });
  }

  public notifyMemberRejected(conversationId: string, userId: string) {
    this.emitToUser(userId, SocketEvent.GROUP_MEMBER_REJECTED, {
      conversationId,
      userId,
    });
  }

  public notifyGroupSettingsUpdated(conversationId: string, settings: any) {
    this.emitToGroupRoom(conversationId, SocketEvent.GROUP_SETTINGS_UPDATED, {
      conversationId,
      settings,
    });
  }

  private async handleForwardMessages(
    socket: AuthenticatedSocket,
    payload: { messageIds: string[]; targetConversationIds: string[] },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      if (!this.checkRateLimit(userId, "forwardMessages")) {
        if (callback) callback({ success: false, error: "Rate limit exceeded. Please slow down." });
        return;
      }

      const { messageIds, targetConversationIds } = payload;

      if (!messageIds || messageIds.length === 0) {
        if (callback) callback({ success: false, error: "messageIds is required" });
        return;
      }

      if (!targetConversationIds || targetConversationIds.length === 0) {
        if (callback) callback({ success: false, error: "targetConversationIds is required" });
        return;
      }

      const forwardedMessages = await this.useCase.forwardMessages(
        userId,
        messageIds,
        targetConversationIds,
      );

      for (const msg of forwardedMessages) {
        const memberUserIds = await this.getMemberUserIds(msg.conversationId, userId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            message: msg,
            conversationId: msg.conversationId,
          });
        }
      }

      if (callback) {
        callback({ success: true, messages: forwardedMessages });
      }
    } catch (error) {
      console.error("Error handling forwardMessages:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleQuoteMessage(
    socket: AuthenticatedSocket,
    payload: {
      conversationId: string;
      quotedMessageId: string;
      text?: string;
      media?: MediaAttachment[];
    },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      if (!this.checkRateLimit(userId, "quoteMessage")) {
        if (callback) callback({ success: false, error: "Rate limit exceeded. Please slow down." });
        return;
      }

      const { conversationId, quotedMessageId, text, media } = payload;

      if (!conversationId) {
        if (callback) callback({ success: false, error: "conversationId is required" });
        return;
      }

      if (!quotedMessageId) {
        if (callback) callback({ success: false, error: "quotedMessageId is required" });
        return;
      }

      if (!text && (!media || media.length === 0)) {
        if (callback) callback({ success: false, error: "Either text or media is required" });
        return;
      }

      const messages = await this.useCase.quoteMessage(
        conversationId,
        userId,
        text,
        media,
        quotedMessageId,
      );

      const memberUserIds = await this.getMemberUserIds(conversationId, userId);

      // Emit RECEIVE_MESSAGE cho tất cả messages
      for (const msg of messages) {
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            message: msg,
            conversationId,
          });
        }
      }

      // Emit MESSAGE_QUOTED cho primary message (tin nhắn chính)
      const primaryMsg =
        messages.find((m) => m.type === MessageType.TEXT) ||
        messages.find((m) => m.type === MessageType.LINK) ||
        messages.find((m) => m.type === MessageType.IMAGE) ||
        messages[0];

      if (primaryMsg) {
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.MESSAGE_QUOTED, {
            conversationId,
            message: primaryMsg,
            quotedMessageId,
          });
        }
      }

      if (callback) {
        callback({ success: true, message: primaryMsg || messages[0] });
      }
    } catch (error) {
      console.error("Error handling quoteMessage:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  }

  private async handleDissolveGroup(
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

      const memberUserIds = await this.getMemberUserIds(groupId);

      await this.useCase.dissolveGroup(groupId, userId);

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
  }

  private async handlePinConversation(
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
  }

  private async handleUnpinConversation(
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
  }

  private async handleArchiveConversation(
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
  }

  private async handleUnarchiveConversation(
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
  }

  private async handleMuteConversation(
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
  }

  private async handleUnmuteConversation(
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
  }

  private async handlePinMessage(
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
  }

  private async handleUnpinMessage(
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
  }
}
