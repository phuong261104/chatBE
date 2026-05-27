import { Request, Response } from "express";
import { BaseController } from "./base-controller";
import {
  addMembersToGroupDTOSchema,
  removeMemberFromGroupDTOSchema,
  getGroupMembersDTOSchema,
} from "../../../model/dto";
import { z } from "zod";

export class MemberController extends BaseController {
  async addMembersAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const { memberIds } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = addMembersToGroupDTOSchema.parse({
        conversationId: groupId,
        requesterId: currentUserId,
        memberIds,
      });

      const newMembers = await this.useCase.addMembersToGroup(
        validatedData.conversationId,
        validatedData.requesterId,
        validatedData.memberIds,
      );

      if (this.socketService) {
        this.socketService.notifyMembersAdded(groupId, newMembers);
      }

      res.status(200).json({ data: newMembers });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async removeMemberAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const userId = this.parseIdParam(req, "userId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const block = req.query.block === "true";

      const validatedData = removeMemberFromGroupDTOSchema.parse({
        conversationId: groupId,
        requesterId: currentUserId,
        targetUserId: userId,
        block,
      });

      await this.useCase.removeMemberFromGroup(
        validatedData.conversationId,
        validatedData.requesterId,
        validatedData.targetUserId,
        validatedData.block,
      );

      if (this.socketService) {
        this.socketService.notifyMemberRemoved(groupId, userId);
      }

      res.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async getGroupMembersAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = getGroupMembersDTOSchema.parse({
        conversationId: groupId,
        userId: currentUserId,
      });

      const members = await this.useCase.getGroupMembers(
        validatedData.conversationId,
        validatedData.userId,
      );

      res.status(200).json({ data: members });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }
}
