import { ConversationMediaSearchItem, ConversationLinkSearchItem, GlobalSearchDTO, SearchResult } from "../model";

export interface ISearchUseCase {
  globalSearch(userId: string, query: GlobalSearchDTO): Promise<SearchResult>;
  searchConversationMedia(
    userId: string,
    conversationId: string,
    mediaType: "all" | "image" | "video" | "file" | "voice",
    cursor: string | undefined,
    limit: number,
  ): Promise<{
    media: ConversationMediaSearchItem[];
    links: ConversationLinkSearchItem[];
    nextCursor?: string;
    hasMore: boolean;
  }>;
}
