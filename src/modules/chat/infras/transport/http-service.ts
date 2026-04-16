import { IMessagingUseCase } from "../../interface";
import { Request, Response } from "express";
import { MessagingSocketService } from "./socket-service";
import {
  createGroupDTOSchema,
  addMembersToGroupDTOSchema,
  removeMemberFromGroupDTOSchema,
  updateGroupInfoDTOSchema,
  getOrCreatePrivateConversationDTOSchema,
  loadMessagesDTOSchema,
  markAsSeenDTOSchema,
  markAsDeliveredDTOSchema,
  leaveGroupDTOSchema,
  getGroupMembersDTOSchema,
  sendMessageDTOSchema,
  revokeMessageDTOSchema,
  deleteMessageForMeDTOSchema,
  deleteMessageForEveryoneDTOSchema,
  forwardMessagesDTOSchema,
  muteConversationDTOSchema,
  pinConversationDTOSchema,
  archiveConversationDTOSchema,
  editMessageDTOSchema,
  pinMessageDTOSchema,
  unpinMessageDTOSchema,
  getPinnedMessagesDTOSchema,
  addReactionDTOSchema,
  removeReactionDTOSchema,
  removeAllReactionsDTOSchema,
  getReactionsDTOSchema,
  quoteMessageDTOSchema,
} from "../../model";
import { z } from "zod";
import { ConversationType } from "../../model";
import { GetConversationMediaQuerySchema } from "../../model/dto/media-group-dto";

export class MessagingHttpService {
  private socketService?: MessagingSocketService;

  constructor(private readonly useCase: IMessagingUseCase) {}

  setSocketService(socketService: MessagingSocketService) {
    this.socketService = socketService;
  }

  async getPrivateConversationAPI(req: Request, res: Response) {
    try {
      const { targetUserId } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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

      res.status(200).json({ data: conversation });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      res.status(400).json({
        error: (error as Error).message,
      });
    }
  }

  async createGroupAPI(req: Request, res: Response) {
    try {
      const { name, memberIds, avatarUrl } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const validatedData = createGroupDTOSchema.parse({
        name,
        memberIds,
        avatarUrl,
      });

      const result = await this.useCase.createGroup(
        currentUserId,
        validatedData,
      );

      if (this.socketService) {
        const allMemberIds = [currentUserId, ...memberIds];
        this.socketService.notifyNewGroup(allMemberIds, {
          conversation: result.conversation,
          systemMessage: result.systemMessage,
        });
      }

      res.status(201).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      res.status(400).json({
        error: (error as Error).message,
      });
    }
  }

  async addMembersAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const { memberIds } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async removeMemberAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const userId = Array.isArray(req.params.userId)
        ? req.params.userId[0]
        : req.params.userId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const validatedData = removeMemberFromGroupDTOSchema.parse({
        conversationId: groupId,
        requesterId: currentUserId,
        targetUserId: userId,
      });

      await this.useCase.removeMemberFromGroup(
        validatedData.conversationId,
        validatedData.requesterId,
        validatedData.targetUserId,
      );

      if (this.socketService) {
        this.socketService.notifyMemberRemoved(groupId, userId);
      }

      res.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async updateGroupAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const { name, avatarUrl } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const validatedData = updateGroupInfoDTOSchema.parse({
        conversationId: groupId,
        requesterId: currentUserId,
        name,
        avatarUrl,
      });

      const updatedConversation = await this.useCase.updateGroupInfo(
        validatedData.conversationId,
        validatedData.requesterId,
        {
          name: validatedData.name,
          avatarUrl: validatedData.avatarUrl,
        },
      );

      if (this.socketService) {
        this.socketService.notifyGroupUpdated(groupId, updatedConversation);
      }

