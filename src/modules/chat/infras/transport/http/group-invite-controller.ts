import { Request, Response } from "express";
import { BaseController } from "./base-controller";
import { SocketEvent } from "../../../constants/socket-events";
import {
  GetGroupInviteLinkHandler,
  RegenerateGroupInviteLinkHandler,
  RevokeGroupInviteLinkHandler,
  PreviewInviteHandler,
} from "../../../usecase/get-group-invite-link";
import {
  JoinGroupByInviteHandler,
} from "../../../usecase/join-group-by-invite";

export class GroupInviteController extends BaseController {
  constructor(
    private readonly getGroupInviteLinkHandler: GetGroupInviteLinkHandler,
    private readonly regenerateGroupInviteLinkHandler: RegenerateGroupInviteLinkHandler,
    private readonly revokeGroupInviteLinkHandler: RevokeGroupInviteLinkHandler,
    private readonly previewInviteHandler: PreviewInviteHandler,
    private readonly joinGroupByInviteHandler: JoinGroupByInviteHandler,
  ) {
    super(undefined as any);
  }

  async getGroupInviteLinkAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const link = await this.getGroupInviteLinkHandler.query({
        groupId,
        requesterId: currentUserId,
      });

      const baseUrl = process.env.APP_URL || `https://${req.headers.host || "localhost"}`;
      const result = {
        conversationId: link.conversationId,
        token: link.token,
        joinUrl: `${baseUrl}/invite/${link.token}`,
        qrPayload: `${baseUrl}/invite/${link.token}`,
        status: link.status,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
      };

      res.status(200).json({ data: result });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async regenerateGroupInviteLinkAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const newLink = await this.regenerateGroupInviteLinkHandler.execute({
        groupId,
        requesterId: currentUserId,
      });

      const baseUrl = process.env.APP_URL || `https://${req.headers.host || "localhost"}`;
      const result = {
        conversationId: newLink.conversationId,
        token: newLink.token,
        joinUrl: `${baseUrl}/invite/${newLink.token}`,
        qrPayload: `${baseUrl}/invite/${newLink.token}`,
        status: newLink.status,
        createdAt: newLink.createdAt,
        expiresAt: newLink.expiresAt,
      };

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, SocketEvent.GROUP_INVITE_LINK_UPDATED, {
          conversationId: groupId,
          inviteLink: result,
        });
      }

      res.status(200).json({ data: result });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async revokeGroupInviteLinkAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      await this.revokeGroupInviteLinkHandler.execute({
        groupId,
        requesterId: currentUserId,
      });

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, SocketEvent.GROUP_INVITE_LINK_REVOKED, {
          conversationId: groupId,
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async previewInviteAPI(req: Request, res: Response) {
    try {
      const token = this.parseIdParam(req, "token");
      const currentUserId = this.getCurrentUserId(req, res);

      const preview = await this.previewInviteHandler.query({
        token,
        requesterId: currentUserId ?? undefined,
      });

      res.status(200).json({ data: preview });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async joinGroupByInviteAPI(req: Request, res: Response) {
    try {
      const token = this.parseIdParam(req, "token");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const result = await this.joinGroupByInviteHandler.execute({
        token,
        requesterId: currentUserId,
      });

      if (!result.isPending && this.socketService) {
        this.socketService.emitToGroupRoom(result.conversationId, SocketEvent.GROUP_MEMBER_JOINED, {
          conversationId: result.conversationId,
          userId: currentUserId,
          member: result.member,
        });
        if (result.systemMessage) {
          this.socketService.emitToGroupRoom(result.conversationId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: result.conversationId,
            message: result.systemMessage,
          });
        }
      }

      if (result.isPending && this.socketService) {
        this.socketService.emitToGroupRoom(result.conversationId, SocketEvent.GROUP_MEMBER_REQUESTED, {
          conversationId: result.conversationId,
          userId: currentUserId,
          member: result.member,
        });
      }

      res.status(200).json({ data: result });
    } catch (error) {
      this.sendError(res, error);
    }
  }
}
