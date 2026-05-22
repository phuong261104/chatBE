# Chat Backend Socket.IO Reference

Canonical socket handoff for the current source code in `src/index.ts` and the socket services under `src/modules`.

- Socket.IO path: `/socket.io`
- Auth sources: `auth.token`, `query.token`, or `Authorization: Bearer <jwt>`
- Optional client metadata: `auth.deviceId`, `query.deviceId`, `auth.platform`, `query.platform`
- Standard ack shape for business handlers: `{ success: true, ...data }` or `{ success: false, error: string }`
- User room convention: `user:${userId}`
- Conversation room conventions: `group:${conversationId}` and `group_room:${conversationId}`

## Namespaces

| Namespace | Source service | Purpose |
| --- | --- | --- |
| `/` | `createSocketIOServer`, `MyCloudSocketService` | Base connection, presence utilities, root my-cloud socket handlers |
| `/messages` | `MessagingSocketService` | Chat, messages, group operations, polls, reminders, notes |
| `/socket/calls` | `CallSocketService` | Legacy call socket |
| `/v2/calls` | `CallV2SocketService` | Current LiveKit cloud call socket |
| `/friends` | `FriendNotificationSocketService` | Friend request and friendship notifications |
| `/blocks` | `BlockNotificationSocketService` | Block/unblock notifications |

## Shared Connection Example

```ts
import { io } from "socket.io-client";

const messages = io("http://localhost:3000/messages", {
  path: "/socket.io",
  auth: {
    token: accessToken,
    deviceId: "device-001",
    platform: "web",
  },
  transports: ["websocket", "polling"],
});
```

## Root Namespace `/`

The root namespace is created by `createSocketIOServer`. It handles base connection telemetry and presence helper events. Several root events only update activity/presence and do not run chat business logic; use `/messages` for actual message status changes.

### Server To Client

| Event | Payload |
| --- | --- |
| `connected` | `{ socketId, userId, connectionState: "connected", timestamp, activeConnections, reconnectAttempts, serverTime, heartbeatConfig: { interval, timeout } }` |
| `pong` | `{ timestamp, serverTime, latency }` |
| `user:online` | `{ userId, socketId, timestamp, visibility, isOnline, online, lastSeen }` |
| `user:offline` | `{ userId, timestamp, reason, visibility, isOnline, online, lastSeen }` |
| `session:revoked` | `{ userId, deviceId, reason, timestamp }`; emitted before disconnecting revoked device sockets |

### Client To Server

| Event | Payload | Ack |
| --- | --- | --- |
| `ping` | optional | emits `pong` |
| `subscribeConversation` | `{ conversationId }` | `{ success, room, timestamp? }` |
| `unsubscribeConversation` | `{ conversationId }` | `{ success, room? }` |
| `getOnlineStatus` | `{ userId }` | `{ userId, online, isOnline, visibility, lastSeen, connectionCount, timestamp }` |
| `getBatchOnlineStatus` | `{ userIds: string[] }` | `{ statuses: Array<{ userId, online, isOnline, visibility, lastSeen, connectionCount }>, timestamp }` |
| `typing:start` | any | No ack; touches root presence only |
| `typing:stop` | any | No ack; touches root presence only |
| `messageSeen` | any | No ack; touches root presence only |
| `messageDelivered` | any | No ack; touches root presence only |

## Root My Cloud Events

`MyCloudSocketService` registers on the root namespace. It verifies the token itself, joins `user:${userId}`, then emits response events back to that user. Errors are emitted as `error` with `{ message }`.

| Client Event | Payload |
| --- | --- |
| `my_cloud:load` | `{ limit?, type?, isDeleted?, isPinned?, cursor? }` |
| `my_cloud:create` | Cloud item create DTO |
| `my_cloud:update` | `{ itemId, ...updates }` |
| `my_cloud:delete` | `{ itemId }` |
| `my_cloud:restore` | `{ itemId }` |
| `my_cloud:pin` | `{ itemId, pinned }` |
| `my_cloud:stats` | ignored |
| `my_cloud:search` | `{ query, limit? }` |
| `my_cloud:share` | `{ itemId, expiresInDays? }` |
| `my_cloud:empty_trash` | ignored |
| `my_cloud:collection_create` | Collection create DTO |
| `my_cloud:collection_update` | `{ collectionId, ...updates }` |
| `my_cloud:collection_delete` | `{ collectionId }` |
| `my_cloud:collections_list` | ignored |
| `my_cloud:collection_add_item` | `{ collectionId, itemId }` |
| `my_cloud:collection_remove_item` | `{ collectionId, itemId }` |

