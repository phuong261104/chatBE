import { SocketEvent } from "../../../constants/socket-events";
import { AuthenticatedSocket, SocketHandlerContext } from "./types";

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

      this.emitToGroupRoom(groupId, SocketEvent.CONVERSATION_MEMBERS_ADDED, {
        conversationId: groupId,
        newMembers,
        addedBy: userId,
      });

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

      this.emitToGroupRoom(groupId, SocketEvent.CONVERSATION_MEMBER_REMOVED, {
        conversationId: groupId,
        removedUserId: targetUserId,
        removedBy: userId,
      });

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

      const { conversationId, question, options, isMultipleChoice, allowAddOption, expiresAt } = payload;

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
        expiresAt,
      );

      this.emitToGroupRoom(conversationId, SocketEvent.POLL_NEW, {
        conversationId,
        poll,
        createdBy: userId,
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

      // Get conversationId from poll for room emission
      const conversationId = (poll as any).conversationId;
      if (conversationId) {
        this.emitToGroupRoom(conversationId, SocketEvent.POLL_VOTE, {
          conversationId,
          pollId,
          poll,
          votedBy: userId,
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
};
