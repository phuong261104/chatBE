import { AppError } from "@share/app-error";
import {
  ClassificationType,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageStatus,
} from "@modules/chat/model/model";
import { ISearchUseCase } from "../interface";
import {
  ConversationLinkSearchItem,
  ConversationMediaSearchItem,
  ConversationSearchMediaResult,
  GlobalSearchDTO,
  MessageSearchResultItem,
  SearchGroupResult,
  SearchMediaType,
  SearchResult,
  SearchType,
  SearchUserResult,
  parseSearchDate,
  parseSearchEndDate,
} from "../model";

export interface SearchUseCaseDeps {
  userRepo: any;
  conversationRepo: any;
  conversationMemberRepo: any;
  messageRepo: any;
  classificationRepo: any;
  blockRepo?: any;
}

type ActiveMember = {
  conversationId: string;
  userId: string;
  status?: string;
  leftAt?: Date;
  hiddenAt?: Date;
};

type DateRange = {
  from?: Date;
  to?: Date;
};

const EMPTY_RESULT: SearchResult = {
  users: [],
  conversations: [],
  groups: [],
  messages: [],
  media: [],
  links: [],
  hasMore: false,
};

export class SearchUseCase implements ISearchUseCase {
  constructor(private readonly deps: SearchUseCaseDeps) {}

  async globalSearch(userId: string, input: GlobalSearchDTO): Promise<SearchResult> {
    const query = input.query.trim();
    const dateRange = this.parseDateRange(input.from, input.to);
    const members = await this.getActiveMembers(userId);
    const memberByConversation = new Map(members.map((member) => [member.conversationId, member]));
    const allowedConversationIds = members.map((member) => member.conversationId);
    const targetConversationIds = input.conversationId
      ? [input.conversationId]
      : allowedConversationIds;

    if (input.conversationId && !memberByConversation.has(input.conversationId)) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const result: SearchResult = { ...EMPTY_RESULT };
    const wantsAll = input.type === SearchType.ALL;

    if ((wantsAll || input.type === SearchType.USERS) && query) {
      result.users = await this.searchUsers(userId, query, input.limit);
    }

    if ((wantsAll || input.type === SearchType.GROUPS) && query) {
      result.groups = await this.searchGroups(userId, allowedConversationIds, query, input.limit);
      result.conversations = result.groups;
    }

    if ((wantsAll || input.type === SearchType.MESSAGES) && query) {
      const messageResult = await this.searchMessagesAcrossConversations(
        userId,
        targetConversationIds,
        memberByConversation,
        query,
        input.cursor,
        input.limit,
        dateRange,
        input.contextLimit,
        !input.conversationId,
      );
      result.messages = messageResult.messages;
      result.nextCursor = messageResult.nextCursor;
      result.hasMore = messageResult.hasMore;
    }

    if (wantsAll || input.type === SearchType.MEDIA || input.type === SearchType.LINKS) {
      const mediaResult = await this.searchMediaAcrossConversations(
        userId,
        targetConversationIds,
        memberByConversation,
        input.type === SearchType.LINKS ? SearchMediaType.ALL : input.mediaType,
        input.type,
        query,
        input.cursor,
        input.limit,
        dateRange,
        !input.conversationId,
      );
      result.media = mediaResult.media;
      result.links = mediaResult.links;
      if (!result.nextCursor) result.nextCursor = mediaResult.nextCursor;
      result.hasMore = result.hasMore || mediaResult.hasMore;
    }

    return result;
  }

