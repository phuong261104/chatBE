import { SocketEvent } from "../../../constants/socket-events";
import { AuthenticatedSocket, SocketHandlerContext } from "./types";
import { getAttachedMessage } from "../../../usecase/utility-messages";

export const memberSocketHandlers = {
  async handleAddMembers(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { groupId: string; memberIds: string[] },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { groupId, memberIds } = payload;

      if (!groupId || !memberIds || memberIds.length === 0) {
        if (callback) callback({ success: false, error: "groupId and memberIds are required" });
        return;
      }

      const newMembers = await this.useCase.addMembersToGroup(groupId, userId, memberIds);

      const membersAddedPayload = {
        conversationId: groupId,
        newMembers,
        addedBy: userId,
      };

      this.emitToGroupRoom(groupId, SocketEvent.CONVERSATION_MEMBERS_ADDED, membersAddedPayload);

      for (const member of newMembers) {
        if (member?.userId) {
          this.emitToUser(member.userId, SocketEvent.CONVERSATION_MEMBERS_ADDED, membersAddedPayload);
        }
      }

      if (callback) {
        callback({ success: true, newMembers });
      }
    } catch (error) {
      console.error("Error handling addMembers:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleRemoveMember(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { groupId: string; targetUserId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { groupId, targetUserId } = payload;

      if (!groupId || !targetUserId) {
        if (callback) callback({ success: false, error: "groupId and targetUserId are required" });
        return;
      }

      await this.useCase.removeMemberFromGroup(groupId, userId, targetUserId);

      const memberRemovedPayload = {
        conversationId: groupId,
        removedUserId: targetUserId,
        removedBy: userId,
        reason: "removed",
      };

      this.emitToGroupRoom(groupId, SocketEvent.CONVERSATION_MEMBER_REMOVED, memberRemovedPayload);
      this.emitToUser(targetUserId, SocketEvent.CONVERSATION_MEMBER_REMOVED, memberRemovedPayload);

      this.emitToUser(targetUserId, SocketEvent.GROUP_MEMBER_LEFT, {
        conversationId: groupId,
        leftUserId: targetUserId,
        leftBy: userId,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling removeMember:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleSetAdmin(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { groupId: string; targetUserId: string; isAdmin: boolean },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { groupId, targetUserId, isAdmin } = payload;

      if (!groupId || !targetUserId) {
        if (callback) callback({ success: false, error: "groupId and targetUserId are required" });
        return;
      }

      await this.useCase.setAdmin(groupId, userId, targetUserId, isAdmin);

      this.emitToGroupRoom(groupId, SocketEvent.GROUP_ADMIN_CHANGED, {
        conversationId: groupId,
        targetUserId,
        isAdmin,
        changedBy: userId,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling setAdmin:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleTransferOwner(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { groupId: string; newOwnerId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { groupId, newOwnerId } = payload;

      if (!groupId || !newOwnerId) {
        if (callback) callback({ success: false, error: "groupId and newOwnerId are required" });
        return;
      }

      await this.useCase.transferOwner(groupId, userId, newOwnerId);

      this.emitToGroupRoom(groupId, SocketEvent.GROUP_OWNER_TRANSFERRED, {
        conversationId: groupId,
        oldOwnerId: userId,
        newOwnerId,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling transferOwner:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleApproveMember(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { groupId: string; userIdToApprove: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { groupId, userIdToApprove } = payload;

      if (!groupId || !userIdToApprove) {
        if (callback) callback({ success: false, error: "groupId and userIdToApprove are required" });
        return;
      }

      const member = await this.useCase.approveMember(groupId, userIdToApprove, userId);

      this.emitToGroupRoom(groupId, SocketEvent.GROUP_MEMBER_APPROVED, {
        conversationId: groupId,
        userId: userIdToApprove,
        member,
        approvedBy: userId,
      });

      this.emitToUser(userIdToApprove, SocketEvent.GROUP_MEMBER_APPROVED, {
        conversationId: groupId,
        userId: userIdToApprove,
        member,
        approvedBy: userId,
      });

      if (callback) {
        callback({ success: true, member });
      }
    } catch (error) {
      console.error("Error handling approveMember:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleRejectMember(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { groupId: string; userIdToReject: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { groupId, userIdToReject } = payload;

      if (!groupId || !userIdToReject) {
        if (callback) callback({ success: false, error: "groupId and userIdToReject are required" });
        return;
      }

      await this.useCase.rejectMember(groupId, userIdToReject, userId);

      this.emitToUser(userIdToReject, SocketEvent.GROUP_MEMBER_REJECTED, {
        conversationId: groupId,
        userId: userIdToReject,
        rejectedBy: userId,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error handling rejectMember:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleCreatePoll(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: {
      conversationId: string;
      question: string;
      options: string[];
      isMultipleChoice?: boolean;
      allowAddOption?: boolean;
      allowChangeVote?: boolean;
      showResultsBeforeClose?: boolean;
      hideVoters?: boolean;
      expiresAt?: string;
    },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { conversationId, question, options, isMultipleChoice, allowAddOption, allowChangeVote, showResultsBeforeClose, hideVoters, expiresAt } = payload;

      if (!conversationId || !question || !options || options.length < 2) {
        if (callback) callback({ success: false, error: "conversationId, question, and at least 2 options are required" });
        return;
      }

      const poll = await this.useCase.createPoll(
        conversationId,
        userId,
        question,
        options,
        isMultipleChoice,
        allowAddOption,
        allowChangeVote,
        showResultsBeforeClose,
        expiresAt,
        hideVoters,
      );

      const message = getAttachedMessage(poll, "timelineMessage");
      if (message) {
        const memberUserIds = await this.getMemberUserIds(conversationId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, { conversationId, message });
        }
      }

      this.emitToGroupRoom(conversationId, SocketEvent.POLL_NEW, {
        conversationId,
        poll,
        createdBy: userId,
        message,
      });

      if (callback) {
        callback({ success: true, poll });
      }
    } catch (error) {
      console.error("Error handling createPoll:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleVotePoll(this: SocketHandlerContext, 
    socket: AuthenticatedSocket,
    payload: { pollId: string; optionIds: string[] },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;

      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const { pollId, optionIds } = payload;

      if (!pollId || !optionIds || optionIds.length === 0) {
        if (callback) callback({ success: false, error: "pollId and optionIds are required" });
        return;
      }

      const poll = await this.useCase.votePoll(pollId, userId, optionIds);
      const activityMessage = getAttachedMessage(poll, "activityMessage");
      const activityMessageUpdated = (poll as any).activityMessageUpdated === true;

      // Get conversationId from poll for room emission
      const conversationId = (poll as any).conversationId;
      if (conversationId) {
        if (activityMessage) {
          if (activityMessageUpdated) {
            this.emitToGroupRoom(conversationId, SocketEvent.MESSAGE_EDITED, {
              conversationId,
              message: activityMessage,
            });
          } else {
            const memberUserIds = await this.getMemberUserIds(conversationId);
            for (const memberId of memberUserIds) {
              this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, { conversationId, message: activityMessage });
            }
          }
        }
        this.emitToGroupRoom(conversationId, SocketEvent.POLL_VOTE, {
          conversationId,
          pollId,
          poll,
          votedBy: userId,
          activityMessage,
        });
      }

      if (callback) {
        callback({ success: true, poll });
      }
    } catch (error) {
      console.error("Error handling votePoll:", error);
      if (callback) {
        callback({ success: false, error: (error as Error).message });
      }
    }
  },

  async handleAddPollOption(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { pollId: string; text: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const poll = await this.useCase.addPollOption(payload.pollId, userId, payload.text);
      const systemMessage = getAttachedMessage(poll, "systemMessage");
      if (systemMessage) {
        const memberUserIds = await this.getMemberUserIds(poll.conversationId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: poll.conversationId,
            message: systemMessage,
          });
        }
      }
      this.emitToGroupRoom(poll.conversationId, SocketEvent.POLL_OPTION_ADDED, {
        conversationId: poll.conversationId,
        pollId: poll.id,
        poll,
        addedBy: userId,
      });
      if (callback) callback({ success: true, poll });
    } catch (error) {
      console.error("Error handling addPollOption:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleClosePoll(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { pollId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const poll = await this.useCase.closePoll(payload.pollId, userId);
      const systemMessage = getAttachedMessage(poll, "systemMessage");
      if (systemMessage) {
        const memberUserIds = await this.getMemberUserIds(poll.conversationId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: poll.conversationId,
            message: systemMessage,
          });
        }
      }
      this.emitToGroupRoom(poll.conversationId, SocketEvent.POLL_CLOSED, {
        conversationId: poll.conversationId,
        pollId: poll.id,
        poll,
        closedBy: userId,
        systemMessage,
      });
      if (callback) callback({ success: true, poll });
    } catch (error) {
      console.error("Error handling closePoll:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handlePinPoll(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { pollId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const poll = await this.useCase.pinPoll(payload.pollId, userId);
      const systemMessage = getAttachedMessage(poll, "systemMessage");
      if (systemMessage) {
        const memberUserIds = await this.getMemberUserIds(poll.conversationId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: poll.conversationId,
            message: systemMessage,
          });
        }
      }
      this.emitToGroupRoom(poll.conversationId, SocketEvent.POLL_PINNED, {
        conversationId: poll.conversationId,
        pollId: poll.id,
        poll,
        pinnedBy: userId,
        systemMessage,
      });
      if (callback) callback({ success: true, poll });
    } catch (error) {
      console.error("Error handling pinPoll:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleUnpinPoll(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { pollId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const poll = await this.useCase.unpinPoll(payload.pollId, userId);
      const systemMessage = getAttachedMessage(poll, "systemMessage");
      if (systemMessage) {
        const memberUserIds = await this.getMemberUserIds(poll.conversationId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: poll.conversationId,
            message: systemMessage,
          });
        }
      }
      this.emitToGroupRoom(poll.conversationId, SocketEvent.POLL_UNPINNED, {
        conversationId: poll.conversationId,
        pollId: poll.id,
        poll,
        unpinnedBy: userId,
        systemMessage,
      });
      if (callback) callback({ success: true, poll });
    } catch (error) {
      console.error("Error handling unpinPoll:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleDeletePoll(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { pollId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const poll = await this.useCase.getPollResults(payload.pollId, userId);
      const conversationId = poll.conversationId;
      await this.useCase.deletePoll(payload.pollId, userId);
      this.emitToGroupRoom(conversationId, SocketEvent.POLL_DELETED, {
        conversationId,
        pollId: payload.pollId,
        deletedBy: userId,
      });
      if (callback) callback({ success: true });
    } catch (error) {
      console.error("Error handling deletePoll:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleCreateReminder(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: {
      conversationId: string;
      title: string;
      description?: string;
      remindAt: string;
      repeatRule?: any;
      notifyBeforeMinutes?: number;
    },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const reminder = await this.useCase.createGroupReminder(
        payload.conversationId,
        userId,
        payload.title,
        payload.description,
        payload.remindAt,
        payload.repeatRule,
        payload.notifyBeforeMinutes,
      );
      const message = getAttachedMessage(reminder, "timelineMessage");
      if (message) {
        const memberUserIds = await this.getMemberUserIds(payload.conversationId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: payload.conversationId,
            message,
          });
        }
      }
      this.emitToGroupRoom(payload.conversationId, SocketEvent.GROUP_REMINDER_CREATED, {
        conversationId: payload.conversationId,
        reminder,
        createdBy: userId,
        message,
      });
      if (callback) callback({ success: true, reminder });
    } catch (error) {
      console.error("Error handling createReminder:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleUpdateReminder(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: {
      reminderId: string;
      title?: string;
      description?: string | null;
      remindAt?: string;
      repeatRule?: any;
      notifyBeforeMinutes?: number;
      status?: any;
    },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const { reminderId, ...data } = payload;
      const reminder = await this.useCase.updateGroupReminder(reminderId, userId, data);
      const systemMessage = getAttachedMessage(reminder, "systemMessage");
      if (systemMessage) {
        const memberUserIds = await this.getMemberUserIds(reminder.conversationId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: reminder.conversationId,
            message: systemMessage,
          });
        }
      }
      this.emitToGroupRoom(reminder.conversationId, SocketEvent.GROUP_REMINDER_UPDATED, {
        conversationId: reminder.conversationId,
        reminder,
        updatedBy: userId,
        systemMessage,
      });
      if (callback) callback({ success: true, reminder });
    } catch (error) {
      console.error("Error handling updateReminder:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleDeleteReminder(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { reminderId: string; conversationId?: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const reminder = await this.useCase.deleteGroupReminder(payload.reminderId, userId);
      const conversationId = payload.conversationId || reminder.conversationId;
      const systemMessage = getAttachedMessage(reminder, "systemMessage");
      if (systemMessage) {
        const memberUserIds = await this.getMemberUserIds(conversationId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId,
            message: systemMessage,
          });
        }
      }
      if (conversationId) {
        this.emitToGroupRoom(conversationId, SocketEvent.GROUP_REMINDER_DELETED, {
          conversationId,
          reminderId: payload.reminderId,
          reminder,
          deletedBy: userId,
          systemMessage,
        });
      }
      if (callback) callback({ success: true });
    } catch (error) {
      console.error("Error handling deleteReminder:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handlePinReminder(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { reminderId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const reminder = await this.useCase.pinGroupReminder(payload.reminderId, userId);
      const systemMessage = getAttachedMessage(reminder, "systemMessage");
      if (systemMessage) {
        const memberUserIds = await this.getMemberUserIds(reminder.conversationId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: reminder.conversationId,
            message: systemMessage,
          });
        }
      }
      this.emitToGroupRoom(reminder.conversationId, SocketEvent.GROUP_REMINDER_PINNED, {
        conversationId: reminder.conversationId,
        reminderId: reminder.id,
        reminder,
        pinnedBy: userId,
        systemMessage,
      });
      if (callback) callback({ success: true, reminder });
    } catch (error) {
      console.error("Error handling pinReminder:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleUnpinReminder(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { reminderId: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const reminder = await this.useCase.unpinGroupReminder(payload.reminderId, userId);
      const systemMessage = getAttachedMessage(reminder, "systemMessage");
      if (systemMessage) {
        const memberUserIds = await this.getMemberUserIds(reminder.conversationId);
        for (const memberId of memberUserIds) {
          this.emitToUser(memberId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: reminder.conversationId,
            message: systemMessage,
          });
        }
      }
      this.emitToGroupRoom(reminder.conversationId, SocketEvent.GROUP_REMINDER_UNPINNED, {
        conversationId: reminder.conversationId,
        reminderId: reminder.id,
        reminder,
        unpinnedBy: userId,
        systemMessage,
      });
      if (callback) callback({ success: true, reminder });
    } catch (error) {
      console.error("Error handling unpinReminder:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleCreateNote(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { conversationId: string; title: string; content: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const note = await this.useCase.createGroupNote(payload.conversationId, userId, payload.title, payload.content);
      this.emitToGroupRoom(payload.conversationId, SocketEvent.GROUP_NOTE_CREATED, {
        conversationId: payload.conversationId,
        note,
        createdBy: userId,
      });
      if (callback) callback({ success: true, note });
    } catch (error) {
      console.error("Error handling createNote:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleUpdateNote(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { noteId: string; title?: string; content?: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const { noteId, ...data } = payload;
      const note = await this.useCase.updateGroupNote(noteId, userId, data);
      this.emitToGroupRoom(note.conversationId, SocketEvent.GROUP_NOTE_UPDATED, {
        conversationId: note.conversationId,
        note,
        updatedBy: userId,
      });
      if (callback) callback({ success: true, note });
    } catch (error) {
      console.error("Error handling updateNote:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleDeleteNote(this: SocketHandlerContext,
    socket: AuthenticatedSocket,
    payload: { noteId: string; conversationId?: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      await this.useCase.deleteGroupNote(payload.noteId, userId);
      if (payload.conversationId) {
        this.emitToGroupRoom(payload.conversationId, SocketEvent.GROUP_NOTE_DELETED, {
          conversationId: payload.conversationId,
          noteId: payload.noteId,
          deletedBy: userId,
        });
      }
      if (callback) callback({ success: true });
    } catch (error) {
      console.error("Error handling deleteNote:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },
};