| Server Event | Payload |
| --- | --- |
| `my_cloud:items_loaded` | `{ data }` |
| `my_cloud:item_created` | `{ data }` |
| `my_cloud:item_updated` | `{ data }` |
| `my_cloud:item_deleted` | `{ data: { deleted: true } }` |
| `my_cloud:item_restored` | `{ data }` |
| `my_cloud:item_pinned` | `{ data }` |
| `my_cloud:stats_loaded` | `{ data }` |
| `my_cloud:search_result` | `{ data }` |
| `my_cloud:item_shared` | `{ data }` |
| `my_cloud:trash_emptied` | `{ data }` |
| `my_cloud:collection_created` | `{ data }` |
| `my_cloud:collection_updated` | `{ data }` |
| `my_cloud:collection_deleted` | `{ data: { deleted: true, collectionId } }` |
| `my_cloud:collections_listed` | `{ data }` |
| `my_cloud:collection_item_added` | `{ data: { success: true, collectionId, itemId } }` |
| `my_cloud:collection_item_removed` | `{ data: { success: true, collectionId, itemId } }` |

## Messaging Namespace `/messages`

The `/messages` namespace authenticates independently via `setupMessagesSocketAuth`. On connect it joins `user:${userId}` and `user_room:${userId}`. Its `heartbeat` and `ping` handlers only touch presence; unlike the root namespace, `/messages` does not emit a `pong` payload from these handlers.

### Client To Server

| Event | Payload | Success Ack |
| --- | --- | --- |
| `heartbeat` | ignored | none |
| `ping` | ignored | none |
| `joinGroup` | `{ conversationId }` | `{ success, message }` |
| `leaveGroup` | `{ conversationId }` | `{ success }` |
| `messageSeen` | `{ conversationId, lastSeenMessageId }` | `{ success }` |
| `messageDelivered` | `{ conversationId, lastDeliveredMessageId }` | `{ success }` |
| `typing:start` | `{ toUserId }` or `{ groupId }` | none |
| `typing:stop` | `{ toUserId }` or `{ groupId }` | none |
| `sendMessage` | `{ conversationId, text?, media?, ttlSeconds? }` | `{ success, messages }` |
| `editMessage` | `{ messageId, text }` | `{ success, message }` |
| `deleteMessage` | `{ messageId }` | `{ success }` |
| `revokeMessage` | `{ messageId }` | `{ success, message }` |
| `deleteMessageForEveryone` | `{ messageId }` | `{ success, message }` |
| `forwardMessages` | `{ messageIds, targetConversationIds }` | `{ success, messages }` |
| `quoteMessage` | `{ conversationId, quotedMessageId, text?, media? }` | `{ success, message }` |
| `addReaction` | `{ messageId, emoji }` | `{ success, reaction }` |
| `removeReaction` | `{ messageId, emoji? }` | `{ success, deletedCount }` |
| `markAllSeen` | `{ conversationId }` | `{ success }` |
| `dissolveGroup` | `{ groupId }` | `{ success }` |
| `pinConversation` | `{ conversationId }` | `{ success }` |
| `unpinConversation` | `{ conversationId }` | `{ success }` |
| `archiveConversation` | `{ conversationId }` | `{ success }` |
| `unarchiveConversation` | `{ conversationId }` | `{ success }` |
| `muteConversation` | `{ conversationId, muteUntil?, duration? }` | `{ success }` |
| `unmuteConversation` | `{ conversationId }` | `{ success }` |
| `pinMessage` | `{ messageId }` | `{ success, message }` |
| `unpinMessage` | `{ messageId }` | `{ success, message }` |
| `addMembers` | `{ groupId, memberIds }` | `{ success, newMembers }` |
| `removeMember` | `{ groupId, targetUserId }` | `{ success }` |
| `setAdmin` | `{ groupId, targetUserId, isAdmin }` | `{ success }` |
| `transferOwner` | `{ groupId, newOwnerId }` | `{ success }` |
| `approveMember` | `{ groupId, userIdToApprove }` | `{ success, member }` |
| `rejectMember` | `{ groupId, userIdToReject }` | `{ success }` |
| `updateGroupSettings` | `{ groupId, allowSendLink?, requireApproval?, allowMemberInvite?, whoCanSendMessages?, whoCanAddMembers?, utilityPermissions? }` | `{ success, conversation }` |
| `updateGroupInfo` | `{ groupId, name?, avatarUrl? }` | `{ success, conversation }` |
| `createPoll` | `{ conversationId, question, options, isMultipleChoice?, allowAddOption?, showResultsBeforeClose?, expiresAt? }` | `{ success, poll }` |
| `votePoll` | `{ pollId, optionIds }` | `{ success, poll }` |
| `closePoll` | `{ pollId }` | `{ success, poll }` |
| `pinPoll` | `{ pollId }` | `{ success, poll }` |
| `unpinPoll` | `{ pollId }` | `{ success, poll }` |
| `createReminder` | `{ conversationId, title, description?, remindAt }` | `{ success, reminder }` |
| `updateReminder` | `{ reminderId, title?, description?, remindAt?, status? }` | `{ success, reminder }` |
| `deleteReminder` | `{ reminderId, conversationId? }` | `{ success }` |
| `createNote` | `{ conversationId, title, content }` | `{ success, note }` |
| `updateNote` | `{ noteId, title?, content? }` | `{ success, note }` |
| `deleteNote` | `{ noteId, conversationId? }` | `{ success }` |
| `voice_message` | `{ conversationId, mediaUrl, duration? }` | `{ success, messages }` |
| `location_share` | `{ conversationId, latitude, longitude, accuracy? }` | `{ success }` |

