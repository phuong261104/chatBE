import { Request, Response } from "express";
import { z } from "zod";
import { deleteMessagesBulkSchema } from "../../../model/dto/delete-messages-bulk-dto";
import { translateMessageSchema } from "../../../model/dto/translate-message-dto";
import { BaseController } from "./base-controller";

export class MessageToolsController extends BaseController {
  async deleteMessagesBulkAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { before, after, messageIds } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = deleteMessagesBulkSchema.parse({
        conversationId,
        userId: currentUserId,
        before,
        after,
        messageIds,
      });

      const result = await this.useCase.deleteMessagesBulk(
        validatedData.conversationId,
        validatedData.userId,
        validatedData.before,
        validatedData.after,
        validatedData.messageIds,
      );

      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendZodIssues(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }

  async translateMessageAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const { targetLanguage } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = translateMessageSchema.parse({
        messageId,
        userId: currentUserId,
        targetLanguage,
      });

      const result = await this.useCase.translateMessage(
        validatedData.messageId,
        validatedData.userId,
        validatedData.targetLanguage,
      );

      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendZodIssues(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }
}
