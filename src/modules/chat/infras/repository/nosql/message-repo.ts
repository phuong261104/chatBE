import {
  IMessageQueryRepository,
  IMessageCommandRepository,
} from "../../../interface";

import {
  Message,
} from "../../../model";
import {
  MessageCondDTO,
  MessageUpdateDTO,
} from "../../../model/dto";

import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose,
} from "@share/repository/repo-mongoose";

import {
  MessageModel,
} from "./schemas";

export class MongoMessageQueryRepository extends BaseQueryRepositoryMongoose<
  Message,
  MessageCondDTO
> {
  constructor() {
    super(MessageModel, { createdAt: -1 });
  }
}

export class MongoMessageCommandRepository extends BaseCommandRepositoryMongoose<
  Message,
  MessageUpdateDTO
> {
  constructor() {
    super(MessageModel);
  }
}

export class MongoMessageRepository
  extends BaseRepositoryMongoose<Message, MessageCondDTO, MessageUpdateDTO>
  implements IMessageQueryRepository, IMessageCommandRepository
{
  constructor() {
    super(
      new MongoMessageQueryRepository(),
      new MongoMessageCommandRepository(),
    );
  }

  async batchInsert(messages: Message[]): Promise<boolean> {
    if (messages.length === 0) return true;
    const mongooseData = messages.map((msg) => {
      const data: any = { ...msg };
      if (data.id) {
        data._id = data.id;
        delete data.id;
      }
      return data;
    });
    await (this.cmdRepo as any).model.create(mongooseData);
    return true;
  }

  async listWithCursor(
    conversationId: string,
    cursor: string | undefined,
    limit: number,
    viewerUserId?: string,
  ): Promise<Message[]> {
    const cond: any = {
      conversationId,
    };

    if (viewerUserId) {
      cond.deletedForUserIds = { $ne: viewerUserId };
    }

    if (cursor) {
      const cursorMessage = await this.get(cursor);
      if (cursorMessage) {
        cond.createdAt = { $lt: cursorMessage.createdAt };
      }
    }

    const rows = await MessageModel.find(cond)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return rows.map((row) => {
      const { _id, __v, ...rest } = row as any;
      return {
        ...rest,
        id: String(_id),
      } as Message;
    });
  }

  async findPinnedMessages(conversationId: string): Promise<Message[]> {
    const rows = await MessageModel.find({
      conversationId,
      pinned: true,
      deletedAt: { $exists: false },
    })
      .sort({ pinnedAt: -1 })
      .lean()
      .exec();

    return rows.map((row) => {
      const { _id, __v, ...rest } = row as any;
      return {
        ...rest,
        id: String(_id),
      } as Message;
    });
  }

  async searchMessages(
    conversationId: string,
    userId: string,
    query: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<{
    messages: Message[];
    nextCursor?: string;
    hasMore: boolean;
    total: number;
  }> {
    const searchCond: any = {
      conversationId,
      deletedAt: { $exists: false },
      deletedForUserIds: { $nin: [userId] },
      $or: [
        { text: { $regex: query, $options: "i" } },
      ],
    };

    if (cursor) {
      const cursorMessage = await this.get(cursor);
      if (cursorMessage) {
        searchCond.createdAt = { $lt: cursorMessage.createdAt };
      }
    }

    const total = await MessageModel.countDocuments({
      conversationId,
      deletedAt: { $exists: false },
      deletedForUserIds: { $nin: [userId] },
      $or: [{ text: { $regex: query, $options: "i" } }],
    });

    const rows = await MessageModel.find(searchCond)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = rows.length > limit;
    const results = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastMsg = results[results.length - 1];
      nextCursor = Buffer.from(lastMsg.createdAt.toISOString()).toString("base64");
    }

    return {
      messages: results.map((row) => {
        const { _id, __v, ...rest } = row as any;
        return { ...rest, id: String(_id) } as Message;
      }),
      nextCursor,
      hasMore,
      total,
    };
  }
}
