import { SocketEvent } from "../../../constants/socket-events";
import { AuthenticatedSocket, SocketHandlerContext } from "./types";
import {
  GetGroupInviteLinkHandler,
  RegenerateGroupInviteLinkHandler,
  RevokeGroupInviteLinkHandler,
  PreviewInviteHandler,
  InvitePreviewResult,
} from "../../../usecase/get-group-invite-link";
import {
  JoinGroupByInviteHandler,
  JoinGroupByInviteResult,
} from "../../../usecase/join-group-by-invite";
import {
  GetGroupBlocksHandler,
  BlockGroupMemberHandler,
  UnblockGroupMemberHandler,
} from "../../../usecase/group-block";

export interface GroupInviteSocketContext extends SocketHandlerContext {
  getGroupInviteLinkHandler: GetGroupInviteLinkHandler;
  regenerateGroupInviteLinkHandler: RegenerateGroupInviteLinkHandler;
  revokeGroupInviteLinkHandler: RevokeGroupInviteLinkHandler;
  previewInviteHandler: PreviewInviteHandler;
  joinGroupByInviteHandler: JoinGroupByInviteHandler;
  getGroupBlocksHandler: GetGroupBlocksHandler;
  blockGroupMemberHandler: BlockGroupMemberHandler;
  unblockGroupMemberHandler: UnblockGroupMemberHandler;
}

export const inviteBlockSocketHandlers = {
  async handleGetGroupInviteLink(this: GroupInviteSocketContext,
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
      const link = await this.getGroupInviteLinkHandler.query({ groupId, requesterId: userId });
      const baseUrl = process.env.APP_URL || "https://localhost";
      const result = {
        conversationId: link.conversationId,
        token: link.token,
        joinUrl: `${baseUrl}/invite/${link.token}`,
        qrPayload: `${baseUrl}/invite/${link.token}`,
        status: link.status,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
      };
      if (callback) callback({ success: true, inviteLink: result });
    } catch (error) {
      console.error("Error handling getGroupInviteLink:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleRegenerateGroupInviteLink(this: GroupInviteSocketContext,
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
      const newLink = await this.regenerateGroupInviteLinkHandler.execute({ groupId, requesterId: userId });
      const baseUrl = process.env.APP_URL || "https://localhost";
      const result = {
        conversationId: newLink.conversationId,
        token: newLink.token,
        joinUrl: `${baseUrl}/invite/${newLink.token}`,
        qrPayload: `${baseUrl}/invite/${newLink.token}`,
        status: newLink.status,
        createdAt: newLink.createdAt,
        expiresAt: newLink.expiresAt,
      };
      this.emitToGroupRoom(groupId, SocketEvent.GROUP_INVITE_LINK_UPDATED, {
        conversationId: groupId,
        inviteLink: result,
      });
      if (callback) callback({ success: true, inviteLink: result });
    } catch (error) {
      console.error("Error handling regenerateGroupInviteLink:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleRevokeGroupInviteLink(this: GroupInviteSocketContext,
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
      await this.revokeGroupInviteLinkHandler.execute({ groupId, requesterId: userId });
      this.emitToGroupRoom(groupId, SocketEvent.GROUP_INVITE_LINK_REVOKED, {
        conversationId: groupId,
      });
      if (callback) callback({ success: true });
    } catch (error) {
      console.error("Error handling revokeGroupInviteLink:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleJoinGroupByInvite(this: GroupInviteSocketContext,
    socket: AuthenticatedSocket,
    payload: { token: string },
    callback?: (response: any) => void,
  ) {
    try {
      const userId = socket.userId;
      if (!userId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }
      const { token } = payload;
      if (!token) {
        if (callback) callback({ success: false, error: "token is required" });
        return;
      }
      const result = await this.joinGroupByInviteHandler.execute({ token, requesterId: userId });
      if (!result.isPending) {
        this.emitToGroupRoom(result.conversationId, SocketEvent.GROUP_MEMBER_JOINED, {
          conversationId: result.conversationId,
          userId,
          member: result.member,
        });
        if (result.systemMessage) {
          this.emitToGroupRoom(result.conversationId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: result.conversationId,
            message: result.systemMessage,
          });
        }
      } else {
        this.emitToGroupRoom(result.conversationId, SocketEvent.GROUP_MEMBER_REQUESTED, {
          conversationId: result.conversationId,
          userId,
          member: result.member,
        });
      }
      if (callback) callback({ success: true, ...result });
    } catch (error) {
      console.error("Error handling joinGroupByInvite:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleBlockGroupMember(this: GroupInviteSocketContext,
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
      const result = await this.blockGroupMemberHandler.execute({ groupId, requesterId: userId, targetUserId });
      this.emitToGroupRoom(groupId, SocketEvent.GROUP_MEMBER_BLOCKED, {
        conversationId: groupId,
        blockedUserId: targetUserId,
        blockedBy: userId,
      });
      if (result.systemMessage) {
        this.emitToGroupRoom(groupId, SocketEvent.RECEIVE_MESSAGE, {
          conversationId: groupId,
          message: result.systemMessage,
        });
      }
      if (callback) callback({ success: true, block: result.block });
    } catch (error) {
      console.error("Error handling blockGroupMember:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },

  async handleUnblockGroupMember(this: GroupInviteSocketContext,
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
      await this.unblockGroupMemberHandler.execute({ groupId, requesterId: userId, targetUserId });
      this.emitToGroupRoom(groupId, SocketEvent.GROUP_MEMBER_UNBLOCKED, {
        conversationId: groupId,
        unblockedUserId: targetUserId,
        unblockedBy: userId,
      });
      if (callback) callback({ success: true });
    } catch (error) {
      console.error("Error handling unblockGroupMember:", error);
      if (callback) callback({ success: false, error: (error as Error).message });
    }
  },
};
