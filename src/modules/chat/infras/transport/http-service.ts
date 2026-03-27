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
} from "../../model/dto";
import { z } from "zod";
import { ConversationType } from "../../model/model";

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
        } else {
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
      }

      res.status(201).json({ data: message });
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
          this.socketService.emitToUser(memberId, "messageRevoked", {
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
          this.socketService.emitToUser(memberId, "messageEdited", {
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
          this.socketService.emitToUser(memberId, "messagePinned", {
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
          this.socketService.emitToUser(memberId, "messageUnpinned", {
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
            this.socketService.emitToUser(memberId, "reactionAdded", {
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
            this.socketService.emitToUser(memberId, "reactionRemoved", {
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
            this.socketService.emitToUser(memberId, "allReactionsRemoved", {
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
        const isGroup =
          message.type === "group";
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
}
