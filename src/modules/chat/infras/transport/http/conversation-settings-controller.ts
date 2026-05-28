import { Request, Response } from "express";
import { z } from "zod";
import { BaseController } from "./base-controller";

export class ConversationSettingsController extends BaseController {
  async setNicknameAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { targetUserId, nickname } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = z
        .object({
          conversationId: z.string(),
          currentUserId: z.string(),
          targetUserId: z.string(),
          nickname: z
            .string()
            .min(1, "Nickname cannot be empty")
            .max(50, "Nickname cannot exceed 50 characters"),
        })
        .parse({ conversationId, currentUserId, targetUserId, nickname });

      await this.useCase.setNickname(
        validatedData.conversationId,
        validatedData.currentUserId,
        validatedData.targetUserId,
        validatedData.nickname,
      );

      this.socketService?.notifyMemberNicknameChanged(
        validatedData.conversationId,
        validatedData.targetUserId,
        validatedData.nickname,
        validatedData.currentUserId,
      );

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async removeNicknameAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const targetUserId = this.parseIdParam(req, "targetUserId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      await this.useCase.removeNickname(conversationId, currentUserId, targetUserId);

      this.socketService?.notifyMemberNicknameChanged(
        conversationId,
        targetUserId,
        "",
        currentUserId,
      );

      res.status(200).json({ success: true });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async setWallpaperAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { wallpaperUrl } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = z
        .object({
          conversationId: z.string(),
          currentUserId: z.string(),
          wallpaperUrl: z.string().url("Invalid wallpaper URL").nullable(),
        })
        .parse({ conversationId, currentUserId, wallpaperUrl });

      await this.useCase.setWallpaper(
        validatedData.conversationId,
        validatedData.currentUserId,
        validatedData.wallpaperUrl,
      );

      this.socketService?.notifyMemberWallpaperChanged(
        validatedData.conversationId,
        validatedData.wallpaperUrl,
        validatedData.currentUserId,
      );

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async removeWallpaperAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      await this.useCase.removeWallpaper(conversationId, currentUserId);

      this.socketService?.notifyMemberWallpaperChanged(
        conversationId,
        null,
        currentUserId,
      );

      res.status(200).json({ success: true });
    } catch (error) {
      this.sendError(res, error);
    }
  }
}
