import { SearchResult } from "../model";

export interface ISearchUseCase {
  globalSearch(userId: string, query: string, limit: number): Promise<SearchResult>;
}