      res.status(200).json({ data: updatedConversation });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async getConversationsAPI(req: Request, res: Response) {
    try {
      const { page = "1", limit = "20" } = req.query;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async getConversationsCursorAPI(req: Request, res: Response) {
    try {
      const { cursor, limit = "20" } = req.query;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async getConversationDetailAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const result = await this.useCase.getConversationDetail(
        conversationId,
        currentUserId,
      );

      res.status(200).json({ data: result });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async loadMessagesAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const { cursor, limit = "20" } = req.query;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const validatedData = loadMessagesDTOSchema.parse({
        conversationId,
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async markAsSeenAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const { lastSeenMessageId } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const validatedData = markAsSeenDTOSchema.parse({
        conversationId,
        userId: currentUserId,
        lastSeenMessageId,
      });

      await this.useCase.markAsSeen(
        validatedData.conversationId,
        validatedData.userId,
        validatedData.lastSeenMessageId,
      );

      if (this.socketService) {
        const memberUserIds = await this.useCase.getConversationMembers(
          validatedData.conversationId,
          validatedData.userId,
        );

        for (const memberId of memberUserIds) {
          this.socketService.notifyMessageSeen(
            memberId,
            validatedData.conversationId,
            validatedData.userId,
            validatedData.lastSeenMessageId,
          );
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async markAsDeliveredAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const { lastDeliveredMessageId } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const validatedData = markAsDeliveredDTOSchema.parse({
        conversationId,
        userId: currentUserId,
        lastDeliveredMessageId,
      });

      await this.useCase.markAsDelivered(
        validatedData.conversationId,
        validatedData.userId,
        validatedData.lastDeliveredMessageId,
      );

      if (this.socketService) {
        const memberUserIds = await this.useCase.getConversationMembers(
          validatedData.conversationId,
          validatedData.userId,
        );

        for (const memberId of memberUserIds) {
          this.socketService.notifyMessageDelivered(
            memberId,
            validatedData.conversationId,
            validatedData.userId,
            validatedData.lastDeliveredMessageId,
          );
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async getTotalUnreadCountAPI(req: Request, res: Response) {
    try {
      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const totalUnread = await this.useCase.getTotalUnreadCount(currentUserId);

      res.status(200).json({ totalUnread });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async leaveGroupAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const validatedData = leaveGroupDTOSchema.parse({
        conversationId: groupId,
        userId: currentUserId,
      });

      await this.useCase.leaveGroup(
        validatedData.conversationId,
        validatedData.userId,
      );

      if (this.socketService) {
        this.socketService.notifyMemberRemoved(groupId, currentUserId);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async getGroupMembersAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async sendMessageAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const { text, media } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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

      const messages = isGroup
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
        const memberUserIds = await this.useCase.getConversationMembers(
          validatedData.conversationId,
          validatedData.senderId,
        );
        for (const msg of messages) {
          for (const userId of memberUserIds) {
            this.socketService.emitToUser(userId, "receiveMessage", {
              message: msg,
              conversationId: validatedData.conversationId,
            });
          }
        }
      }

      res.status(201).json({ data: messages });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async revokeMessageAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async deleteMessageForMeAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async deleteMessageForEveryoneAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async forwardMessagesAPI(req: Request, res: Response) {
    try {
      const { messageIds, targetConversationIds } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        error: err.message,
      });
    }
  }

  async muteConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;
      const { muteUntil, duration } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async unmuteConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      await this.useCase.unmuteConversation(conversationId, currentUserId);

      res.status(200).json({ success: true });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async pinConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async unpinConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async archiveConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async unarchiveConversationAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async editMessageAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;
      const { text } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async pinMessageAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async unpinMessageAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async getPinnedMessagesAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async getConversationMediaAPI(req: Request, res: Response) {
    try {
      const conversationId = Array.isArray(req.params.conversationId)
        ? req.params.conversationId[0]
        : req.params.conversationId;

      const { cursor, limit = "20", type = "all" } = req.query;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const validatedData = GetConversationMediaQuerySchema.parse({
        conversationId,
        userId: currentUserId,
        cursor: cursor || undefined,
        limit: parseInt(limit as string, 10),
        type,
      });

      const result = await this.useCase.getConversationMedia(
        validatedData.conversationId,
        validatedData.userId,
        validatedData.cursor,
        validatedData.limit,
        validatedData.type,
      );

      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async addReactionAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;
      const { emoji } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        const message = await (
          this.useCase as any
        ).messageQueryRepo?.get(validatedData.messageId);
        if (message) {
          const memberUserIds = await this.useCase.getConversationMembers(
            message.conversationId,
          );
          for (const memberId of memberUserIds) {
            this.socketService.emitToUser(memberId, "message:reaction", {
              messageId: validatedData.messageId,
              reaction,
            });
          }
        }
      }

      res.status(201).json({ data: reaction });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async removeReactionAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;
      const { emoji } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        const message = await (
          this.useCase as any
        ).messageQueryRepo?.get(validatedData.messageId);
        if (message) {
          const memberUserIds = await this.useCase.getConversationMembers(
            message.conversationId,
          );
          for (const memberId of memberUserIds) {
            this.socketService.emitToUser(memberId, "message:reaction:remove", {
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
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async removeAllReactionsAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
        const message = await (
          this.useCase as any
        ).messageQueryRepo?.get(validatedData.messageId);
        if (message) {
          const memberUserIds = await this.useCase.getConversationMembers(
            message.conversationId,
          );
          for (const memberId of memberUserIds) {
            this.socketService.emitToUser(memberId, "message:reactions:clear", {
              messageId: validatedData.messageId,
              userId: currentUserId,
            });
          }
        }
      }

      res.status(200).json({ success: true, deletedCount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async getReactionsAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;

      const validatedData = getReactionsDTOSchema.parse({ messageId });

      const result = await this.useCase.getReactions(validatedData.messageId);

      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async quoteMessageAPI(req: Request, res: Response) {
    try {
      const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;
      const { text, media } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
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
          validatedData.senderId,
        );
        for (const userId of memberUserIds) {
          this.socketService.emitToUser(userId, "receiveMessage", {
            message: quotedMsg,
            conversationId,
          });
        }
      }

      res.status(201).json({ data: quotedMsg });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }

      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async setAdminAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const { targetUserId, isAdmin } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const updatedConversation = await this.useCase.setAdmin(groupId, currentUserId, targetUserId, isAdmin);

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, "group:admin_changed", {
          conversationId: groupId,
          targetUserId,
          isAdmin,
          changedBy: currentUserId,
        });
      }

      res.status(200).json({ data: updatedConversation });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async transferOwnerAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const { newOwnerId } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const updatedConversation = await this.useCase.transferOwner(groupId, currentUserId, newOwnerId);

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, "group:owner_transferred", {
          conversationId: groupId,
          oldOwnerId: currentUserId,
          newOwnerId,
        });
      }

      res.status(200).json({ data: updatedConversation });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async createPollAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const { question, options, isMultipleChoice, allowAddOption, expiresAt } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.createPoll(
        groupId,
        currentUserId,
        question,
        options,
        isMultipleChoice,
        allowAddOption,
        expiresAt,
      );

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, "poll:new", {
          conversationId: groupId,
          poll,
        });
      }

      res.status(201).json({ data: poll });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async getPollsAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const polls = await this.useCase.getPolls(groupId);

      res.status(200).json({ data: polls });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async votePollAPI(req: Request, res: Response) {
    try {
      const pollId = Array.isArray(req.params.pollId)
        ? req.params.pollId[0]
        : req.params.pollId;
      const { optionIds } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.votePoll(pollId, currentUserId, optionIds);

      if (this.socketService) {
        this.socketService.emitToGroupRoom(poll.conversationId, "poll:vote", {
          pollId,
          userId: currentUserId,
          poll,
        });
      }

      res.status(200).json({ data: poll });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async getPollResultsAPI(req: Request, res: Response) {
    try {
      const pollId = Array.isArray(req.params.pollId)
        ? req.params.pollId[0]
        : req.params.pollId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const poll = await this.useCase.getPollResults(pollId);

      res.status(200).json({ data: poll });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async getPendingMembersAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const pendingMembers = await this.useCase.getPendingMembers(groupId);

      res.status(200).json({ data: pendingMembers });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async approveMemberAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const userId = Array.isArray(req.params.userId)
        ? req.params.userId[0]
        : req.params.userId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const approvedMember = await this.useCase.approveMember(groupId, userId, currentUserId);

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, "group:member_approved", {
          conversationId: groupId,
          userId,
          member: approvedMember,
        });
        this.socketService.emitToUser(userId, "group:member_approved", {
          conversationId: groupId,
          userId,
          member: approvedMember,
        });
      }

      res.status(200).json({ data: approvedMember });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async rejectMemberAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const userId = Array.isArray(req.params.userId)
        ? req.params.userId[0]
        : req.params.userId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      await this.useCase.rejectMember(groupId, userId, currentUserId);

      if (this.socketService) {
        this.socketService.emitToUser(userId, "group:member_rejected", {
          conversationId: groupId,
          userId,
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async updateGroupSettingsAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;
      const { allowSendLink, requireApproval, allowMemberInvite } = req.body;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const updatedConversation = await this.useCase.updateGroupSettings(
        groupId,
        currentUserId,
        { allowSendLink, requireApproval, allowMemberInvite },
      );

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, "group:settings_updated", {
          conversationId: groupId,
          settings: updatedConversation.settings,
        });
      }

      res.status(200).json({ data: updatedConversation });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async getGroupInfoAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const groupInfo = await this.useCase.getGroupInfo(groupId, currentUserId);

      res.status(200).json({ data: groupInfo });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }

  async dissolveGroupAPI(req: Request, res: Response) {
    try {
      const groupId = Array.isArray(req.params.groupId)
        ? req.params.groupId[0]
        : req.params.groupId;

      const requester = res.locals["requester"];
      const currentUserId = requester?.sub;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      await this.useCase.dissolveGroup(groupId, currentUserId);

      if (this.socketService) {
        this.socketService.emitToGroupRoom(groupId, "group:dissolved", {
          conversationId: groupId,
          dissolvedBy: currentUserId,
        });
      }

      res.status(200).json({ success: true, message: "Group dissolved successfully" });
    } catch (error) {
      const err = error as any;
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }
}
