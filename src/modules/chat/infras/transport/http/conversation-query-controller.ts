import { Request, Response } from "express";
import { z } from "zod";
import { getConversationStatisticsSchema } from "../../../model/dto/conversation-statistics-dto";
import { getDraftsSchema } from "../../../model/dto/draft-dto";
import { GetConversationMediaQuerySchema } from "../../../model/dto/media-group-dto";
import { getSharedConversationsSchema } from "../../../model/dto/shared-conversations-dto";
import { BaseController } from "./base-controller";

export class ConversationQueryController extends BaseController {
  async getConversationMediaAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { cursor, limit = "20", type = "all", query } = req.query;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = GetConversationMediaQuerySchema.parse({
        conversationId,
        userId: currentUserId,
        cursor: cursor || undefined,
        limit: parseInt(limit as string, 10),
        type,
        query: typeof query === "string" ? query : undefined,
      });

      const result = await this.useCase.getConversationMedia(
        validatedData.conversationId,
        validatedData.userId,
        validatedData.cursor,
        validatedData.limit,
        validatedData.type,
        validatedData.query,
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

  async getConversationStatisticsAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = getConversationStatisticsSchema.parse({
        conversationId,
        userId: currentUserId,
      });

      const stats = await this.useCase.getConversationStatistics(
        validatedData.conversationId,
        validatedData.userId,
      );

      res.status(200).json({ data: stats });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendZodIssues(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }

  async getSharedConversationsAPI(req: Request, res: Response) {
    try {
      const userId = this.parseIdParam(req, "userId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = getSharedConversationsSchema.parse({
        userId,
        currentUserId,
      });

      const conversations = await this.useCase.getSharedConversations(
        validatedData.userId,
        validatedData.currentUserId,
      );

      res.status(200).json({ data: conversations });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendZodIssues(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }

  async getConversationOnlineMembersAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const members = await this.useCase.getConversationOnlineMembers(
        conversationId,
        currentUserId,
      );

      res.status(200).json({ data: members });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async getDraftsAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = getDraftsSchema.parse({
        conversationId,
        userId: currentUserId,
      });

      const drafts = await this.useCase.getDrafts(
        validatedData.conversationId,
        validatedData.userId,
      );

      res.status(200).json({ data: drafts });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendZodIssues(res, error);
        return;
      }

      this.sendError(res, error);
    }
  }
}