  async searchConversationMedia(
    userId: string,
    conversationId: string,
    mediaType: "all" | "image" | "video" | "file" | "voice",
    cursor: string | undefined,
    limit: number,
  ): Promise<ConversationSearchMediaResult> {
    const members = await this.getActiveMembers(userId);
    const member = members.find((item) => item.conversationId === conversationId);
    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }
    return this.searchMediaForConversation(userId, conversationId, member, mediaType, cursor, limit);
  }

  private async searchUsers(userId: string, query: string, limit: number): Promise<SearchUserResult[]> {
    const candidates = await this.loadUserSearchCandidates(userId, query, limit * 4);
    const results: SearchUserResult[] = [];
    for (const user of candidates) {
      if (!user || user.id === userId || user.status !== "active") continue;
      if (await this.hiddenByBlock(userId, user.id)) continue;

      const matchedFields = this.matchUserFields(user, query);
      if (matchedFields.length === 0) continue;

      results.push({
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        username: user.username,
        matchedFields,
      });
      if (results.length >= limit) break;
    }
    return results;
  }

  private async loadUserSearchCandidates(userId: string, query: string, limit: number): Promise<any[]> {
    if (typeof this.deps.userRepo.searchUsers === "function") {
      return this.deps.userRepo.searchUsers(query, userId, limit);
    }
    if (this.deps.userRepo.queryRepo && typeof this.deps.userRepo.queryRepo.scanUsers === "function") {
      return this.deps.userRepo.queryRepo.scanUsers(query, limit);
    }
    const users = await this.safeList(this.deps.userRepo, {}, { page: 1, limit: 1000 });
    return users.filter((user: any) => user.id !== userId);
  }

  private async searchGroups(
    userId: string,
    conversationIds: string[],
    query: string,
    limit: number,
  ): Promise<SearchGroupResult[]> {
    const results: SearchGroupResult[] = [];
    for (const conversationId of conversationIds) {
      const conversation = await this.deps.conversationRepo.get(conversationId);
      if (!conversation || conversation.type !== ConversationType.GROUP) continue;

      const groupNameMatches = this.includes(conversation.name, query);
      const matchedMembers = groupNameMatches
        ? []
        : await this.findMatchedGroupMembers(userId, conversationId, query);

      if (!groupNameMatches && matchedMembers.length === 0) continue;

      results.push({
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        avatarUrl: conversation.avatarUrl,
        membersCount: conversation.membersCount || 0,
        matchedMembers,
      });
      if (results.length >= limit) break;
    }
    return results;
  }

  private async findMatchedGroupMembers(userId: string, conversationId: string, query: string) {
    const members = await this.deps.conversationMemberRepo.listByConversationId(conversationId);
    const activeMembers = members.filter((member: any) =>
      member.status === ConversationMemberStatus.ACTIVE && !member.leftAt && member.userId !== userId,
    );
    const users = await this.loadUsersByIds(activeMembers.map((member: any) => member.userId));
    const matched = [];
    for (const user of users) {
      if (!user || user.status !== "active") continue;
      if (await this.hiddenByBlock(userId, user.id)) continue;
      if (this.matchUserFields(user, query).length === 0) continue;
      matched.push({
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        username: user.username,
      });
      if (matched.length >= 3) break;
    }
    return matched;
  }

  private async searchMessagesAcrossConversations(
    userId: string,
    conversationIds: string[],
    memberByConversation: Map<string, ActiveMember>,
    query: string,
    cursor: string | undefined,
    limit: number,
    dateRange: DateRange,
    contextLimit: number,
    useGlobalCursor: boolean,
  ): Promise<{ messages: MessageSearchResultItem[]; nextCursor?: string; hasMore: boolean }> {
    const messages: MessageSearchResultItem[] = [];
    let nextCursor: string | undefined;
    let hasMore = false;
    const globalCursor = useGlobalCursor ? this.decodeGlobalCursor(cursor) : undefined;

    for (let index = 0; index < conversationIds.length; index++) {
      const conversationId = conversationIds[index];
      if (globalCursor?.conversationId && conversationId !== globalCursor.conversationId) continue;
      const member = memberByConversation.get(conversationId);
      if (!member) continue;
      const conversationCursor = useGlobalCursor
        ? globalCursor?.conversationId === conversationId
          ? globalCursor.cursor
          : undefined
        : cursor;
      const searchResult = await this.deps.messageRepo.searchMessages(
        conversationId,
        userId,
        query,
        conversationCursor,
        limit,
        {
          from: dateRange.from,
          to: dateRange.to,
          hiddenAfter: member.hiddenAt,
        },
      );

      const enriched = await this.enrichMessagesWithContext(
        conversationId,
        userId,
        searchResult.messages,
        contextLimit,
        member.hiddenAt,
      );
      messages.push(...enriched);
      if (searchResult.hasMore) {
        nextCursor = useGlobalCursor
          ? this.encodeGlobalCursor(conversationId, searchResult.nextCursor)
          : searchResult.nextCursor;
        hasMore = true;
        break;
      }
      if (messages.length >= limit) {
        const nextConversationId = conversationIds
          .slice(index + 1)
          .find((id) => memberByConversation.has(id));
        if (useGlobalCursor && nextConversationId) {
          nextCursor = this.encodeGlobalCursor(nextConversationId);
          hasMore = true;
        }
        break;
      }
    }

    return {
      messages: messages
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit),
      nextCursor,
      hasMore,
    };
  }

  private async searchMediaAcrossConversations(
    userId: string,
    conversationIds: string[],
    memberByConversation: Map<string, ActiveMember>,
    mediaType: "all" | "image" | "video" | "file" | "voice",
    searchType: SearchType,
    query: string,
    cursor: string | undefined,
    limit: number,
    dateRange: DateRange,
    useGlobalCursor: boolean,
  ): Promise<ConversationSearchMediaResult> {
    const media: ConversationMediaSearchItem[] = [];
    const links: ConversationLinkSearchItem[] = [];
    let nextCursor: string | undefined;
    let hasMore = false;
    const globalCursor = useGlobalCursor ? this.decodeGlobalCursor(cursor) : undefined;

    for (let index = 0; index < conversationIds.length; index++) {
      const conversationId = conversationIds[index];
      if (globalCursor?.conversationId && conversationId !== globalCursor.conversationId) continue;
      const member = memberByConversation.get(conversationId);
      if (!member) continue;
      const conversationCursor = useGlobalCursor
        ? globalCursor?.conversationId === conversationId
          ? globalCursor.cursor
          : undefined
        : cursor;
      const result = await this.searchMediaForConversation(
        userId,
        conversationId,
        member,
        mediaType,
        conversationCursor,
        limit,
        query,
        searchType,
        dateRange,
      );
      media.push(...result.media);
      links.push(...result.links);
      if (result.hasMore) {
        nextCursor = useGlobalCursor
          ? this.encodeGlobalCursor(conversationId, result.nextCursor)
          : result.nextCursor;
        hasMore = true;
        break;
      }
      if (media.length + links.length >= limit) {
        const nextConversationId = conversationIds
          .slice(index + 1)
          .find((id) => memberByConversation.has(id));
        if (useGlobalCursor && nextConversationId) {
          nextCursor = this.encodeGlobalCursor(nextConversationId);
          hasMore = true;
        }
        break;
      }
    }

    return {
      media: media.slice(0, limit),
      links: links.slice(0, limit),
      nextCursor,
      hasMore,
    };
  }

  private async searchMediaForConversation(
    userId: string,
    conversationId: string,
    member: ActiveMember,
    mediaType: "all" | "image" | "video" | "file" | "voice",
    cursor: string | undefined,
    limit: number,
    query = "",
    searchType: SearchType = SearchType.MEDIA,
    dateRange: DateRange = {},
  ): Promise<ConversationSearchMediaResult> {
    const repoType = this.toClassificationType(mediaType);
    const result = repoType
      ? await this.deps.classificationRepo.listByConversationAndType(conversationId, repoType, cursor, limit + 1)
      : await this.deps.classificationRepo.listByConversation(conversationId, cursor, limit + 1);

    const media: ConversationMediaSearchItem[] = [];
    const links: ConversationLinkSearchItem[] = [];
    const normalizedQuery = query.toLowerCase();

    for (const item of result.items || []) {
      if (normalizedQuery && !this.classificationMatchesQuery(item, normalizedQuery)) continue;
      const message = await this.deps.messageRepo.get(item.messageId);
      if (!this.isVisibleMessage(message, userId, member.hiddenAt, dateRange)) continue;

      if (item.type === ClassificationType.LINK) {
        if (searchType !== SearchType.MEDIA) {
          links.push({
            messageId: item.messageId,
            conversationId: item.conversationId,
            url: item.linkUrl,
            senderId: item.senderId,
            createdAt: new Date(item.createdAt),
          });
        }
      } else if (searchType !== SearchType.LINKS) {
        media.push({
          messageId: item.messageId,
          conversationId: item.conversationId,
          type: this.fromClassificationType(item.type),
          url: item.url,
          name: item.name,
          senderId: item.senderId,
          createdAt: new Date(item.createdAt),
        });
      }
    }

    return {
      media: media.slice(0, limit),
      links: links.slice(0, limit),
      nextCursor: result.nextCursor || undefined,
      hasMore: !!result.hasMore,
    };
  }

  private async enrichMessagesWithContext(
    conversationId: string,
    userId: string,
    messages: Message[],
    contextLimit: number,
    hiddenAt?: Date,
  ): Promise<MessageSearchResultItem[]> {
    if (contextLimit <= 0 || messages.length === 0) {
      return messages.map((message) => this.toMessageResult(message));
    }

    const conversationMessages = await this.deps.messageRepo.listWithCursor(
      conversationId,
      undefined,
      2000,
      userId,
    );
    const visible = conversationMessages.filter((message: Message) =>
      this.isVisibleMessage(message, userId, hiddenAt),
    );

    return messages.map((message) => {
      const index = visible.findIndex((item: Message) => item.id === message.id);
      if (index < 0) return this.toMessageResult(message);

      const after = visible
        .slice(Math.max(0, index - contextLimit), index)
        .reverse()
        .map((item: Message) => this.toMessageResult(item));
      const before = visible
        .slice(index + 1, index + 1 + contextLimit)
        .reverse()
        .map((item: Message) => this.toMessageResult(item));
      return {
        ...this.toMessageResult(message),
        context: { before, after },
      };
    });
  }

  private async getActiveMembers(userId: string): Promise<ActiveMember[]> {
    if (typeof this.deps.conversationMemberRepo.findActiveByUserId === "function") {
      return this.deps.conversationMemberRepo.findActiveByUserId(userId);
    }
    const result = await this.deps.conversationMemberRepo.listByUserIdCursor(userId, undefined, 1000);
    return [...(result.pinnedMembers || []), ...(result.normalMembers || [])].filter((member: any) =>
      member.status === ConversationMemberStatus.ACTIVE && !member.leftAt,
    );
  }

  private async loadUsersByIds(ids: string[]): Promise<any[]> {
    if (ids.length === 0) return [];
    if (typeof this.deps.userRepo.findByIds === "function") {
      return this.deps.userRepo.findByIds(ids);
    }
    if (typeof this.deps.userRepo.listByIds === "function") {
      return this.deps.userRepo.listByIds(ids);
    }
    return Promise.all(ids.map((id) => this.deps.userRepo.get(id)));
  }

  private async hiddenByBlock(viewerId: string, targetUserId: string): Promise<boolean> {
    if (!this.deps.blockRepo || viewerId === targetUserId) return false;
    const [blockedByViewer, blockedByTarget] = await Promise.all([
      this.deps.blockRepo.findByCond?.({ blockerId: viewerId, blockedUserId: targetUserId }),
      this.deps.blockRepo.findByCond?.({ blockerId: targetUserId, blockedUserId: viewerId }),
    ]);
    return !!(blockedByViewer || blockedByTarget);
  }

  private matchUserFields(user: any, query: string): string[] {
    const privacy = {
      searchableByPhone: true,
      searchableByUsername: true,
      ...(user.privacy || {}),
    };
    const fields: string[] = [];
    if (this.includes(user.displayName, query)) fields.push("displayName");
    if (privacy.searchableByUsername !== false && this.includes(user.username, query)) fields.push("username");
    if (privacy.searchableByPhone !== false && this.includes(user.phone, query)) fields.push("phone");
    return fields;
  }

  private isVisibleMessage(
    message: Message | null | undefined,
    userId: string,
    hiddenAt?: Date,
    dateRange: DateRange = {},
  ): message is Message {
    if (!message) return false;
    if (message.messageStatus === MessageStatus.REVOKED || message.deletedAt) return false;
    if (message.deletedForUserIds?.includes(userId)) return false;
    if (message.expireAtEpoch && message.expireAtEpoch <= Math.floor(Date.now() / 1000)) return false;
    if (hiddenAt && message.createdAt <= hiddenAt) return false;
    if (dateRange.from && message.createdAt < dateRange.from) return false;
    if (dateRange.to && message.createdAt > dateRange.to) return false;
    return true;
  }

  private toMessageResult(message: Message): MessageSearchResultItem {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      text: message.text,
      createdAt: message.createdAt,
    };
  }

  private toClassificationType(type: "all" | "image" | "video" | "file" | "voice"): ClassificationType | undefined {
    if (type === "all") return undefined;
    return {
      image: ClassificationType.IMAGE,
      video: ClassificationType.VIDEO,
      file: ClassificationType.FILE,
      voice: ClassificationType.VOICE,
    }[type];
  }

  private fromClassificationType(type: ClassificationType): "image" | "video" | "file" | "voice" {
    if (type === ClassificationType.IMAGE) return "image";
    if (type === ClassificationType.VIDEO) return "video";
    if (type === ClassificationType.VOICE) return "voice";
    return "file";
  }

  private classificationMatchesQuery(item: any, normalizedQuery: string): boolean {
    return [item.name, item.url, item.linkUrl].some((value) =>
      typeof value === "string" && value.toLowerCase().includes(normalizedQuery),
    );
  }

  private parseDateRange(from?: string, to?: string): DateRange {
    return {
      from: parseSearchDate(from),
      to: parseSearchEndDate(to),
    };
  }

  private encodeGlobalCursor(conversationId: string, cursor?: string): string {
    return Buffer.from(JSON.stringify({ conversationId, cursor: cursor || "" }), "utf-8").toString("base64");
  }

  private decodeGlobalCursor(cursor?: string): { conversationId?: string; cursor?: string } | undefined {
    if (!cursor) return undefined;
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
      if (!parsed || typeof parsed !== "object" || typeof parsed.conversationId !== "string") {
        return undefined;
      }
      return {
        conversationId: parsed.conversationId,
        cursor: typeof parsed.cursor === "string" && parsed.cursor ? parsed.cursor : undefined,
      };
    } catch {
      return undefined;
    }
  }

  private async safeList(repo: any, cond: Record<string, any>, paging: { page: number; limit: number }) {
    if (typeof repo.list !== "function") return [];
    return repo.list(cond, paging);
  }

  private includes(value: unknown, query: string): boolean {
    return typeof value === "string" && value.toLowerCase().includes(query.toLowerCase());
  }
}
