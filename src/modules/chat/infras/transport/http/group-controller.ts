import { Request, Response } from "express";
import { BaseController } from "./base-controller";
import {
  createGroupDTOSchema,
  updateGroupInfoDTOSchema,
  leaveGroupDTOSchema,
  archiveConversationDTOSchema,
} from "../../../model/dto";
import { z } from "zod";

export class GroupController extends BaseController {
  async createGroupAPI(req: Request, res: Response) {
    try {
      const { name, memberIds, avatarUrl } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = createGroupDTOSchema.parse({
        name,
        memberIds,
        avatarUrl,
      });

      const result = await this.useCase.createGroup(
        currentUserId,
        validatedData,
      );

      if (this.socketService) {
        const allMemberIds = [currentUserId, ...memberIds];
        this.socketService.notifyNewGroup(allMemberIds, {
          conversation: result.conversation,
          systemMessage: result.systemMessage,
        });
      }

      res.status(201).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async updateGroupAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const { name, avatarUrl } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = updateGroupInfoDTOSchema.parse({
        conversationId: groupId,
        requesterId: currentUserId,
        name,
        avatarUrl,
      });

      const updatedConversation = await this.useCase.updateGroupInfo(
        validatedData.conversationId,
        validatedData.requesterId,
        {
          name: validatedData.name,
          avatarUrl: validatedData.avatarUrl,
        },
      );

      if (this.socketService) {
        this.socketService.notifyGroupUpdated(groupId, updatedConversation);
      }

      res.status(200).json({ data: updatedConversation });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async leaveGroupAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = leaveGroupDTOSchema.parse({
        conversationId: groupId,
        userId: currentUserId,
      });

      await this.useCase.leaveGroup(
        validatedData.conversationId,
        validatedData.userId,
      );

      if (this.socketService) {
        this.socketService.notifyMemberRemoved(groupId, currentUserId);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async getGroupInfoAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const groupInfo = await this.useCase.getGroupInfo(groupId, currentUserId);
      res.status(200).json({ data: groupInfo });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async updateGroupSettingsAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const { allowSendLink, requireApproval, allowMemberInvite } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const updatedConversation = await this.useCase.updateGroupSettings(
        groupId,
        currentUserId,
        { allowSendLink, requireApproval, allowMemberInvite },
      );

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, "group:settings_updated", {
          conversationId: groupId,
          settings: updatedConversation.settings,
        });
      }

      res.status(200).json({ data: updatedConversation });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async setAdminAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const { targetUserId, isAdmin } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const updatedConversation = await this.useCase.setAdmin(groupId, currentUserId, targetUserId, isAdmin);

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, "group:admin_changed", {
          conversationId: groupId,
          targetUserId,
          isAdmin,
          changedBy: currentUserId,
        });
      }

      res.status(200).json({ data: updatedConversation });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async transferOwnerAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const { newOwnerId } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const updatedConversation = await this.useCase.transferOwner(groupId, currentUserId, newOwnerId);

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, "group:owner_transferred", {
          conversationId: groupId,
          oldOwnerId: currentUserId,
          newOwnerId,
        });
      }

      res.status(200).json({ data: updatedConversation });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async getPendingMembersAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const pendingMembers = await this.useCase.getPendingMembers(groupId);
      res.status(200).json({ data: pendingMembers });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async approveMemberAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const userId = this.parseIdParam(req, "userId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const approvedMember = await this.useCase.approveMember(groupId, userId, currentUserId);

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, "group:member_approved", {
          conversationId: groupId,
          userId,
          member: approvedMember,
        });
        this.socketService.emitToUser(userId, "group:member_approved", {
          conversationId: groupId,
          userId,
          member: approvedMember,
        });
      }

      res.status(200).json({ data: approvedMember });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async rejectMemberAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const userId = this.parseIdParam(req, "userId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      await this.useCase.rejectMember(groupId, userId, currentUserId);

      if (this.socketService) {
        this.socketService.emitToUser(userId, "group:member_rejected", {
          conversationId: groupId,
          userId,
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      this.sendError(res, error);
    }
  }
}
