import { Request, Response } from "express";
import { BaseController } from "./base-controller";
import { SocketEvent } from "../../../constants/socket-events";
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
} from "../../../model";
import { searchMessagesDTOSchema } from "../../../model/dto/search-dto";
import { ConversationType } from "../../../model";
import { z } from "zod";
import { parseSearchDate, parseSearchEndDate } from "@modules/search/model";

export class MessageController extends BaseController {
  async sendMessageAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { text, media, clientMessageId } = req.body;
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
        clientMessageId,
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
            undefined,
            validatedData.clientMessageId,
          )
        : await this.useCase.sendMessage(
            validatedData.conversationId,
            validatedData.senderId,
            validatedData.text,
            validatedData.media,
            undefined,
            validatedData.clientMessageId,
          );

      if (this.socketService) {
        const memberUserIds = await this.useCase.getConversationMembers(
          validatedData.conversationId,
        );

        for (const msg of message) {
          for (const userId of memberUserIds) {
            this.socketService.emitToUser(userId, SocketEvent.RECEIVE_MESSAGE, {
              message: msg,
              conversationId: validatedData.conversationId,
            });
          }
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
          validatedData.userId,
        );

        for (const memberId of memberUserIds) {
          this.socketService.emitToUser(memberId, SocketEvent.MESSAGE_REVOKED, {
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
          this.socketService.emitToUser(memberId, SocketEvent.MESSAGE_DELETED_FOR_EVERYONE, {
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
          );

          for (const userId of memberUserIds) {
            this.socketService.emitToUser(userId, SocketEvent.RECEIVE_MESSAGE, {
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
          this.socketService.emitToUser(memberId, SocketEvent.MESSAGE_EDITED, {
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
          this.socketService.emitToUser(memberId, SocketEvent.MESSAGE_PINNED, {
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
          this.socketService.emitToUser(memberId, SocketEvent.MESSAGE_UNPINNED, {
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

      if (!text && (!media || media.length === 0)) {
        res.status(400).json({ error: "Either text or media is required" });
        return;
      }

      const validatedData = quoteMessageDTOSchema.parse({
        senderId: currentUserId,
        text,
        media,
        quotedMessageId: messageId,
      });

      const quotedMessageObj = await this.useCase.getMessage(messageId);
      if (!quotedMessageObj) {
        res.status(404).json({ error: "Quoted message not found" });
        return;
      }
      const conversationId = quotedMessageObj.conversationId;

      const quotedMsg = await this.useCase.quoteMessage(
        conversationId,
        validatedData.senderId,
        validatedData.text,
        validatedData.media,
        validatedData.quotedMessageId,
      );

      if (this.socketService) {
        const memberUserIds = await this.useCase.getConversationMembers(
          conversationId,
        );
        for (const userId of memberUserIds) {
          this.socketService.emitToUser(userId, SocketEvent.RECEIVE_MESSAGE, {
            message: quotedMsg,
            conversationId,
          });
        }
      }

      res.status(201).json({ data: quotedMsg });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendValidationError(res, error);
        return;
      }
      this.sendError(res, error);
    }
  }

  async searchMessagesAPI(req: Request, res: Response) {
    try {
      const conversationId = this.parseIdParam(req, "conversationId");
      const { query, cursor, limit, from, to, contextLimit } = req.query;
      const currentUserId = this.getCurrentUserId(req, res);

      if (!currentUserId) {
        this.sendUnauthorized(res);
        return;
      }

      const validatedData = searchMessagesDTOSchema.parse({
        conversationId,
        query,
        cursor,
        limit: limit ? Number(limit) : 20,
        from: from || undefined,
        to: to || undefined,
        contextLimit: contextLimit ? Number(contextLimit) : 1,
      });

      const result = await this.useCase.searchMessages(
        validatedData.conversationId,
        currentUserId,
        validatedData.query,
        validatedData.cursor,
        validatedData.limit,
        {
          from: parseSearchDate(validatedData.from),
          to: parseSearchEndDate(validatedData.to),
          contextLimit: validatedData.contextLimit,
        },
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
}
