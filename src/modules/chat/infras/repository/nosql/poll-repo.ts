import {
  Poll,
} from "../../../model";

import {
  PollModel,
} from "./schemas";

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