`media` uses the current `MediaAttachment` contract:

```ts
type MediaAttachment = {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
};
```

### Server To Client

| Event | Payload |
| --- | --- |
| `user:online` | `{ userId, socketId, timestamp, visibility, isOnline, online, lastSeen }` |
| `user:offline` | `{ userId, timestamp, visibility, isOnline, online, lastSeen }` |
| `receiveMessage` | `{ message, conversationId }` |
| `message:edited` | `{ conversationId, message }` |
| `message:deleted` | `{ conversationId, messageId, deletedBy }` |
| `message:revoked` | `{ conversationId, messageId, revokedBy }` |
| `message:deleted_for_everyone` | `{ conversationId, messageId, deletedBy }` |
| `message:pinned` | `{ conversationId, message }` |
| `message:unpinned` | `{ conversationId, message }` |
| `message:quoted` | `{ conversationId, message, quotedMessageId }` |
| `message:reaction` | `{ messageId, reaction }` |
| `message:reaction:remove` | `{ messageId, userId, emoji? }` |
| `message:reactions:clear` | `{ messageId, userId }` when notifier is invoked |
| `message:reaction_summary` | `{ messageId, summary }` when notifier is invoked |
| `message:recall` | `{ messageId, recallBy }` when notifier is invoked |
| `message:edit_start` | `{ messageId, userId }` when notifier is invoked |
| `message:edit_end` | `{ messageId, userId }` when notifier is invoked |
| `messageSeen` | `{ conversationId, userId, lastSeenMessageId }` |
| `messageDelivered` | `{ conversationId, userId, lastDeliveredMessageId }` |
| `typing:start` | `{ userId, toUserId? }` or `{ userId, groupId }` |
| `typing:stop` | `{ userId, toUserId? }` or `{ userId, groupId }` |
| `conversation:created` | `{ conversation, systemMessage }` |
| `conversation:members_added` | `{ conversationId, newMembers, addedBy }` |
| `conversation:member_removed` | `{ conversationId, removedUserId, removedBy }` |
| `conversation:updated` | `{ conversationId, data }` when notifier is invoked |
| `conversation:pin_toggled` | `{ conversationId, pinnedBy, pinned }` |
| `conversation:archived_toggled` | `{ conversationId, userId, archived }` |
| `conversation:mute_changed` | `{ conversationId, userId, mutedBy, muted, muteUntil?, duration? }` |
| `group:member_left` | `{ conversationId, leftUserId, leftBy }` |
| `group:member_joined` | Defined in `SocketEvent`; no current emitter found in source |
| `group:dissolved` | `{ conversationId, dissolvedBy }` |
| `group:renamed` | `{ conversationId, newName, renamedBy }` |
| `group:avatar_changed` | `{ conversationId, avatarUrl, changedBy }` |
| `group:admin_changed` | `{ conversationId, targetUserId, isAdmin, changedBy }` |
| `group:owner_transferred` | `{ conversationId, oldOwnerId, newOwnerId }` |
| `group:member_approved` | `{ conversationId, userId, member, approvedBy }` |
| `group:member_rejected` | `{ conversationId, userId, rejectedBy }` |
| `group:settings_updated` | `{ conversationId, settings }` |
| `poll:new` | `{ conversationId, poll, createdBy }` |
| `poll:vote` | `{ conversationId, pollId, poll, votedBy }` |
| `poll:closed` | `{ conversationId, pollId, poll, closedBy }` |
| `poll:pinned` | `{ conversationId, pollId, poll, pinnedBy }` |
| `poll:unpinned` | `{ conversationId, pollId, poll, unpinnedBy }` |
| `group:reminder_created` | `{ conversationId, reminder, createdBy }` |
| `group:reminder_updated` | `{ conversationId, reminder, updatedBy }` |
| `group:reminder_deleted` | `{ conversationId, reminderId, deletedBy }` |
| `group:note_created` | `{ conversationId, note, createdBy }` |
| `group:note_updated` | `{ conversationId, note, updatedBy }` |
| `group:note_deleted` | `{ conversationId, noteId, deletedBy }` |
| `voice_message` | `{ message, conversationId }` |
| `location_share` | `{ conversationId, userId, location: { latitude, longitude, accuracy? } }` |
| `online_status` | `{ userId, isOnline }` when notifier is invoked |
| `user_presence` | `{ userId, lastSeen }` when notifier is invoked |

