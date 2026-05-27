import { SocketEvent } from "../../../constants/socket-events";
import { AuthenticatedSocket, SocketHandlerContext } from "./types";
import { emitPresenceToVisibleSockets } from "@share/component/socket-io";

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
        await emitPresenceToVisibleSockets(
          service.namespace as any,
          "user:online",
          socket.userId,
          {
            userId: socket.userId,
            socketId: socket.id,
            timestamp: Date.now(),
          },
          { isOnline: true, lastSeen: Date.now() },
        );
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
    socket.on(SocketEvent.UPDATE_GROUP_SETTINGS, async (payload: any, callback) => service.handleUpdateGroupSettings(socket, payload, callback));
    socket.on(SocketEvent.UPDATE_GROUP_INFO, async (payload: any, callback) => service.handleUpdateGroupInfo(socket, payload, callback));
    socket.on(SocketEvent.CREATE_POLL, async (payload: any, callback) => service.handleCreatePoll(socket, payload, callback));
    socket.on(SocketEvent.VOTE_POLL, async (payload: any, callback) => service.handleVotePoll(socket, payload, callback));
    socket.on(SocketEvent.ADD_POLL_OPTION, async (payload: any, callback) => service.handleAddPollOption(socket, payload, callback));
    socket.on(SocketEvent.CLOSE_POLL, async (payload: any, callback) => service.handleClosePoll(socket, payload, callback));
    socket.on(SocketEvent.PIN_POLL, async (payload: any, callback) => service.handlePinPoll(socket, payload, callback));
    socket.on(SocketEvent.UNPIN_POLL, async (payload: any, callback) => service.handleUnpinPoll(socket, payload, callback));
    socket.on(SocketEvent.CREATE_REMINDER, async (payload: any, callback) => service.handleCreateReminder(socket, payload, callback));
    socket.on(SocketEvent.UPDATE_REMINDER, async (payload: any, callback) => service.handleUpdateReminder(socket, payload, callback));
    socket.on(SocketEvent.DELETE_REMINDER, async (payload: any, callback) => service.handleDeleteReminder(socket, payload, callback));
    socket.on(SocketEvent.PIN_REMINDER, async (payload: any, callback) => service.handlePinReminder(socket, payload, callback));
    socket.on(SocketEvent.UNPIN_REMINDER, async (payload: any, callback) => service.handleUnpinReminder(socket, payload, callback));
    socket.on(SocketEvent.CREATE_NOTE, async (payload: any, callback) => service.handleCreateNote(socket, payload, callback));
    socket.on(SocketEvent.UPDATE_NOTE, async (payload: any, callback) => service.handleUpdateNote(socket, payload, callback));
    socket.on(SocketEvent.DELETE_NOTE, async (payload: any, callback) => service.handleDeleteNote(socket, payload, callback));
    socket.on(SocketEvent.VOICE_MESSAGE, async (payload: any, callback) => service.handleVoiceMessage(socket, payload, callback));
    socket.on(SocketEvent.LOCATION_SHARE, async (payload: any, callback) => service.handleLocationShare(socket, payload, callback));

    socket.on(SocketEvent.GET_GROUP_INVITE_LINK, async (payload: any, callback) => service.handleGetGroupInviteLink(socket, payload, callback));
    socket.on(SocketEvent.REGENERATE_GROUP_INVITE_LINK, async (payload: any, callback) => service.handleRegenerateGroupInviteLink(socket, payload, callback));
    socket.on(SocketEvent.REVOKE_GROUP_INVITE_LINK, async (payload: any, callback) => service.handleRevokeGroupInviteLink(socket, payload, callback));
    socket.on(SocketEvent.JOIN_GROUP_BY_INVITE, async (payload: any, callback) => service.handleJoinGroupByInvite(socket, payload, callback));
    socket.on(SocketEvent.BLOCK_GROUP_MEMBER, async (payload: any, callback) => service.handleBlockGroupMember(socket, payload, callback));
    socket.on(SocketEvent.UNBLOCK_GROUP_MEMBER, async (payload: any, callback) => service.handleUnblockGroupMember(socket, payload, callback));

    socket.on("disconnect", async () => {
      if (!socket.userId) return;
      const state = await service.presenceUseCase?.unregisterSocket(
        socket.userId,
        service.presenceSocketId(socket),
      );
      if (state?.becameOffline) {
        await emitPresenceToVisibleSockets(
          service.namespace as any,
          "user:offline",
          socket.userId,
          {
            userId: socket.userId,
            timestamp: Date.now(),
          },
          { isOnline: false, lastSeen: Date.now() },
        );
      }
    });
  });
}
