import { Request, Response } from "express";
import { BaseController } from "./base-controller";
import {
  createGroupDTOSchema,
  updateGroupInfoDTOSchema,
  leaveGroupDTOSchema,
  archiveConversationDTOSchema,
} from "../../../model/dto";
import { SocketEvent } from "../../../constants/socket-events";
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
        const memberUserIds = await this.useCase.getConversationMembers(
          groupId,
          currentUserId,
        );
        for (const userId of memberUserIds) {
          if (validatedData.name) {
            this.socketService.emitToUser(userId, SocketEvent.GROUP_RENAMED, {
              conversationId: groupId,
              newName: validatedData.name,
              renamedBy: currentUserId,
            });
          }
          if (validatedData.avatarUrl) {
            this.socketService.emitToUser(userId, SocketEvent.GROUP_AVATAR_CHANGED, {
              conversationId: groupId,
              avatarUrl: validatedData.avatarUrl,
              changedBy: currentUserId,
            });
          }
        }
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
      const { newOwnerId } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      await this.useCase.leaveGroup(
        groupId,
        currentUserId,
        true,
        newOwnerId,
      );

      if (this.socketService) {
        this.socketService.notifyMemberLeft(groupId, currentUserId, currentUserId);
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
      const {
        allowSendLink,
        requireApproval,
        allowMemberInvite,
        whoCanSendMessages,
        whoCanAddMembers,
        whoCanUpdateGroupInfo,
        whoCanPinMessages,
        newMemberCanViewHistory,
        utilityPermissions,
      } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const updatedConversation = await this.useCase.updateGroupSettings(
        groupId,
        currentUserId,
        {
          allowSendLink,
          requireApproval,
          allowMemberInvite,
          whoCanSendMessages,
          whoCanAddMembers,
          whoCanUpdateGroupInfo,
          whoCanPinMessages,
          newMemberCanViewHistory,
          utilityPermissions,
        },
      );

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, SocketEvent.GROUP_SETTINGS_UPDATED, {
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
        this.socketService.emitToGroupRoom(groupId, SocketEvent.GROUP_ADMIN_CHANGED, {
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
        this.socketService.emitToGroupRoom(groupId, SocketEvent.GROUP_OWNER_TRANSFERRED, {
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

      const pendingMembers = await this.useCase.getPendingMembers(groupId, currentUserId);
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
        this.socketService.emitToGroupRoom(groupId, SocketEvent.GROUP_MEMBER_APPROVED, {
          conversationId: groupId,
          userId,
          member: approvedMember,
        });
        this.socketService.emitToUser(userId, SocketEvent.GROUP_MEMBER_APPROVED, {
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
        this.socketService.emitToUser(userId, SocketEvent.GROUP_MEMBER_REJECTED, {
          conversationId: groupId,
          userId,
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async dissolveGroupAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const memberUserIds = await this.useCase.dissolveGroup(
        groupId,
        currentUserId,
      );

      if (this.socketService) {
        for (const userId of memberUserIds) {
          this.socketService.emitToUser(userId, SocketEvent.GROUP_DISSOLVED, {
            conversationId: groupId,
            dissolvedBy: currentUserId,
          });
        }
      }

      res.status(200).json({
        success: true,
        message: "Group dissolved successfully",
      });
    } catch (error) {
      this.sendError(res, error);
    }
  }
}
