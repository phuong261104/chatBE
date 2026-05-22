import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { v7 } from "uuid";
import { z } from "zod";
import { IMessagingUseCase, IUserQueryRepository } from "../../../interface";
import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageType,
} from "../../../model";
import {
  addMembersToGroupDTOSchema,
  createGroupDTOSchema,
  editMessageDTOSchema,
  saveMessagesToMyDocumentDTOSchema,
  updateGroupSettingsDTOSchema,
} from "../../../model/dto";
import {
  DynamoConversationMemberRepository,
  DynamoConversationRepository,
  DynamoMessageRepository,
} from "../../repository/dynamodb";
import { MessagingSocketService } from "../socket-service";
import { SocketEvent } from "../../../constants/socket-events";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";
import { FriendshipStatus } from "@modules/friendships/model/model";
import { DynamoBlockRepository } from "@modules/blocks/infras/repository/dynamodb";
import { IPresenceUseCase } from "@modules/user/interface";
import { RelationshipPrivacyPolicyV2 } from "@modules/user/usecase/relationship-privacy-policy-v2";
import { SELF_CONVERSATION_NAME, selfConversationPairKey } from "../../../usecase/conversation-listing";

const privateMessageSchema = z
  .object({
    targetUserId: z.string().min(1),
    text: z.string().max(5000).optional(),
    media: z.array(z.any()).optional(),
    ttlSeconds: z.number().int().positive().optional(),
  })
  .refine((data) => data.text || (data.media && data.media.length > 0), {
    message: "Either text or media is required",
  });

const conversationMessageSchema = z
  .object({
    text: z.string().max(5000).optional(),
    media: z.array(z.any()).optional(),
    ttlSeconds: z.number().int().positive().optional(),
  })
  .refine((data) => data.text || (data.media && data.media.length > 0), {
    message: "Either text or media is required",
  });

const pinSchema = z.object({
  pin: z.string().min(4).max(128),
});

const profileCardSchema = z.object({
  userId: z.string().min(1),
});

export class ChatV2Controller {
  private readonly privacyPolicy: RelationshipPrivacyPolicyV2;

  constructor(
    private readonly useCase: IMessagingUseCase,
    private readonly conversationRepo: DynamoConversationRepository,
    private readonly conversationMemberRepo: DynamoConversationMemberRepository,
    private readonly messageRepo: DynamoMessageRepository,
    private readonly friendshipRepo: DynamoFriendshipRepository,
    private readonly blockRepo: DynamoBlockRepository,
    private readonly userQueryRepo: IUserQueryRepository,
    private readonly socketService: MessagingSocketService,
    private readonly presenceUseCase: IPresenceUseCase,
  ) {
    this.privacyPolicy = new RelationshipPrivacyPolicyV2(
      this.userQueryRepo,
      this.friendshipRepo,
      this.blockRepo,
    );
  }

