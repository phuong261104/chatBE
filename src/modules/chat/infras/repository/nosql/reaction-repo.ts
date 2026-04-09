import {
  IMessageReactionQueryRepository,
  IMessageReactionCommandRepository,
} from "../../../interface";

import {
  MessageReaction,
} from "../../../model";

import {
  MessageReactionModel,
} from "./schemas";

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
