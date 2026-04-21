import { Request, Response } from "express";
import { BaseController } from "./base-controller";
import { SocketEvent } from "../../../constants/socket-events";
import {
  addReactionDTOSchema,
  removeReactionDTOSchema,
  removeAllReactionsDTOSchema,
  getReactionsDTOSchema,
} from "../../../model/dto";
import { z } from "zod";

export class ReactionController extends BaseController {
  async addReactionAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const { emoji } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = addReactionDTOSchema.parse({
        messageId,
        userId: currentUserId,
        emoji,
      });

      const reaction = await this.useCase.addReaction(
        validatedData.messageId,
        validatedData.userId,
        validatedData.emoji,
      );

      if (this.socketService) {
        const message = await (this.useCase as any).messageQueryRepo?.get(validatedData.messageId);
        if (message) {
          const memberUserIds = await this.useCase.getConversationMembers(
            message.conversationId,
          );
          for (const memberId of memberUserIds) {
            this.socketService.emitToUser(memberId, SocketEvent.MESSAGE_REACTION, {
              messageId: validatedData.messageId,
              reaction,
            });
          }
        }
      }

      res.status(201).json({ data: reaction });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async removeReactionAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const { emoji } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = removeReactionDTOSchema.parse({
        messageId,
        userId: currentUserId,
      });

      const deletedCount = await this.useCase.removeReaction(
        validatedData.messageId,
        validatedData.userId,
        emoji,
      );

      if (this.socketService) {
        const message = await (this.useCase as any).messageQueryRepo?.get(validatedData.messageId);
        if (message) {
          const memberUserIds = await this.useCase.getConversationMembers(
            message.conversationId,
          );
          for (const memberId of memberUserIds) {
            this.socketService.emitToUser(memberId, SocketEvent.MESSAGE_REACTION_REMOVE, {
              messageId: validatedData.messageId,
              userId: currentUserId,
              emoji,
            });
          }
        }
      }

      res.status(200).json({ success: true, deletedCount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async removeAllReactionsAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = removeAllReactionsDTOSchema.parse({
        messageId,
        userId: currentUserId,
      });

      const deletedCount = await this.useCase.removeAllReactions(
        validatedData.messageId,
        validatedData.userId,
      );

      if (this.socketService) {
        const message = await (this.useCase as any).messageQueryRepo?.get(validatedData.messageId);
        if (message) {
          const memberUserIds = await this.useCase.getConversationMembers(
            message.conversationId,
          );
          for (const memberId of memberUserIds) {
            this.socketService.emitToUser(memberId, SocketEvent.MESSAGE_REACTIONS_CLEAR, {
              messageId: validatedData.messageId,
              userId: currentUserId,
            });
          }
        }
      }

      res.status(200).json({ success: true, deletedCount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async getReactionsAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");

      const validatedData = getReactionsDTOSchema.parse({ messageId });

      const result = await this.useCase.getReactions(validatedData.messageId);

      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }
}
