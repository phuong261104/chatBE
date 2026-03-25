import { ISearchUseCase } from "../interface";
import { SearchResult } from "../model";
import { UserModel } from "@modules/user/infras/repository/nosql/dto";
import {
  ConversationModel,
  ConversationMemberModel,
  MessageModel,
} from "@modules/chat/infras/repository/nosql/schemas";

export class SearchUseCase implements ISearchUseCase {
  async globalSearch(
    userId: string,
    query: string,
    limit: number,
  ): Promise<SearchResult> {
    const regex = new RegExp(query, "i");

    const memberDocs = await ConversationMemberModel.find({
      userId,
      leftAt: { $exists: false },
    })
      .select("conversationId")
      .lean()
      .exec();

    const userConversationIds = memberDocs.map((m: any) => String(m.conversationId));

    const [users, conversations, messages] = await Promise.all([
      UserModel.find({
        $or: [
          { displayName: regex },
          { username: regex },
          { phone: regex },
        ],
        status: "active",
      })
        .select("_id displayName avatarUrl username")
        .limit(limit)
        .lean()
        .exec(),

      ConversationModel.find({
        _id: { $in: userConversationIds },
        name: regex,
      })
        .select("_id type name avatarUrl membersCount")
        .limit(limit)
        .lean()
        .exec(),

      MessageModel.find({
        conversationId: { $in: userConversationIds },
        text: regex,
        deletedAt: { $exists: false },
      })
        .select("_id conversationId senderId text createdAt")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .exec(),
    ]);

    return {
      users: users.map((u: any) => ({
        id: String(u._id),
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        username: u.username,
      })),
      conversations: conversations.map((c: any) => ({
        id: String(c._id),
        type: c.type,
        name: c.name,
        avatarUrl: c.avatarUrl,
        membersCount: c.membersCount,
      })),
      messages: messages.map((m: any) => ({
        id: String(m._id),
        conversationId: m.conversationId,
        senderId: m.senderId,
        text: m.text,
        createdAt: m.createdAt,
      })),
    };
  }
}
