import { Request, Response } from "express";
import { BaseController } from "./base-controller";
import {
  sendMessageDTOSchema,
  revokeMessageDTOSchema,
  deleteMessageForMeDTOSchema,
  deleteMessageForEveryoneDTOSchema,
  forwardMessagesDTOSchema,
  editMessageDTOSchema,
  pinMessageDTOSchema,
  unpinMessageDTOSchema,
  getPinnedMessagesDTOSchema,
  quoteMessageDTOSchema,
} from "../../../model/dto";
import { ConversationType } from "../../../model";
import { z } from "zod";

export class MessageController extends BaseController {
  async sendMessageAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { text, media } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = sendMessageDTOSchema.parse({
        conversationId,
        senderId: currentUserId,
        text,
        media,
      });

      const conversationDetail = await this.useCase.getConversationDetail(
        validatedData.conversationId,
        validatedData.senderId,
      );

      const isGroup =
        conversationDetail.conversation.type === ConversationType.GROUP;

      const message = isGroup
        ? await this.useCase.sendGroupMessage(
            validatedData.conversationId,
            validatedData.senderId,
            validatedData.text,
            validatedData.media,
          )
        : await this.useCase.sendMessage(
            validatedData.conversationId,
            validatedData.senderId,
            validatedData.text,
            validatedData.media,
          );

      if (this.socketService) {
        if (isGroup) {
          this.socketService.emitToGroupRoom(
            validatedData.conversationId,
            "receiveMessage",
            {
              message,
              conversationId: validatedData.conversationId,
            },
          );
        }
        const memberUserIds = await this.useCase.getConversationMembers(
          validatedData.conversationId,
          validatedData.senderId,
        );

        for (const userId of memberUserIds) {
          this.socketService.emitToUser(userId, "receiveMessage", {
            message,
            conversationId: validatedData.conversationId,
          });
        }
      }

      res.status(201).json({ data: message });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async revokeMessageAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = revokeMessageDTOSchema.parse({
        messageId,
        userId: currentUserId,
      });

      const message = await this.useCase.revokeMessage(
        validatedData.messageId,
        validatedData.userId,
      );

      if (this.socketService) {
        const memberUserIds = await this.useCase.getConversationMembers(
          message.conversationId,
        );

        for (const memberId of memberUserIds) {
          this.socketService.emitToUser(memberId, "message:revoked", {
            conversationId: message.conversationId,
            message,
          });
        }
      }

      res.status(200).json({ data: message });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async deleteMessageForMeAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = deleteMessageForMeDTOSchema.parse({
        messageId,
        userId: currentUserId,
      });

      await this.useCase.deleteMessageForMe(
        validatedData.messageId,
        validatedData.userId,
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

  async deleteMessageForEveryoneAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = deleteMessageForEveryoneDTOSchema.parse({
        messageId,
        userId: currentUserId,
      });

      const message = await this.useCase.deleteMessageForEveryone(
        validatedData.messageId,
        validatedData.userId,
      );

      if (this.socketService) {
        const memberUserIds = await this.useCase.getConversationMembers(
          message.conversationId,
        );

        for (const memberId of memberUserIds) {
          this.socketService.emitToUser(memberId, "message:deleted_for_everyone", {
            conversationId: message.conversationId,
            messageId: validatedData.messageId,
            deletedBy: currentUserId,
          });
        }
      }

      res.status(200).json({ data: message });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async forwardMessagesAPI(req: Request, res: Response) {
    try {
      const { messageIds, targetConversationIds } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = forwardMessagesDTOSchema.parse({
        userId: currentUserId,
        messageIds,
        targetConversationIds,
      });

      const forwardedMessages = await this.useCase.forwardMessages(
        validatedData.userId,
        validatedData.messageIds,
        validatedData.targetConversationIds,
      );

      if (this.socketService) {
        for (const message of forwardedMessages) {
          const memberUserIds = await this.useCase.getConversationMembers(
            message.conversationId,
            validatedData.userId,
          );

          for (const userId of memberUserIds) {
            this.socketService.emitToUser(userId, "receiveMessage", {
              message,
              conversationId: message.conversationId,
            });
          }
        }
      }

      res.status(201).json({ data: forwardedMessages });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async editMessageAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const { text } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = editMessageDTOSchema.parse({
        messageId,
        userId: currentUserId,
        text,
      });

      const message = await this.useCase.editMessage(
        validatedData.messageId,
        validatedData.userId,
        validatedData.text,
      );

      if (this.socketService) {
        const memberUserIds = await this.useCase.getConversationMembers(
          message.conversationId,
        );

        for (const memberId of memberUserIds) {
          this.socketService.emitToUser(memberId, "message:edited", {
            conversationId: message.conversationId,
            message,
          });
        }
      }

      res.status(200).json({ data: message });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async pinMessageAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = pinMessageDTOSchema.parse({
        messageId,
        userId: currentUserId,
      });

      const message = await this.useCase.pinMessage(
        validatedData.messageId,
        validatedData.userId,
      );

      if (this.socketService) {
        const memberUserIds = await this.useCase.getConversationMembers(
          message.conversationId,
        );

        for (const memberId of memberUserIds) {
          this.socketService.emitToUser(memberId, "message:pinned", {
            conversationId: message.conversationId,
            message,
          });
        }
      }

      res.status(200).json({ data: message });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async unpinMessageAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = unpinMessageDTOSchema.parse({
        messageId,
        userId: currentUserId,
      });

      const message = await this.useCase.unpinMessage(
        validatedData.messageId,
        validatedData.userId,
      );

      if (this.socketService) {
        const memberUserIds = await this.useCase.getConversationMembers(
          message.conversationId,
        );

        for (const memberId of memberUserIds) {
          this.socketService.emitToUser(memberId, "message:unpinned", {
            conversationId: message.conversationId,
            message,
          });
        }
      }

      res.status(200).json({ data: message });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async getPinnedMessagesAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = getPinnedMessagesDTOSchema.parse({
        conversationId,
        userId: currentUserId,
      });

      const messages = await this.useCase.getPinnedMessages(
        validatedData.conversationId,
        validatedData.userId,
      );

      res.status(200).json({ data: messages });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async quoteMessageAPI(req: Request, res: Response) {
    try {
      const messageId = this.parseIdParam(req, "messageId");
      const { text, media } = req.body;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const message = await (this.useCase as any).messageQueryRepo?.get(messageId);
      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      const validatedData = quoteMessageDTOSchema.parse({
        conversationId: message.conversationId,
        senderId: currentUserId,
        text,
        media,
        quotedMessageId: messageId,
      });

      const quotedMessage = await this.useCase.quoteMessage(
        validatedData.conversationId,
        validatedData.senderId,
        validatedData.text,
        validatedData.media,
        validatedData.quotedMessageId,
      );

      if (this.socketService) {
        const isGroup = message.type === "group";
        if (isGroup) {
          this.socketService.emitToGroupRoom(
            validatedData.conversationId,
            "receiveMessage",
            { message: quotedMessage, conversationId: validatedData.conversationId },
          );
        }
        const memberUserIds = await this.useCase.getConversationMembers(
          validatedData.conversationId,
          validatedData.senderId,
        );
        for (const userId of memberUserIds) {
          this.socketService.emitToUser(userId, "receiveMessage", {
            message: quotedMessage,
            conversationId: validatedData.conversationId,
          });
        }
      }

      res.status(201).json({ data: quotedMessage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }
}
