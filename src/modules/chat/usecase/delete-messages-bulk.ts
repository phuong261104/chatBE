import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IMessageCommandRepository,
  IMessageQueryRepository,
} from "../interface";
import { Message } from "../model/model";
import { DeleteMessagesBulkDTO } from "../model/dto/delete-messages-bulk-dto";

export class DeleteMessagesBulkHandler
  implements ICommandHandler<DeleteMessagesBulkDTO, { deletedCount: number }>
{
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly messageCommandRepo: IMessageCommandRepository,
    private readonly messageQueryRepo: IMessageQueryRepository,
  ) {}

  async execute(query: DeleteMessagesBulkDTO): Promise<{ deletedCount: number }> {
    const { conversationId, userId, before, after, messageIds } = query;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    let messagesToDelete: Message[] = [];

    if (messageIds && messageIds.length > 0) {
      const results = await Promise.all(
        messageIds.map((id) => this.messageQueryRepo.get(id))
      );
      messagesToDelete = results.filter(
        (m): m is Message => m !== null && m.conversationId === conversationId && m.senderId === userId
      );
    } else {
      const allMessages: Message[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const batch = await this.messageQueryRepo.listWithCursor(
          conversationId,
          cursor,
          100
        );
        const filtered = batch.filter((msg) => {
          if (msg.senderId !== userId) return false;
          if (msg.deletedAt) return false;

          const msgTime = msg.createdAt.getTime();
          if (before && msgTime > new Date(before).getTime()) return false;
          if (after && msgTime < new Date(after).getTime()) return false;

          return true;
        });

        allMessages.push(...filtered);
        cursor = batch.length > 0 ? batch[batch.length - 1].id : undefined;
        hasMore = batch.length === 100;
      }

      messagesToDelete = allMessages;
    }

    if (messagesToDelete.length === 0) {
      return { deletedCount: 0 };
    }

    await Promise.all(
      messagesToDelete.map((msg) =>
        this.messageCommandRepo.update(msg.id, {
          deletedForUserIds: [...(msg.deletedForUserIds || []), userId],
        } as any)
      )
    );

    return { deletedCount: messagesToDelete.length };
  }
}
