import { z } from "zod";

const numberQuery = (defaultValue: number, min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return defaultValue;
    return Number(value);
  }, z.number().int().min(min).max(max).default(defaultValue));

export const globalSearchDTOSchema = z.object({
  query: z.string().max(200).default(""),
  type: z.preprocess(
    (value) => String(value || "ALL").toUpperCase(),
    z.enum(["ALL", "USERS", "MESSAGES", "GROUPS", "MEDIA", "LINKS"]).default("ALL"),
  ),
  conversationId: z.string().optional(),
  mediaType: z.preprocess(
    (value) => String(value || "all").toLowerCase(),
    z.enum(["all", "image", "video", "file", "voice"]).default("all"),
  ),
  from: z.string().optional(),
  to: z.string().optional(),
  senderId: z.string().optional(),
  cursor: z.string().optional(),
  limit: numberQuery(10, 1, 50),
  contextLimit: numberQuery(1, 0, 5),
}).superRefine((value, ctx) => {
  if (!value.query.trim() && !["MEDIA", "LINKS"].includes(value.type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Search query is required",
      path: ["query"],
    });
  }
});

export type GlobalSearchDTO = z.infer<typeof globalSearchDTOSchema>;

export interface MessageSearchContext {
  before: any[];
  after: any[];
}

export interface SearchResult {
  users: Array<{
    id: string;
    displayName?: string;
    avatarUrl?: string;
    username?: string;
    matchedFields?: string[];
  }>;
  conversations: Array<SearchGroupResult>;
  groups: Array<SearchGroupResult>;
  messages: Array<{
    id: string;
    conversationId: string;
    senderId: string;
    text?: string;
    createdAt: Date;
    context?: MessageSearchContext;
  }>;
  media: Array<{
    messageId: string;
    conversationId: string;
    type: "image" | "video" | "file" | "voice";
    url?: string;
    name?: string;
    senderId: string;
    createdAt: Date;
  }>;
  links: Array<{
    messageId: string;
    conversationId: string;
    url?: string;
    senderId: string;
    createdAt: Date;
  }>;
  nextCursor?: string;
  hasMore: boolean;
}

export interface SearchGroupResult {
    id: string;
    type: string;
    name?: string;
    avatarUrl?: string;
    membersCount: number;
    matchedMembers?: Array<{
      id: string;
      displayName?: string;
      avatarUrl?: string;
      username?: string;
    }>;
}

export interface SearchMessagesOptions {
  from?: Date;
  to?: Date;
  senderId?: string;
  contextLimit?: number;
}

export interface MessageSearchResultItem {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  createdAt: Date;
  context?: MessageSearchContext;
}

export interface ConversationMediaSearchItem {
  messageId: string;
  conversationId: string;
  type: "image" | "video" | "file" | "voice";
  url?: string;
  name?: string;
  senderId: string;
  createdAt: Date;
}

export interface ConversationLinkSearchItem {
  messageId: string;
  conversationId: string;
  url?: string;
  senderId: string;
  createdAt: Date;
}

export interface MessageRepositorySearchOptions {
  from?: Date;
  to?: Date;
  hiddenAfter?: Date;
}

export interface MessageRepositorySearchResult {
  messages: any[];
  nextCursor?: string;
  hasMore: boolean;
  total: number;
}

export interface ConversationSearchMediaResult {
  media: ConversationMediaSearchItem[];
  links: ConversationLinkSearchItem[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface SearchUserResult {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  username?: string;
  matchedFields?: string[];
}

export const SearchType = {
  ALL: "ALL",
  USERS: "USERS",
  MESSAGES: "MESSAGES",
  GROUPS: "GROUPS",
  MEDIA: "MEDIA",
  LINKS: "LINKS",
} as const;

export type SearchType = typeof SearchType[keyof typeof SearchType];

export const SearchMediaType = {
  ALL: "all",
  IMAGE: "image",
  VIDEO: "video",
  FILE: "file",
  VOICE: "voice",
} as const;

export type SearchMediaType = typeof SearchMediaType[keyof typeof SearchMediaType];

export function parseSearchDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export function parseSearchEndDate(value?: string): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999Z`);
  }
  return parseSearchDate(value);
}
