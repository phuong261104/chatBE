import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
  IMessageQueryRepository,
  IMessageCommandRepository,
  IMessageReactionQueryRepository,
  IMessageReactionCommandRepository,
} from "../../../interface";

import {
  Conversation,
  ConversationMember,
  Message,
  MessageReaction,
  Poll,
} from "../../../model/model";
import {
  ConversationCondDTO,
  ConversationUpdateDTO,
  ConversationMemberCondDTO,
  ConversationMemberUpdateDTO,
  MessageCondDTO,
  MessageUpdateDTO,
} from "../../../model/dto";

import {
  BaseCommandRepositoryMongoose,
  BaseQueryRepositoryMongoose,
  BaseRepositoryMongoose,
} from "@share/repository/repo-mongoose";
import { PagingDTO } from "@share/model/paging";

import {
  ConversationModel,
  ConversationMemberModel,
  MessageModel,
  MessageReactionModel,
  PollModel,
} from "./schemas";

export class MongoConversationQueryRepository extends BaseQueryRepositoryMongoose<
  Conversation,
  ConversationCondDTO
> {
  constructor() {
    super(ConversationModel, { lastMessageAt: -1 });
  }
}

export class MongoConversationCommandRepository extends BaseCommandRepositoryMongoose<
  Conversation,
  ConversationUpdateDTO
> {
  constructor() {
    super(ConversationModel);
  }
}

export class MongoConversationRepository
  extends BaseRepositoryMongoose<
    Conversation,
    ConversationCondDTO,
    ConversationUpdateDTO
  >
  implements IConversationQueryRepository, IConversationCommandRepository
{
  constructor() {
    super(
      new MongoConversationQueryRepository(),
      new MongoConversationCommandRepository(),
    );
  }
}

export class MongoConversationMemberQueryRepository extends BaseQueryRepositoryMongoose<
  ConversationMember,
  ConversationMemberCondDTO
> {
  constructor() {
    super(ConversationMemberModel, { updatedAt: -1 });
  }
}

export class MongoConversationMemberCommandRepository extends BaseCommandRepositoryMongoose<
  ConversationMember,
  ConversationMemberUpdateDTO
> {
  constructor() {
    super(ConversationMemberModel);
  }
}

export class MongoConversationMemberRepository
  extends BaseRepositoryMongoose<
    ConversationMember,
    ConversationMemberCondDTO,
    ConversationMemberUpdateDTO
  >
  implements
    IConversationMemberQueryRepository,
    IConversationMemberCommandRepository
{
  constructor() {
    super(
      new MongoConversationMemberQueryRepository(),
      new MongoConversationMemberCommandRepository(),
    );
  }
}

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
}

export class MongoMessageReactionQueryRepository implements IMessageReactionQueryRepository {
  private toEntity(doc: any): MessageReaction {
    const { _id, __v, ...rest } = doc;
    return { ...rest, id: String(_id) } as MessageReaction;
  }

