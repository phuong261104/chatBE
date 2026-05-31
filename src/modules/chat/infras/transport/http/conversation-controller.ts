import { Request, Response } from "express";
import { BaseController } from "./base-controller";
import {
  getOrCreatePrivateConversationDTOSchema,
  loadMessagesDTOSchema,
  markAsSeenDTOSchema,
  markAsDeliveredDTOSchema,
} from "../../../model/dto";
import { z } from "zod";
import { normalizeConversationListItem } from "../../../usecase/conversation-listing";

export class ConversationController extends BaseController {
  async getPrivateConversationAPI(req: Request, res: Response) {
    try {
      const { targetUserId } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = getOrCreatePrivateConversationDTOSchema.parse({
        currentUserId,
        targetUserId,
      });

      const conversation = await this.useCase.getOrCreatePrivateConversation(
        validatedData.currentUserId,
        validatedData.targetUserId,
      );

      res.status(200).json({
        data: normalizeConversationListItem(conversation, validatedData.currentUserId),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async getConversationsAPI(req: Request, res: Response) {
    try {
      const { page = "1", limit = "20" } = req.query;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);

      const conversations = await this.useCase.getConversations(
        currentUserId,
        pageNum,
        limitNum,
      );

      res.status(200).json({ data: conversations });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async getConversationsCursorAPI(req: Request, res: Response) {
    try {
      const { cursor, limit = "20" } = req.query;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const limitNum = Math.min(parseInt(limit as string, 10), 100);

      const result = await this.useCase.getConversationsCursor(
        currentUserId,
        cursor as string | undefined,
        limitNum,
      );

      res.status(200).json({
        status: "success",
        msg: "OK",
        pinned: result.pinned,
        data: result.data,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async getConversationDetailAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const result = await this.useCase.getConversationDetail(
        conversationId,
        currentUserId,
      );

      res.status(200).json({ data: result });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async loadMessagesAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { cursor, limit = "20" } = req.query;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = loadMessagesDTOSchema.parse({
        conversationId,
        userId: currentUserId,
        cursor: cursor || undefined,
        limit: parseInt(limit as string, 10),
      });

      const result = await this.useCase.loadMessages(
        validatedData.conversationId,
        currentUserId,
        validatedData.cursor,
        validatedData.limit,
      );

      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async markAsSeenAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { lastSeenMessageId } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = markAsSeenDTOSchema.parse({
        conversationId,
        userId: currentUserId,
        lastSeenMessageId,
      });

      const result = await this.useCase.markAsSeen(
        validatedData.conversationId,
        validatedData.userId,
        validatedData.lastSeenMessageId,
      );

      if (this.socketService && result.changed) {
        const memberUserIds = await this.useCase.getConversationMembers(
          validatedData.conversationId,
        );
        const statePayload = this.toReadStatePayload(result.state);

        for (const memberId of memberUserIds) {
          this.socketService.notifyMessageSeen(
            memberId,
            validatedData.conversationId,
            validatedData.userId,
            validatedData.lastSeenMessageId,
            statePayload,
          );
        }
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async markAsDeliveredAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { lastDeliveredMessageId } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = markAsDeliveredDTOSchema.parse({
        conversationId,
        userId: currentUserId,
        lastDeliveredMessageId,
      });

      const result = await this.useCase.markAsDelivered(
        validatedData.conversationId,
        validatedData.userId,
        validatedData.lastDeliveredMessageId,
      );

      if (this.socketService && result.changed) {
        const memberUserIds = await this.useCase.getConversationMembers(
          validatedData.conversationId,
        );
        const statePayload = this.toReadStatePayload(result.state);

        for (const memberId of memberUserIds) {
          this.socketService.notifyMessageDelivered(
            memberId,
            validatedData.conversationId,
            validatedData.userId,
            validatedData.lastDeliveredMessageId,
            statePayload,
          );
        }
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async getTotalUnreadCountAPI(req: Request, res: Response) {
    try {
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const totalUnread = await this.useCase.getTotalUnreadCount(currentUserId);
      res.status(200).json({ totalUnread });
    } catch (error) {
      this.sendError(res, error);
    }
  }
}
