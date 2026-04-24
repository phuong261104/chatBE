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

  // Collection events (Client -> Server)
  CREATE_COLLECTION: "my_cloud:collection_create",
  UPDATE_COLLECTION: "my_cloud:collection_update",
  DELETE_COLLECTION: "my_cloud:collection_delete",
  LIST_COLLECTIONS: "my_cloud:collections_list",
  ADD_ITEM_TO_COLLECTION: "my_cloud:collection_add_item",
  REMOVE_ITEM_FROM_COLLECTION: "my_cloud:collection_remove_item",

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

  // Collection events (Server -> Client)
  COLLECTION_CREATED: "my_cloud:collection_created",
  COLLECTION_UPDATED: "my_cloud:collection_updated",
  COLLECTION_DELETED: "my_cloud:collection_deleted",
  COLLECTIONS_LISTED: "my_cloud:collections_listed",
  COLLECTION_ITEM_ADDED: "my_cloud:collection_item_added",
  COLLECTION_ITEM_REMOVED: "my_cloud:collection_item_removed",
} as const;

export type MyCloudSocketEvent = (typeof MyCloudSocketEvents)[keyof typeof MyCloudSocketEvents];