  async get(id: string): Promise<MessageReaction | null> {
    const doc = await MessageReactionModel.findById(id).lean().exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByMessageId(messageId: string): Promise<MessageReaction[]> {
    const docs = await MessageReactionModel.find({ messageId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findByUserAndMessage(messageId: string, userId: string): Promise<MessageReaction[]> {
    const docs = await MessageReactionModel.find({ messageId, userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findByUserMessageEmoji(messageId: string, userId: string, emoji: string): Promise<MessageReaction | null> {
    const doc = await MessageReactionModel.findOne({ messageId, userId, emoji }).lean().exec();
    return doc ? this.toEntity(doc) : null;
  }

  async getReactionSummary(messageId: string): Promise<Record<string, number>> {
    const docs = await MessageReactionModel.find({ messageId }).lean().exec();
    const grouped: Record<string, number> = {};
    for (const doc of docs) {
      grouped[doc.emoji] = (grouped[doc.emoji] || 0) + doc.count;
    }
    return grouped;
  }
}

export class MongoMessageReactionCommandRepository implements IMessageReactionCommandRepository {
  async upsertReaction(reaction: MessageReaction): Promise<MessageReaction> {
    const existing = await MessageReactionModel.findOne({
      messageId: reaction.messageId,
      userId: reaction.userId,
      emoji: reaction.emoji,
    });

    if (existing) {
      existing.count += 1;
      existing.createdAt = new Date();
      await existing.save();
      const { _id, __v, ...rest } = existing.toObject();
      return { ...rest, id: String(_id) } as MessageReaction;
    }

    const result = await MessageReactionModel.create({
      _id: reaction.id,
      messageId: reaction.messageId,
      userId: reaction.userId,
      emoji: reaction.emoji,
      count: 1,
      createdAt: new Date(),
    });
    const { _id, __v, ...rest } = result.toObject();
    return { ...rest, id: String(_id) } as MessageReaction;
  }

  async decrementReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    const doc = await MessageReactionModel.findOne({ messageId, userId, emoji });
    if (!doc) return false;

    if (doc.count <= 1) {
      await MessageReactionModel.deleteOne({ _id: doc._id });
      return true;
    }

    doc.count -= 1;
    doc.createdAt = new Date();
    await doc.save();
    return true;
  }

  async decrementAllByUserAndMessage(messageId: string, userId: string): Promise<number> {
    const docs = await MessageReactionModel.find({ messageId, userId });
    let deletedCount = 0;

    for (const doc of docs) {
      if (doc.count <= 1) {
        await MessageReactionModel.deleteOne({ _id: doc._id });
        deletedCount++;
      } else {
        doc.count -= 1;
        doc.createdAt = new Date();
        await doc.save();
      }
    }

    return deletedCount;
  }

  async deleteAllByUserAndMessage(messageId: string, userId: string): Promise<number> {
    const result = await MessageReactionModel.deleteMany({ messageId, userId });
    return result.deletedCount;
  }

  async deleteByMessageId(messageId: string): Promise<void> {
    await MessageReactionModel.deleteMany({ messageId });
  }
}

export class MongoMessageReactionRepository {
  constructor(
    public readonly queryRepo: IMessageReactionQueryRepository,
    public readonly cmdRepo: IMessageReactionCommandRepository,
  ) {}
}

export class MongoPollQueryRepository {
  private toEntity(doc: any): Poll {
    const { _id, __v, ...rest } = doc;
    return { ...rest, id: String(_id) } as Poll;
  }

  async get(id: string): Promise<Poll | null> {
    const doc = await PollModel.findById(id).lean().exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByConversationId(conversationId: string): Promise<Poll[]> {
    const docs = await PollModel.find({ conversationId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findActivePolls(conversationId: string): Promise<Poll[]> {
    const now = new Date();
    const docs = await PollModel.find({
      conversationId,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: now } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((doc) => this.toEntity(doc));
  }
}

export class MongoPollCommandRepository {
  async insert(poll: Poll): Promise<boolean> {
    const now = new Date();
    const result = await PollModel.create({
      _id: poll.id,
      conversationId: poll.conversationId,
      question: poll.question,
      options: poll.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        voteCount: opt.voteCount || 0,
        votedUserIds: opt.votedUserIds || [],
      })),
      createdBy: poll.createdBy,
      isMultipleChoice: poll.isMultipleChoice || false,
      allowAddOption: poll.allowAddOption || false,
      expiresAt: poll.expiresAt,
      totalVotes: poll.totalVotes || 0,
      createdAt: now,
      updatedAt: now,
    });
    return !!result;
  }

  async update(id: string, data: Partial<Poll>): Promise<boolean> {
    const updateData: any = { updatedAt: new Date() };
    if (data.question !== undefined) updateData.question = data.question;
    if (data.options !== undefined) {
      updateData.options = data.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        voteCount: opt.voteCount || 0,
        votedUserIds: opt.votedUserIds || [],
      }));
    }
    if (data.isMultipleChoice !== undefined) updateData.isMultipleChoice = data.isMultipleChoice;
    if (data.allowAddOption !== undefined) updateData.allowAddOption = data.allowAddOption;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;
    if (data.totalVotes !== undefined) updateData.totalVotes = data.totalVotes;

    const result = await PollModel.findByIdAndUpdate(id, updateData, { new: true });
    return !!result;
  }

  async delete(id: string): Promise<boolean> {
    const result = await PollModel.findByIdAndDelete(id);
    return !!result;
  }
}

export class MongoPollRepository {
  constructor(
    public readonly queryRepo: MongoPollQueryRepository,
    public readonly cmdRepo: MongoPollCommandRepository,
  ) {}
}
