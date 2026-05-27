import { Request, Response } from "express";
import { BaseController } from "./base-controller";
import { SocketEvent } from "../../../constants/socket-events";
import { z } from "zod";
import {
  GetGroupBlocksHandler,
  BlockGroupMemberHandler,
  UnblockGroupMemberHandler,
  GroupBlockWithUser,
} from "../../../usecase/group-block";
import { blockGroupMemberDTOSchema } from "../../../model/dto";

export class GroupBlockController extends BaseController {
  constructor(
    private readonly getGroupBlocksHandler: GetGroupBlocksHandler,
    private readonly blockGroupMemberHandler: BlockGroupMemberHandler,
    private readonly unblockGroupMemberHandler: UnblockGroupMemberHandler,
  ) {
    super(undefined as any);
  }

  async getGroupBlocksAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const blocks = await this.getGroupBlocksHandler.query({
        groupId,
        requesterId: currentUserId,
      });

      res.status(200).json({ data: blocks });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async blockGroupMemberAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validated = blockGroupMemberDTOSchema.parse(req.body);

      const block = await this.blockGroupMemberHandler.execute({
        groupId,
        requesterId: currentUserId,
        targetUserId: validated.targetUserId,
      });

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, SocketEvent.GROUP_MEMBER_BLOCKED, {
          conversationId: groupId,
          blockedUserId: validated.targetUserId,
          blockedBy: currentUserId,
        });
        if (block.systemMessage) {
          this.socketService.emitToGroupRoom(groupId, SocketEvent.RECEIVE_MESSAGE, {
            conversationId: groupId,
            message: block.systemMessage,
          });
        }
      }

      res.status(200).json({ data: block.block });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async unblockGroupMemberAPI(req: Request, res: Response) {
    try {
      const groupId = this.parseIdParam(req, "groupId");
      const targetUserId = this.parseIdParam(req, "userId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      await this.unblockGroupMemberHandler.execute({
        groupId,
        requesterId: currentUserId,
        targetUserId,
      });

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, SocketEvent.GROUP_MEMBER_UNBLOCKED, {
          conversationId: groupId,
          unblockedUserId: targetUserId,
          unblockedBy: currentUserId,
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      this.sendError(res, error);
    }
  }
}
