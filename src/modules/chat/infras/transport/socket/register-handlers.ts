import { SocketEvent } from "../../../constants/socket-events";
import { AuthenticatedSocket, SocketHandlerContext } from "./types";

type SocketServiceWithHandlers = SocketHandlerContext & Record<string, (...args: any[]) => any>;

export function registerMessagingSocketHandlers(service: SocketServiceWithHandlers) {
  service.namespace.on("connection", async (socket: AuthenticatedSocket) => {
    if (socket.userId) {
      socket.join("user:" + socket.userId);
      socket.join("user_room:" + socket.userId);
      const state = await service.presenceUseCase?.registerSocket(
        socket.userId,
        service.presenceSocketId(socket),
      );
      if (state?.becameOnline) {
        service.namespace.emit("user:online", {
          userId: socket.userId,
          socketId: socket.id,
          timestamp: Date.now(),
        });
      }
    }

    socket.on("heartbeat", async () => {
      await service.touchPresence(socket);
    });

    socket.on("ping", async () => {
      await service.touchPresence(socket);
    });

    socket.on(SocketEvent.JOIN_GROUP, async (payload: any, callback) => service.handleJoinGroup(socket, payload, callback));
    socket.on(SocketEvent.LEAVE_GROUP, async (payload: any, callback) => service.handleLeaveGroup(socket, payload, callback));
    socket.on(SocketEvent.MESSAGE_SEEN, async (payload: any, callback) => service.handleMessageSeen(socket, payload, callback));
    socket.on(SocketEvent.MESSAGE_DELIVERED, async (payload: any, callback) => service.handleMessageDelivered(socket, payload, callback));
    socket.on(SocketEvent.TYPING_START, async (payload: any) => service.handleTypingStart(socket, payload));
    socket.on(SocketEvent.TYPING_STOP, async (payload: any) => service.handleTypingStop(socket, payload));
    socket.on(SocketEvent.SEND_MESSAGE, async (payload: any, callback) => service.handleSendMessage(socket, payload, callback));
    socket.on(SocketEvent.EDIT_MESSAGE, async (payload: any, callback) => service.handleEditMessage(socket, payload, callback));
    socket.on(SocketEvent.DELETE_MESSAGE, async (payload: any, callback) => service.handleDeleteMessage(socket, payload, callback));
    socket.on(SocketEvent.REVOKE_MESSAGE, async (payload: any, callback) => service.handleRevokeMessage(socket, payload, callback));
    socket.on(SocketEvent.ADD_REACTION, async (payload: any, callback) => service.handleAddReaction(socket, payload, callback));
    socket.on(SocketEvent.REMOVE_REACTION, async (payload: any, callback) => service.handleRemoveReaction(socket, payload, callback));
    socket.on(SocketEvent.MARK_ALL_SEEN, async (payload: any, callback) => service.handleMarkAllSeen(socket, payload, callback));
    socket.on(SocketEvent.DELETE_MESSAGE_FOR_EVERYONE, async (payload: any, callback) => service.handleDeleteMessageForEveryone(socket, payload, callback));
    socket.on(SocketEvent.FORWARD_MESSAGES, async (payload: any, callback) => service.handleForwardMessages(socket, payload, callback));
    socket.on(SocketEvent.QUOTE_MESSAGE, async (payload: any, callback) => service.handleQuoteMessage(socket, payload, callback));
    socket.on(SocketEvent.DISSOLVE_GROUP, async (payload: any, callback) => service.handleDissolveGroup(socket, payload, callback));
    socket.on(SocketEvent.PIN_CONVERSATION, async (payload: any, callback) => service.handlePinConversation(socket, payload, callback));
    socket.on(SocketEvent.UNPIN_CONVERSATION, async (payload: any, callback) => service.handleUnpinConversation(socket, payload, callback));
    socket.on(SocketEvent.ARCHIVE_CONVERSATION, async (payload: any, callback) => service.handleArchiveConversation(socket, payload, callback));
    socket.on(SocketEvent.UNARCHIVE_CONVERSATION, async (payload: any, callback) => service.handleUnarchiveConversation(socket, payload, callback));
    socket.on(SocketEvent.MUTE_CONVERSATION, async (payload: any, callback) => service.handleMuteConversation(socket, payload, callback));
    socket.on(SocketEvent.UNMUTE_CONVERSATION, async (payload: any, callback) => service.handleUnmuteConversation(socket, payload, callback));
    socket.on(SocketEvent.PIN_MESSAGE, async (payload: any, callback) => service.handlePinMessage(socket, payload, callback));
    socket.on(SocketEvent.UNPIN_MESSAGE, async (payload: any, callback) => service.handleUnpinMessage(socket, payload, callback));
    socket.on(SocketEvent.ADD_MEMBERS, async (payload: any, callback) => service.handleAddMembers(socket, payload, callback));
    socket.on(SocketEvent.REMOVE_MEMBER, async (payload: any, callback) => service.handleRemoveMember(socket, payload, callback));
    socket.on(SocketEvent.SET_ADMIN, async (payload: any, callback) => service.handleSetAdmin(socket, payload, callback));
    socket.on(SocketEvent.TRANSFER_OWNER, async (payload: any, callback) => service.handleTransferOwner(socket, payload, callback));
    socket.on(SocketEvent.APPROVE_MEMBER, async (payload: any, callback) => service.handleApproveMember(socket, payload, callback));
    socket.on(SocketEvent.REJECT_MEMBER, async (payload: any, callback) => service.handleRejectMember(socket, payload, callback));
    socket.on(SocketEvent.CREATE_POLL, async (payload: any, callback) => service.handleCreatePoll(socket, payload, callback));
    socket.on(SocketEvent.VOTE_POLL, async (payload: any, callback) => service.handleVotePoll(socket, payload, callback));
    socket.on(SocketEvent.VOICE_MESSAGE, async (payload: any, callback) => service.handleVoiceMessage(socket, payload, callback));
    socket.on(SocketEvent.LOCATION_SHARE, async (payload: any, callback) => service.handleLocationShare(socket, payload, callback));

    socket.on("disconnect", async () => {
      if (!socket.userId) return;
      const state = await service.presenceUseCase?.unregisterSocket(
        socket.userId,
        service.presenceSocketId(socket),
      );
      if (state?.becameOffline) {
        service.namespace.emit("user:offline", {
          userId: socket.userId,
          timestamp: Date.now(),
        });
      }
    });
  });
}