  getConversationsAPI = async (_req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const page = Number(_req.query.page || 1);
      const limit = Math.min(Number(_req.query.limit || 20), 100);
      const conversations = await this.useCase.getConversations(currentUserId, page, limit);
      const visible = await this.filterHiddenConversations(currentUserId, conversations);
      return res.status(200).json({ data: visible });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  getConversationsCursorAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const limit = Math.min(Number(req.query.limit || 20), 100);
      const result = await this.useCase.getConversationsCursor(
        currentUserId,
        req.query.cursor as string | undefined,
        limit,
      );
      const pinned = result.pinned
        ? await this.filterHiddenConversations(currentUserId, result.pinned)
        : null;
      const data = await this.filterHiddenConversations(currentUserId, result.data);
      return res.status(200).json({
        ...result,
        pinned,
        data,
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  getStrangerConversationsAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const limit = Math.min(Number(req.query.limit || 50), 100);
      const members = await this.conversationMemberRepo.list(
        { userId: currentUserId },
        { page: 1, limit: 1000 },
      );
      const strangers = [];

      for (const member of members) {
        if (member.leftAt || member.hidden) continue;
        const conversation = await this.conversationRepo.get(member.conversationId);
        if (!conversation || conversation.type !== ConversationType.PRIVATE) continue;

        const allMembers = await this.conversationMemberRepo.listByConversationId(conversation.id);
        const otherMember = allMembers.find((m) => m.userId !== currentUserId && !m.leftAt);
        if (!otherMember) continue;

        const areFriends = await this.areActiveFriends(currentUserId, otherMember.userId);
        if (areFriends) continue;

        const otherUser = await this.userQueryRepo.get(otherMember.userId);
        if (!otherUser) continue;

        strangers.push({
          conversation,
          member,
          otherUser: await this.privacyPolicy.sanitizePublicProfile(currentUserId, otherUser as any),
          messageRequestStatus:
            member.status === ConversationMemberStatus.PENDING ||
            otherMember.status === ConversationMemberStatus.PENDING
              ? "pending"
              : member.status === ConversationMemberStatus.REJECTED ||
                  otherMember.status === ConversationMemberStatus.REJECTED
                ? "rejected"
                : "accepted",
        });

        if (strangers.length >= limit) break;
      }

      return res.status(200).json({ data: strangers });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  getConversationPresenceAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      await this.requireConversationMember(req.params.conversationId, currentUserId);
      const members = await this.visibleMembers(req.params.conversationId);
      const data = await Promise.all(
        members.map(async (member) => {
          const presence = await this.presenceUseCase.getUserPresence(member.userId);
          return this.privacyPolicy.applyPresenceVisibility(currentUserId, member.userId, presence);
        }),
      );

      return res.status(200).json({ data });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  sendPrivateMessageAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const data = privateMessageSchema.parse(req.body);
      await this.ensureActiveUser(data.targetUserId);
      await this.ensureNotBlocked(currentUserId, data.targetUserId);

      const areFriends = await this.areActiveFriends(currentUserId, data.targetUserId);
      if (!areFriends) {
        const canSendStrangerMessage = await this.privacyPolicy.canReceiveStrangerMessage(
          currentUserId,
          data.targetUserId,
        );
        if (!canSendStrangerMessage) {
          throw this.error("Receiver blocks messages from strangers", 403);
        }
      }
      const conversation = areFriends
        ? await this.useCase.getOrCreatePrivateConversation(currentUserId, data.targetUserId)
        : await this.getOrCreateMessageRequestConversation(currentUserId, data.targetUserId);

      if (areFriends) {
        await this.ensurePrivateMemberActive(conversation.id, currentUserId);
        await this.ensurePrivateMemberActive(conversation.id, data.targetUserId);
      }

      const targetMember = await this.conversationMemberRepo.findByCond({
        conversationId: conversation.id,
        userId: data.targetUserId,
      });
      if (targetMember?.status === ConversationMemberStatus.REJECTED) {
        throw this.error("Message request has been rejected", 403);
      }

      const messages = await this.useCase.sendMessage(
        conversation.id,
        currentUserId,
        data.text,
        data.media,
        data.ttlSeconds,
      );

      const requestStatus =
        targetMember?.status === ConversationMemberStatus.PENDING ? "pending" : "accepted";
      if (requestStatus === "accepted") {
        await this.emitMessagesToVisibleMembers(conversation.id, messages);
      } else {
        this.socketService.emitToUser(data.targetUserId, "message-request:incoming", {
          conversationId: conversation.id,
          fromUserId: currentUserId,
          message: messages[0],
        });
      }

      return res.status(201).json({
        data: {
          conversation,
          messages,
          messageRequestStatus: requestStatus,
        },
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  listMessageRequestsAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const limit = Math.min(Number(req.query.limit || 50), 100);
      const members = await this.conversationMemberRepo.list(
        { userId: currentUserId },
        { page: 1, limit },
      );
      const pending = members.filter(
        (member) =>
          member.status === ConversationMemberStatus.PENDING &&
          !member.leftAt &&
          !member.hidden,
      );

      const requests = [];
      for (const member of pending) {
        const conversation = await this.conversationRepo.get(member.conversationId);
        if (!conversation || conversation.type !== ConversationType.PRIVATE) continue;

        const conversationMembers = await this.conversationMemberRepo.listByConversationId(
          member.conversationId,
        );
        const requester = conversationMembers.find(
          (m) =>
            m.userId !== currentUserId &&
            m.status === ConversationMemberStatus.ACTIVE &&
            !m.leftAt,
        );
        requests.push({
          conversation,
          member,
          requesterUserId: requester?.userId,
        });
      }

      return res.status(200).json({ data: requests });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  acceptMessageRequestAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const member = await this.requirePendingMember(req.params.conversationId, currentUserId);
      await this.conversationMemberRepo.update(member.id, {
        status: ConversationMemberStatus.ACTIVE,
        leftAt: null,
        lastActivityAt: new Date(),
      });

      return res.status(200).json({ data: { conversationId: member.conversationId } });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  rejectMessageRequestAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const member = await this.requirePendingMember(req.params.conversationId, currentUserId);
      await this.conversationMemberRepo.update(member.id, {
        status: ConversationMemberStatus.REJECTED,
        leftAt: new Date(),
      });

      return res.status(200).json({ data: { conversationId: member.conversationId } });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  hideConversationAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const { pin } = pinSchema.parse(req.body);
      const member = await this.requireConversationMember(req.params.conversationId, currentUserId);
      const hash = await bcrypt.hash(pin, 10);
      const hiddenAt = new Date();
      await this.conversationMemberRepo.update(member.id, {
        hidden: true,
        hiddenAt,
        hiddenPinHash: hash,
      });

      return res.status(200).json({ data: { conversationId: member.conversationId, hiddenAt } });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  unlockHiddenConversationAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      await this.assertHiddenPin(req.params.conversationId, currentUserId, req.body);
      const detail = await this.useCase.getConversationDetail(
        req.params.conversationId,
        currentUserId,
      );
      return res.status(200).json({ data: detail });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  unhideConversationAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const member = await this.assertHiddenPin(req.params.conversationId, currentUserId, req.body);
      await this.conversationMemberRepo.update(member.id, {
        hidden: false,
        hiddenAt: null,
        hiddenPinHash: null,
      });

      return res.status(200).json({ data: { conversationId: member.conversationId } });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  createGroupAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const data = createGroupDTOSchema.parse(req.body);
      await this.ensureFriendTargets(currentUserId, data.memberIds);
      const result = await this.useCase.createGroup(currentUserId, data);
      this.socketService.notifyNewGroup([currentUserId, ...data.memberIds], {
        conversation: result.conversation,
        systemMessage: result.systemMessage,
      });
      return res.status(201).json({ data: result });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  addMembersAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const data = addMembersToGroupDTOSchema.parse({
        conversationId: req.params.groupId,
        requesterId: currentUserId,
        memberIds: req.body.memberIds,
      });
      await this.ensureFriendTargets(currentUserId, data.memberIds);
      const newMembers = await this.useCase.addMembersToGroup(
        data.conversationId,
        data.requesterId,
        data.memberIds,
      );
      this.socketService.notifyMembersAdded(data.conversationId, newMembers);
      return res.status(200).json({ data: newMembers });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  leaveGroupAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const groupId = req.params.groupId;
      await this.useCase.leaveGroup(groupId, currentUserId, true);
      this.socketService.notifyMemberLeft(groupId, currentUserId, currentUserId);
      return res.status(200).json({ success: true });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  updateGroupSettingsAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const data = updateGroupSettingsDTOSchema.parse({
        groupId: req.params.groupId,
        allowSendLink: req.body.allowSendLink,
        requireApproval: req.body.requireApproval,
        allowMemberInvite: req.body.allowMemberInvite,
        whoCanSendMessages: req.body.whoCanSendMessages,
        whoCanAddMembers: req.body.whoCanAddMembers,
        utilityPermissions: req.body.utilityPermissions,
      });
      const conversation = await this.useCase.updateGroupSettings(
        data.groupId,
        currentUserId,
        {
          allowSendLink: data.allowSendLink,
          requireApproval: data.requireApproval,
          allowMemberInvite: data.allowMemberInvite,
          whoCanSendMessages: data.whoCanSendMessages,
          whoCanAddMembers: data.whoCanAddMembers,
          utilityPermissions: data.utilityPermissions,
        },
      );
      this.socketService.notifyGroupSettingsUpdated(data.groupId, conversation.settings);
      return res.status(200).json({ data: conversation });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  sendConversationMessageAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const data = conversationMessageSchema.parse(req.body);
      const detail = await this.useCase.getConversationDetail(
        req.params.conversationId,
        currentUserId,
      );
      if (detail.conversation.type === ConversationType.PRIVATE) {
        await this.ensureCanSendPrivateConversationMessage(
          req.params.conversationId,
          currentUserId,
        );
      }
      const messages =
        detail.conversation.type === ConversationType.GROUP
          ? await this.useCase.sendGroupMessage(
              req.params.conversationId,
              currentUserId,
              data.text,
              data.media,
              data.ttlSeconds,
            )
          : await this.useCase.sendMessage(
              req.params.conversationId,
              currentUserId,
              data.text,
              data.media,
              data.ttlSeconds,
            );

      await this.emitMessagesToVisibleMembers(req.params.conversationId, messages);
      return res.status(201).json({ data: messages });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  sendProfileCardAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const data = profileCardSchema.parse(req.body);
      await this.requireConversationMember(req.params.conversationId, currentUserId);
      const conversation = await this.conversationRepo.get(req.params.conversationId);
      if (!conversation) throw this.error("Conversation not found", 404);
      if (conversation.type === ConversationType.PRIVATE) {
        await this.ensureCanSendPrivateConversationMessage(
          req.params.conversationId,
          currentUserId,
        );
      }
      const profileUser = await this.userQueryRepo.get(data.userId);
      if (!profileUser) throw this.error("Profile user not found", 404);
      if (await this.privacyPolicy.hiddenByBlock(currentUserId, data.userId)) {
        throw this.error("Profile card is hidden by user relationship", 403);
      }

      const now = new Date();
      const message: Message = {
        id: v7(),
        conversationId: req.params.conversationId,
        senderId: currentUserId,
        type: MessageType.PROFILE_CARD,
        profileCardUserId: data.userId,
        createdAt: now,
        pinned: false,
      } as Message;

      await this.messageRepo.insert(message);
      await this.conversationRepo.update(req.params.conversationId, {
        lastMessage: {
          messageId: message.id,
          senderId: currentUserId,
          type: message.type,
          textPreview: "Profile card",
          createdAt: now,
        },
        lastMessageAt: now,
      });
      await this.conversationMemberRepo.incrementUnreadCountForConversation(
        req.params.conversationId,
        currentUserId,
      );

      const members = await this.visibleMembers(req.params.conversationId);
      await Promise.all(
        members.map(async (member) => {
          const enriched = await this.enrichProfileCardForViewer(message, member.userId);
          this.socketService.emitToUser(member.userId, SocketEvent.RECEIVE_MESSAGE, {
            message: enriched,
            conversationId: req.params.conversationId,
          });
        }),
      );

      return res.status(201).json({
        data: await this.enrichProfileCardForViewer(message, currentUserId),
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  editMessageAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const data = editMessageDTOSchema.parse({
        messageId: req.params.messageId,
        userId: currentUserId,
        text: req.body.text,
        timeLimitMs: 30_000,
      });
      const message = await this.useCase.editMessage(
        data.messageId,
        data.userId,
        data.text,
        data.timeLimitMs,
      );

      await this.emitMessageEditToVisibleMembers(message);
      return res.status(200).json({ data: message });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  saveMessagesToMyDocumentAPI = async (req: Request, res: Response) => {
    try {
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const data = saveMessagesToMyDocumentDTOSchema.parse({
        userId: currentUserId,
        messageIds: req.body.messageIds,
      });
      const result = await this.useCase.saveMessagesToMyDocument(data.userId, data.messageIds);

      for (const message of result.messages) {
        this.socketService.emitToUser(currentUserId, SocketEvent.RECEIVE_MESSAGE, {
          message,
          conversationId: message.conversationId,
        });
      }

      return res.status(201).json({ data: result });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  private async getOrCreateMessageRequestConversation(
    senderId: string,
    targetUserId: string,
  ): Promise<Conversation> {
    const isSelfConversation = senderId === targetUserId;
    const pairKey = isSelfConversation
      ? selfConversationPairKey(senderId)
      : [senderId, targetUserId].sort().join("_");
    let conversation =
      (await this.conversationRepo.findByPairKey(pairKey, ConversationType.PRIVATE)) ||
      (await this.conversationRepo.findByCond({
        type: ConversationType.PRIVATE,
        pairKey,
      }));

    const now = new Date();
    if (!conversation) {
      conversation = {
        id: v7(),
        type: ConversationType.PRIVATE,
        pairKey,
        name: isSelfConversation ? SELF_CONVERSATION_NAME : undefined,
        membersCount: isSelfConversation ? 1 : 2,
        createdAt: now,
        updatedAt: now,
      };
      await this.conversationRepo.insert(conversation);
    } else if (isSelfConversation && (conversation.name !== SELF_CONVERSATION_NAME || conversation.membersCount !== 1)) {
      await this.conversationRepo.update(conversation.id, {
        name: SELF_CONVERSATION_NAME,
        membersCount: 1,
      });
      conversation = {
        ...conversation,
        name: SELF_CONVERSATION_NAME,
        membersCount: 1,
        updatedAt: now,
      };
    }

    await this.ensureMember(conversation.id, senderId, ConversationMemberStatus.ACTIVE, now);
    if (senderId !== targetUserId) {
      await this.ensureMember(conversation.id, targetUserId, ConversationMemberStatus.PENDING, now);
    }
    return conversation;
  }

  private async ensureMember(
    conversationId: string,
    userId: string,
    status: ConversationMemberStatus,
    now: Date,
  ) {
    const existing = await this.conversationMemberRepo.findByCond({ conversationId, userId });
    if (!existing) {
      await this.conversationMemberRepo.insert({
        id: v7(),
        conversationId,
        userId,
        role: ConversationMemberRole.MEMBER,
        status,
        joinedAt: now,
        unreadCount: 0,
        pinned: false,
        archived: false,
        hiddenUserIds: [],
        lastActivityAt: now,
        updatedAt: now,
      });
      return;
    }
    if (existing.status === ConversationMemberStatus.REJECTED && status !== ConversationMemberStatus.ACTIVE) {
      throw this.error("Message request has been rejected", 403);
    }
    if (existing.leftAt || existing.status !== status) {
      await this.conversationMemberRepo.update(existing.id, {
        status,
        leftAt: null,
        lastActivityAt: now,
      });
    }
  }

  private async ensurePrivateMemberActive(conversationId: string, userId: string) {
    const member = await this.conversationMemberRepo.findByCond({ conversationId, userId });
    if (!member) {
      await this.ensureMember(conversationId, userId, ConversationMemberStatus.ACTIVE, new Date());
      return;
    }
    if (member.status !== ConversationMemberStatus.ACTIVE || member.leftAt) {
      await this.conversationMemberRepo.update(member.id, {
        status: ConversationMemberStatus.ACTIVE,
        leftAt: null,
        lastActivityAt: new Date(),
      });
    }
  }

  private async requirePendingMember(conversationId: string, userId: string) {
    const member = await this.conversationMemberRepo.findByCond({ conversationId, userId });
    if (!member || member.status !== ConversationMemberStatus.PENDING || member.leftAt) {
      throw this.error("Message request not found", 404);
    }
    return member;
  }

  private async requireConversationMember(conversationId: string, userId: string) {
    const member = await this.conversationMemberRepo.findByCond({ conversationId, userId });
    if (!member || member.leftAt) {
      throw this.error("Conversation not found", 404);
    }
    return member;
  }

  private async assertHiddenPin(conversationId: string, userId: string, body: unknown) {
    const { pin } = pinSchema.parse(body);
    const member = await this.requireConversationMember(conversationId, userId);
    if (!member.hiddenPinHash) {
      throw this.error("Hidden PIN is not set", 400);
    }
    const ok = await bcrypt.compare(pin, member.hiddenPinHash);
    if (!ok) {
      throw this.error("Invalid hidden PIN", 403);
    }
    return member;
  }

  private async filterHiddenConversations<T extends { id: string }>(
    userId: string,
    conversations: T[],
  ): Promise<T[]> {
    const visible: T[] = [];
    for (const conversation of conversations) {
      const member = await this.conversationMemberRepo.findByCond({
        conversationId: conversation.id,
        userId,
      });
      if (!member?.hidden) {
        visible.push(conversation);
      }
    }
    return visible;
  }

  private async emitMessagesToVisibleMembers(conversationId: string, messages: Message[]) {
    const members = await this.visibleMembers(conversationId);
    for (const member of members) {
      for (const message of messages) {
        this.socketService.emitToUser(member.userId, SocketEvent.RECEIVE_MESSAGE, {
          message,
          conversationId,
        });
      }
    }
  }

  private async emitMessageEditToVisibleMembers(message: Message) {
    const members = await this.visibleMembers(message.conversationId);
    for (const member of members) {
      this.socketService.emitToUser(member.userId, SocketEvent.MESSAGE_EDITED, {
        conversationId: message.conversationId,
        message,
      });
    }
  }

  private async visibleMembers(conversationId: string): Promise<ConversationMember[]> {
    const members = await this.conversationMemberRepo.listByConversationId(conversationId);
    return members.filter(
      (member) =>
        member.status === ConversationMemberStatus.ACTIVE &&
        !member.leftAt &&
        !member.hidden,
    );
  }

  private async ensureCanSendPrivateConversationMessage(conversationId: string, senderId: string) {
    const members = await this.conversationMemberRepo.listByConversationId(conversationId);
    const targets = members.filter(
      (member) =>
        member.userId !== senderId &&
        member.status === ConversationMemberStatus.ACTIVE &&
        !member.leftAt,
    );
    for (const target of targets) {
      await this.ensureNotBlocked(senderId, target.userId);
      const areFriends = await this.areActiveFriends(senderId, target.userId);
      if (!areFriends) {
        const allowed = await this.privacyPolicy.canReceiveStrangerMessage(senderId, target.userId);
        if (!allowed) {
          throw this.error("Receiver blocks messages from strangers", 403);
        }
      }
    }
  }

  private async enrichProfileCardForViewer(message: Message, viewerId: string) {
    const profileCardUserId = (message as any).profileCardUserId;
    if (message.type !== MessageType.PROFILE_CARD || !profileCardUserId) {
      return message;
    }

    const user = await this.userQueryRepo.get(profileCardUserId);
    return {
      ...message,
      profileCard: user
        ? await this.privacyPolicy.sanitizePublicProfile(viewerId, user as any)
        : null,
    };
  }

  private async ensureFriendTargets(userId: string, targetUserIds: string[]) {
    for (const targetUserId of Array.from(new Set(targetUserIds))) {
      if (targetUserId === userId) {
        throw this.error("Requester cannot include themselves", 400);
      }
      await this.ensureActiveUser(targetUserId);
      await this.ensureNotBlocked(userId, targetUserId);
      const areFriends = await this.areActiveFriends(userId, targetUserId);
      if (!areFriends) {
        throw this.error(`User ${targetUserId} is not an active friend`, 403);
      }
    }
  }

  private async ensureActiveUser(userId: string) {
    const user = await this.userQueryRepo.get(userId);
    if (!user) {
      throw this.error("User not found", 404);
    }
    if (user.status !== "active") {
      throw this.error("User is disabled", 400);
    }
  }

  private async ensureNotBlocked(userA: string, userB: string) {
    const [blockedByA, blockedByB] = await Promise.all([
      this.blockRepo.findByCond({ blockerId: userA, blockedUserId: userB }),
      this.blockRepo.findByCond({ blockerId: userB, blockedUserId: userA }),
    ]);
    if (blockedByA || blockedByB) {
      throw this.error("Users are blocked", 403);
    }
  }

  private async areActiveFriends(userA: string, userB: string) {
    if (userA === userB) return true;
    const [a, b] = [userA, userB].sort();
    const friendship = await this.friendshipRepo.findByCond({ userA: a, userB: b });
    return friendship?.status === FriendshipStatus.ACTIVE;
  }

  private getCurrentUserId(res: Response): string | null {
    return (res as any).locals?.requester?.sub || null;
  }

  private sendError(res: Response, err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(422).json({ error: "Validation error", details: err.errors });
    }
    const anyErr = err as any;
    const statusCode =
      typeof anyErr.getStatusCode === "function"
        ? anyErr.getStatusCode()
        : anyErr.statusCode || 400;
    const json =
      typeof anyErr.toJSON === "function"
        ? anyErr.toJSON(process.env.NODE_ENV === "production")
        : undefined;
    return res.status(statusCode).json({
      error: json?.message || anyErr.message,
      ...(json?.details ? { details: json.details } : {}),
    });
  }

  private error(message: string, statusCode: number) {
    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = statusCode;
    return err;
  }
}
