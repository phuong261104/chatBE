import { ISearchUseCase } from "../interface";
import { SearchResult } from "../model";
import { DynamoUserRepository } from "@modules/user/infras/repository/dynamodb/dynamodb-repo";
import { DynamoConversationRepository } from "@modules/chat/infras/repository/dynamodb/conversation-repo";
import { DynamoConversationMemberRepository } from "@modules/chat/infras/repository/dynamodb/member-repo";
import { DynamoMessageRepository } from "@modules/chat/infras/repository/dynamodb/message-repo";

export class SearchUseCase implements ISearchUseCase {
  constructor() {
    this.userRepo = new DynamoUserRepository();
    this.conversationRepo = new DynamoConversationRepository();
    this.conversationMemberRepo = new DynamoConversationMemberRepository();
    this.messageRepo = new DynamoMessageRepository();
  }

  async globalSearch(
    userId: string,
    query: string,
    limit: number,
  ): Promise<SearchResult> {
    const members = await this.conversationMemberRepo.findActiveByUserId(userId);
    const userConversationIds = members.map((m: any) => m.conversationId);

    const [users, conversations, messages] = await Promise.all([
      this.searchUsers(query, limit),
      this.searchConversations(userConversationIds, query, limit),
      this.searchMessagesAcrossConversations(userConversationIds, userId, query, limit),
    ]);

    return { users, conversations, messages };
  }

  private async searchUsers(
    query: string,
    limit: number,
  ): Promise<SearchResult["users"]> {
    try {
      const results = await (this.userRepo as any).queryRepo.scanUsers(query, limit);
      return results.map((u: any) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        username: u.username,
      }));
    } catch {
      return [];
    }
  }

  private async searchConversations(
    conversationIds: string[],
    query: string,
    limit: number,
  ): Promise<SearchResult["conversations"]> {
    try {
      const results: SearchResult["conversations"] = [];
      for (const convId of conversationIds.slice(0, 20)) {
        const conv = await this.conversationRepo.get(convId);
        if (conv && conv.name && conv.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            id: conv.id,
            type: conv.type,
            name: conv.name,
            avatarUrl: conv.avatarUrl,
            membersCount: conv.membersCount,
          });
        }
        if (results.length >= limit) break;
      }
      return results;
    } catch {
      return [];
    }
  }

  private async searchMessagesAcrossConversations(
    conversationIds: string[],
    userId: string,
    query: string,
    limit: number,
  ): Promise<SearchResult["messages"]> {
    try {
      const results: SearchResult["messages"] = [];
      for (const convId of conversationIds.slice(0, 20)) {
        const result = await this.messageRepo.searchMessages(convId, userId, query, undefined, limit);
        for (const msg of result.messages) {
          results.push({
            id: msg.id,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            text: msg.text,
            createdAt: msg.createdAt,
          });
        }
        if (results.length >= limit) break;
      }
      return results.slice(0, limit);
    } catch {
      return [];
    }
  }

  private userRepo: DynamoUserRepository;
  private conversationRepo: DynamoConversationRepository;
  private conversationMemberRepo: DynamoConversationMemberRepository;
  private messageRepo: DynamoMessageRepository;
}
