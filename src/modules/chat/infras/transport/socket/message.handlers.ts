import { MediaAttachment, MessageType } from "../../../model";
import { SocketEvent } from "../../../constants/socket-events";
import { AuthenticatedSocket, SocketHandlerContext } from "./types";
import { getAttachedMessage } from "../../../usecase/utility-messages";
import { isBotReminderRequest, parseReminderAgentRequest } from "../../../usecase/reminder-agent";

async function emitMessageToMembers(
  context: SocketHandlerContext,
  conversationId: string,
  message: unknown,
) {
  if (!message) return;
  const memberUserIds = await context.getMemberUserIds(conversationId);
  for (const memberId of memberUserIds) {
    context.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
      conversationId,
      message,
    });
  }
}

async function processReminderAgentRequest(
  context: SocketHandlerContext,
  conversationId: string,
  userId: string,
  text: string,
) {
  try {
    const parsed = await parseReminderAgentRequest(text);
    if (!parsed.shouldCreate || !parsed.title || !parsed.remindAt) {
      context.emitToUser(userId, SocketEvent.AI_REMINDER_AGENT_ERROR, {
        conversationId,
        reason: parsed.reason || "Missing reminder details",
        title: parsed.title,
      });
      return;
    }

    const reminder = await context.useCase.createGroupReminder(
      conversationId,
      userId,
      parsed.title,
      parsed.description,
      parsed.remindAt,
      parsed.repeatRule,
      parsed.notifyBeforeMinutes,
    );

    const message = getAttachedMessage(reminder, "timelineMessage");
    await emitMessageToMembers(context, conversationId, message);

    context.emitToGroupRoom(conversationId, SocketEvent.GROUP_REMINDER_CREATED, {
      conversationId,
      reminder,
      createdBy: userId,
      message,
      aiAgent: true,
    });

    context.emitToUser(userId, SocketEvent.AI_REMINDER_AGENT_RESULT, {
      conversationId,
      reminder,
      message,
    });
  } catch (error) {
    console.error("Reminder agent failed:", error);
    context.emitToUser(userId, SocketEvent.AI_REMINDER_AGENT_ERROR, {
      conversationId,
      reason: (error as Error).message || "Reminder agent failed",
    });
  }
}

export const messageSocketHandlers = {
  async handleSendMessage(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { conversationId: string; text?: string; media?: MediaAttachment[]; ttlSeconds?: number; clientMessageId?: string },
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

      const { conversationId, text, media, ttlSeconds, clientMessageId } = payload;

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
        ? await this.useCase.sendGroupMessage(conversationId, userId, text, media, ttlSeconds, clientMessageId)
        : await this.useCase.sendMessage(conversationId, userId, text, media, ttlSeconds, clientMessageId);

      const memberUserIds = await this.getMemberUserIds(conversationId);

      for (const msg of messages) {
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            message: msg,
            conversationId,
          });
        }
      }

      if (isGroup && text && isBotReminderRequest(text)) {
        void processReminderAgentRequest(this, conversationId, userId, text);
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
  },

  async handleEditMessage(this: SocketHandlerContext, 
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

      const message = await this.useCase.editMessage(messageId, userId, text, 30_000);

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
  },

  async handleDeleteMessage(this: SocketHandlerContext, 
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
  },

  async handleRevokeMessage(this: SocketHandlerContext, 
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
  },

  async handleDeleteMessageForEveryone(this: SocketHandlerContext, 
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
  },

  async handleForwardMessages(this: SocketHandlerContext, 
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
        const memberUserIds = await this.getMemberUserIds(msg.conversationId);
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
  },

  async handleQuoteMessage(this: SocketHandlerContext, 
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

      const memberUserIds = await this.getMemberUserIds(conversationId);

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
  },

  async handleVoiceMessage(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { conversationId: string; mediaUrl: string; duration?: number },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { conversationId, mediaUrl, duration } = payload;
      if (!conversationId || !mediaUrl) {
        if (callback) callback({ success: false, error: "conversationId and mediaUrl are required" });
        return;
      }

      const media = [{
        url: mediaUrl,
        filename: `voice-${Date.now()}.webm`,
        mimetype: "audio/webm",
        size: 0,
      }];

      const conversationDetail = await this.useCase.getConversationDetail(conversationId, userId);
      const messages = conversationDetail.conversation.type === "group"
        ? await this.useCase.sendGroupMessage(conversationId, userId, undefined, media as any)
        : await this.useCase.sendMessage(conversationId, userId, undefined, media as any);

      await this.useCase.getConversationDetail(conversationId, userId);
      const memberUserIds = await this.getMemberUserIds(conversationId);
      for (const msg of messages) {
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.VOICE_MESSAGE, {
            message: msg,
            conversationId,
          });
        }
      }

      if (callback) callback({ success: true, messages });
    } catch (error) {
      console.error("Error handling voiceMessage:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleLocationShare(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { conversationId: string; latitude: number; longitude: number; accuracy?: number },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { conversationId, latitude, longitude, accuracy } = payload;
      if (!conversationId || latitude === undefined || longitude === undefined) {
        if (callback) callback({ success: false, error: "conversationId, latitude, and longitude are required" });
        return;
      }

      const memberUserIds = await this.getMemberUserIds(conversationId, userId);
      const location = { latitude, longitude, accuracy };

      for (const memberId of memberUserIds) {
        this.emitToUser(memberId, SocketEvent.LOCATION_SHARE, {
          conversationId,
          userId,
          location,
        });
      }

      if (callback) callback({ success: true });
    } catch (error) {
      console.error("Error handling locationShare:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },
};
