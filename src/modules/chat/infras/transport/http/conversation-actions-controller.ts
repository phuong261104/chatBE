import { Request, Response } from "express";
import { z } from "zod";
import { SocketEvent } from "../../../constants/socket-events";
import {
  archiveConversationDTOSchema,
  muteConversationDTOSchema,
  pinConversationDTOSchema,
  saveMessagesToMyDocumentDTOSchema,
} from "../../../model";
import { copyConversationSchema } from "../../../model/dto/copy-conversation-dto";
import { BaseController } from "./base-controller";

export class ConversationActionsController extends BaseController {
  async saveMessagesToMyDocumentAPI(req: Request, res: Response) {
    try {
      const { messageIds } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = saveMessagesToMyDocumentDTOSchema.parse({
        userId: currentUserId,
        messageIds,
      });

      const result = await this.useCase.saveMessagesToMyDocument(
        validatedData.userId,
        validatedData.messageIds,
      );

      for (const message of result.messages) {
        this.socketService?.emitToUser(currentUserId, SocketEvent.RECEIVE_MESSAGE, {
          message,
          conversationId: message.conversationId,
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

  async muteConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { muteUntil, duration } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = muteConversationDTOSchema.parse({
        conversationId,
        userId: currentUserId,
        muteUntil,
        duration,
      });

      await this.useCase.muteConversation(
        validatedData.conversationId,
        validatedData.userId,
        validatedData.muteUntil,
        validatedData.duration,
      );

      this.socketService?.emitToUser(currentUserId, SocketEvent.CONVERSATION_MUTE_CHANGED, {
        conversationId,
        userId: currentUserId,
        mutedBy: currentUserId,
        muteUntil: validatedData.muteUntil,
        duration: validatedData.duration,
        muted: true,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }

  async unmuteConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      await this.useCase.unmuteConversation(conversationId, currentUserId);

      this.socketService?.emitToUser(currentUserId, SocketEvent.CONVERSATION_MUTE_CHANGED, {
        conversationId,
        userId: currentUserId,
        mutedBy: currentUserId,
        muted: false,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async pinConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = pinConversationDTOSchema.parse({
        conversationId,
        userId: currentUserId,
      });

      await this.useCase.pinConversation(
        validatedData.conversationId,
        validatedData.userId,
      );

      this.socketService?.emitToUser(currentUserId, SocketEvent.CONVERSATION_PIN_TOGGLED, {
        conversationId,
        pinnedBy: currentUserId,
        pinned: true,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }

  async unpinConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = pinConversationDTOSchema.parse({
        conversationId,
        userId: currentUserId,
      });

      await this.useCase.unpinConversation(
        validatedData.conversationId,
        validatedData.userId,
      );

      this.socketService?.emitToUser(currentUserId, SocketEvent.CONVERSATION_PIN_TOGGLED, {
        conversationId,
        pinnedBy: currentUserId,
        pinned: false,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }

  async archiveConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = archiveConversationDTOSchema.parse({
        conversationId,
        userId: currentUserId,
      });

      await this.useCase.archiveConversation(
        validatedData.conversationId,
        validatedData.userId,
      );

      this.socketService?.emitToUser(currentUserId, SocketEvent.CONVERSATION_ARCHIVED_TOGGLED, {
        conversationId,
        userId: currentUserId,
        archived: true,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }

  async unarchiveConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = archiveConversationDTOSchema.parse({
        conversationId,
        userId: currentUserId,
      });

      await this.useCase.unarchiveConversation(
        validatedData.conversationId,
        validatedData.userId,
      );

      this.socketService?.emitToUser(currentUserId, SocketEvent.CONVERSATION_ARCHIVED_TOGGLED, {
        conversationId,
        userId: currentUserId,
        archived: false,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }

  async copyConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { targetUserId, memberIds, before, after } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = copyConversationSchema.parse({
        conversationId,
        requesterId: currentUserId,
        targetUserId,
        memberIds,
        before,
        after,
      });

      const result = await this.useCase.copyConversation(
        validatedData.conversationId,
        validatedData.requesterId,
        validatedData.targetUserId,
        validatedData.memberIds,
        validatedData.before,
        validatedData.after,
      );

      res.status(201).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendZodIssues(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }
}
