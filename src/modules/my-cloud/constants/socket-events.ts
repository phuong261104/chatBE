export const MyCloudSocketEvents = {
  // Client -> Server
  LOAD_ITEMS: "my_cloud:load",
  CREATE_ITEM: "my_cloud:create",
  UPDATE_ITEM: "my_cloud:update",
  DELETE_ITEM: "my_cloud:delete",
  RESTORE_ITEM: "my_cloud:restore",
  PIN_ITEM: "my_cloud:pin",
  GET_STATS: "my_cloud:stats",
  SEARCH_ITEMS: "my_cloud:search",
  SHARE_ITEM: "my_cloud:share",
  EMPTY_TRASH: "my_cloud:empty_trash",

  // Server -> Client
  ITEM_CREATED: "my_cloud:item_created",
  ITEM_UPDATED: "my_cloud:item_updated",
  ITEM_DELETED: "my_cloud:item_deleted",
  ITEM_RESTORED: "my_cloud:item_restored",
  ITEM_PINNED: "my_cloud:item_pinned",
  ITEMS_LOADED: "my_cloud:items_loaded",
  STATS_LOADED: "my_cloud:stats_loaded",
  SEARCH_RESULT: "my_cloud:search_result",
  ITEM_SHARED: "my_cloud:item_shared",
  TRASH_EMPTIED: "my_cloud:trash_emptied",
} as const;

export type MyCloudSocketEvent = (typeof MyCloudSocketEvents)[keyof typeof MyCloudSocketEvents];
