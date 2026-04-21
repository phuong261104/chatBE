import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationMemberQueryRepository,
  IMessageQueryRepository,
  IMessageCommandRepository,
} from "../interface";
import { Conversation, ConversationType, Message, MessageType } from "../model/model";
import { CopyConversationDTO } from "../model/dto/copy-conversation-dto";

export class CopyConversationHandler
  implements ICommandHandler<CopyConversationDTO, { conversation: Conversation; messages: Message[] }>
{
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly conversationCommandRepo: any,
    private readonly conversationQueryRepo: any,
  ) {}

  async execute(query: CopyConversationDTO): Promise<{ conversation: Conversation; messages: Message[] }> {
    const { conversationId, requesterId, targetUserId, memberIds, before, after } = query;

    const requesterMember = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId: requesterId,
    });

    if (!requesterMember) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const sourceConversation = await this.conversationQueryRepo.get(conversationId);
    if (!sourceConversation) {
      throw AppError.from(new Error("Conversation not found"), 404);
    }

    const targetId = targetUserId || requesterId;
    const memberIdList = memberIds && memberIds.length > 0
      ? memberIds
      : [targetId, requesterId];

    const pairKey = [requesterId, targetId || requesterId].sort().join("_");
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

    const messagesToCopy: Message[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.messageQueryRepo.listWithCursor(conversationId, cursor, 100);
      const filtered = batch.filter((msg) => {
        if (msg.deletedAt) return false;
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
        senderId: msg.senderId,
        type: msg.type,
        text: msg.text,
        media: msg.media,
        links: msg.links,
        quotedMessageId: msg.quotedMessageId,
        quotedMessagePreview: msg.quotedMessagePreview,
        createdAt: new Date(),
        pinned: false,
      };
      await this.messageCommandRepo.insert(newMsg);
      copiedMessages.push(newMsg);
    }

    return { conversation: targetConversation, messages: copiedMessages };
  }
}