## Call Namespace `/socket/calls`

Legacy call socket used by the v1 call controller. It authenticates with the shared JWT token sources and joins `user:${userId}`.

| Client Event | Payload | Server Event |
| --- | --- | --- |
| `call:join` | `{ callId }` | `call:joined` with `{ callId }` |
| `call:leave` | `{ callId }` | none |

| Server Notification | Payload |
| --- | --- |
| `call:incoming` | Call payload from controller |
| `call:ringing` | `{ callId }` |
| `call:answered` | `{ callId, roomName, token?, wsUrl?, livekitProvider? }` |
| `call:rejected` | `{ callId }` |
| `call:ended` | `{ callId }` |
| `call:missed` | `{ callId }` |

## Call Namespace `/v2/calls`

Current LiveKit cloud call socket. It authenticates with the shared JWT token sources and joins `user:${userId}`.

| Client Event | Payload | Server Event |
| --- | --- | --- |
| `call:join` | `{ callId }` | `call:joined` with `{ callId, socketOnly: true }` |
| `call:leave` | `{ callId }` | none |

| Server Notification | Payload |
| --- | --- |
| `call:incoming` | Call payload from controller |
| `call:ongoing` | Call payload from controller |
| `call:joined` | Join payload from service/controller |
| `call:left` | Leave payload from service/controller |
| `call:declined` | Decline payload from service/controller |
| `call:missed` | Missed payload from service/controller |
| `call:busy` | Busy payload from service/controller |
| `call:ended` | End payload from service/controller |

## Friends Namespace `/friends`

Authenticated notification namespace for friend request and friendship events.

| Client Event | Payload | Server Event |
| --- | --- | --- |
| `ping` | ignored | `pong` with no payload |

| Server Event | Payload |
| --- | --- |
| `friend_request:received` | `{ type: "FRIEND_REQUEST_RECEIVED", data, timestamp }` |
| `friend_request:accepted` | `{ type: "FRIEND_REQUEST_ACCEPTED", data, timestamp }` |
| `friend_request:rejected` | `{ type: "FRIEND_REQUEST_REJECTED", data, timestamp }` |
| `friend_request:canceled` | `{ type: "FRIEND_REQUEST_CANCELED", data, timestamp }` |
| `friendship:unfriended` | `{ type: "UNFRIENDED", data, timestamp }` |
| `block:detected` | `{ type: "BLOCK_DETECTED", data: { direction, blockedUserId?, blockerId? }, timestamp }` |

## Blocks Namespace `/blocks`

Authenticated notification namespace for block and unblock events.

| Client Event | Payload | Server Event |
| --- | --- | --- |
| `ping` | ignored | `pong` with no payload |

| Server Event | Payload |
| --- | --- |
| `block:blocked` | `{ type: "USER_BLOCKED", data: { blockedBy }, timestamp }` |
| `block:unblocked` | `{ type: "USER_UNBLOCKED", data: { unblockedBy }, timestamp }` |

## Integration Notes

- Use `/messages` for chat business events. Root `messageSeen`, `messageDelivered`, and typing events only update activity tracking.
- Use root `subscribeConversation` or `/messages` `joinGroup` when the client wants room-based broadcasts. Both join `group:${conversationId}` and `group_room:${conversationId}`.
- Most `/messages` write operations require active conversation membership and return `{ success: false, error }` on authorization, validation, or rate-limit failure.
- `sendMessage`, `forwardMessages`, `quoteMessage`, and `voice_message` can create multiple messages; consume the returned `messages` array and the `receiveMessage` broadcasts.
- `voice_message` currently accepts `{ mediaUrl, duration? }` and internally converts it to a `MediaAttachment` with `audio/webm`.
- `location_share` broadcasts a location event only; it does not create a chat message row in the current handler.
