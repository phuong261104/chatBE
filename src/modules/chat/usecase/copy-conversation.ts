import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageQueryRepository,
  IMessageCommandRepository,
} from "../interface";
import {
  Conversation,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageStatus,
  MessageType,
} from "../model/model";
import { CopyConversationDTO } from "../model/dto/copy-conversation-dto";
import { ChatAccessPolicy } from "./chat-access-policy";

export class CopyConversationHandler
  implements ICommandHandler<CopyConversationDTO, { conversation: Conversation; messages: Message[] }>
{
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: any,
    private readonly conversationQueryRepo: any,
    private readonly accessPolicy: ChatAccessPolicy,
  ) {}

  async execute(query: CopyConversationDTO): Promise<{ conversation: Conversation; messages: Message[] }> {
    const { conversationId, requesterId, targetUserId, memberIds, before, after } = query;

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId: requesterId,
    });

    if (
      !requesterMember ||
      requesterMember.leftAt ||
      requesterMember.status !== ConversationMemberStatus.ACTIVE
    ) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const sourceConversation = await this.conversationQueryRepo.get(conversationId);
    if (!sourceConversation) {
      throw AppError.from(new Error("Conversation not found"), 404);
    }

    const targetId = targetUserId || memberIds?.[0] || requesterId;
    await this.accessPolicy.assertCanStartPrivateConversation(requesterId, targetId);
    const memberIdList = targetId === requesterId ? [requesterId] : [requesterId, targetId];

    const pairKey = requesterId === targetId
      ? `self_${requesterId}`
      : [requesterId, targetId].sort().join("_");
    let targetConversation = await this.conversationQueryRepo.findByPairKey(pairKey, ConversationType.PRIVATE);

    if (!targetConversation) {
      targetConversation = {
        id: v7(),
        type: ConversationType.PRIVATE,
        pairKey,
        createdBy: requesterId,
        membersCount: memberIdList.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.conversationCommandRepo.insert(targetConversation);
    }
    await this.ensurePrivateMembers(targetConversation.id, memberIdList, requesterId);

    const messagesToCopy: Message[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.messageQueryRepo.listWithCursor(conversationId, cursor, 100, requesterId);
      const filtered = batch.filter((msg) => {
        if (msg.deletedAt) return false;
        if (msg.messageStatus === MessageStatus.REVOKED) return false;
        if (msg.deletedForUserIds?.includes(requesterId)) return false;
        if (msg.type === MessageType.SYSTEM) return false;

        const msgTime = msg.createdAt.getTime();
        if (before && msgTime > new Date(before).getTime()) return false;
        if (after && msgTime < new Date(after).getTime()) return false;

        return true;
      });

      messagesToCopy.push(...filtered);
      cursor = batch.length > 0 ? batch[batch.length - 1].id : undefined;
      hasMore = batch.length === 100;
    }

    const copiedMessages: Message[] = [];
    for (const msg of messagesToCopy) {
      const newMsg: Message = {
        id: v7(),
        conversationId: targetConversation.id,
        senderId: requesterId,
        type: msg.type,
        text: msg.text,
        media: msg.media,
        links: msg.links,
        profileCardUserId: (msg as any).profileCardUserId,
        quotedMessageId: msg.quotedMessageId,
        quotedMessagePreview: msg.quotedMessagePreview,
        createdAt: new Date(),
        pinned: false,
      };
      await this.messageCommandRepo.insert(newMsg);
      copiedMessages.push(newMsg);
    }

    const lastCopiedMessage = copiedMessages[copiedMessages.length - 1];
    if (lastCopiedMessage) {
      await this.conversationCommandRepo.update(targetConversation.id, {
        lastMessage: {
          messageId: lastCopiedMessage.id,
          senderId: requesterId,
          type: lastCopiedMessage.type,
          textPreview: (lastCopiedMessage.text || "").substring(0, 100),
          createdAt: lastCopiedMessage.createdAt,
        },
        lastMessageAt: lastCopiedMessage.createdAt,
      });
      await this.conversationMemberCommandRepo.incrementUnreadCountForConversation(targetConversation.id, requesterId);
    }

    return { conversation: targetConversation, messages: copiedMessages };
  }

  private async ensurePrivateMembers(
    conversationId: string,
    memberIds: string[],
    requesterId: string,
  ): Promise<void> {
    const now = new Date();
    for (const memberId of memberIds) {
      const existing = await this.conversationMemberQueryRepo.findByCond({
        conversationId,
        userId: memberId,
      });
      if (existing && !existing.leftAt && existing.status === ConversationMemberStatus.ACTIVE) {
        continue;
      }

      if (existing) {
        await this.conversationMemberCommandRepo.update(existing.id, {
          status: ConversationMemberStatus.ACTIVE,
          leftAt: null,
          unreadCount: memberId === requesterId ? existing.unreadCount || 0 : existing.unreadCount || 0,
          lastActivityAt: now,
        } as any);
        continue;
      }

      await this.conversationMemberCommandRepo.insert({
        id: v7(),
        conversationId,
        userId: memberId,
        role: ConversationMemberRole.MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        joinedAt: now,
        unreadCount: 0,
        pinned: false,
        archived: false,
        hiddenUserIds: [],
        lastActivityAt: now,
        updatedAt: now,
      });
    }
  }
}
