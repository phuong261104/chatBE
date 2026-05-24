# Socket.IO Events Reference

Updated: 2026-05-15

---

## Overview

The server uses Socket.IO with multiple namespaces. All connections require JWT authentication via `handshake.auth.token` or `handshake.query.token`.

---

## Namespaces

| Namespace | Purpose | Mount Point |
|---|---|---|
| `/socket.io` (root) | Connection lifecycle, presence, core events, My Cloud realtime actions | `/socket.io` |
| `/messages` | Chat messaging, reactions, groups, typing | `/socket.io/messages` |
| `/user` | User presence, heartbeat | `/socket.io/user` |
| `/v1/calls` | Call events (LiveKit cloud) | `/socket.io/v1/calls` |
| `/friends` | Friend request notifications | `/socket.io/friends` |
| `/blocks` | Block notifications | `/socket.io/blocks` |

---

## Root Namespace (`/`)

Core events for connection management, presence, and conversation subscriptions.

### Client -> Server (Incoming)

| Event | Payload | Description |
|---|---|---|
| `ping` | — | Heartbeat. Server responds with `pong`. |
| `subscribeConversation` | `{ conversationId: string }` | Join conversation room `group:{conversationId}` |
| `unsubscribeConversation` | `{ conversationId: string }` | Leave conversation room |
| `getOnlineStatus` | `{ userId: string }` | Check if a specific user is online |
| `getBatchOnlineStatus` | `{ userIds: string[] }` | Check online status for multiple users |
| `typing:start` | `any` | Typing indicator start |
| `typing:stop` | `any` | Typing indicator stop |
| `messageSeen` | `any` | Mark message as seen |
| `messageDelivered` | `any` | Mark message as delivered |

### Server -> Client (Outgoing)

| Event | Payload | Description |
|---|---|---|
| `connected` | `{ socketId, userId, connectionState, timestamp, activeConnections, reconnectAttempts, serverTime, heartbeatConfig }` | Connection confirmed |
| `pong` | `{ timestamp, serverTime, latency }` | Heartbeat response |
| `user:online` | `{ userId, socketId, timestamp }` | A user came online |
| `user:offline` | `{ userId, timestamp, reason }` | A user went offline |

### Connection Flow

```
Client connects (with JWT token)
  -> Server authenticates token
  -> Server emits: connected { socketId, userId, ... }
  -> Server emits: user:online { userId, socketId, timestamp } (to other clients)
```

### Rooms Joined Automatically

On connection, the socket automatically joins:
- `user:{userId}` — personal room
- `user_room:{userId}` — personal room (alias)

### Rate Limits

Heartbeat/activity events (`typing:start`, `messageSeen`, etc.) should be debounced client-side. No strict server-side rate limit on root namespace events.

### My Cloud Events On Root Namespace

My Cloud socket events are registered on the root namespace by `src/modules/my-cloud/infras/transport/socket-service.ts`.
REST remains the primary integration surface for My Cloud; these events are optional realtime equivalents.

Client -> Server:

| Event | Description |
|---|---|
| `my_cloud:load` | Load items |
| `my_cloud:create` | Create item |
| `my_cloud:update` | Update item |
| `my_cloud:delete` | Soft delete item |
| `my_cloud:restore` | Restore item |
| `my_cloud:pin` | Pin/unpin item |
| `my_cloud:stats` | Load stats |
| `my_cloud:search` | Search items |
| `my_cloud:share` | Share item |
| `my_cloud:empty_trash` | Empty trash |
| `my_cloud:collection_create` | Create collection |
| `my_cloud:collection_update` | Update collection |
| `my_cloud:collection_delete` | Delete collection |
| `my_cloud:collections_list` | List collections |
| `my_cloud:collection_add_item` | Add item to collection |
| `my_cloud:collection_remove_item` | Remove item from collection |

Server -> Client:

| Event | Description |
|---|---|
| `my_cloud:items_loaded` | Items loaded |
| `my_cloud:item_created` | Item created |
| `my_cloud:item_updated` | Item updated |
| `my_cloud:item_deleted` | Item deleted |
| `my_cloud:item_restored` | Item restored |
| `my_cloud:item_pinned` | Item pinned/unpinned |
| `my_cloud:stats_loaded` | Stats loaded |
| `my_cloud:search_result` | Search result |
| `my_cloud:item_shared` | Item shared |
| `my_cloud:trash_emptied` | Trash emptied |
| `my_cloud:collection_created` | Collection created |
| `my_cloud:collection_updated` | Collection updated |
| `my_cloud:collection_deleted` | Collection deleted |
| `my_cloud:collections_listed` | Collections listed |
| `my_cloud:collection_item_added` | Item added to collection |
| `my_cloud:collection_item_removed` | Item removed from collection |

---

## `/messages` Namespace

Chat messaging namespace. Requires JWT authentication via middleware.

### Rate Limits (per user per minute)

| Event | Limit |
|---|---|
| `sendMessage` | 60/min |
| `addReaction` | 60/min |
| `quoteMessage` | 60/min |
| `typing:start` | 30/min |
| `editMessage` | 30/min |
| `deleteMessage` | 30/min |
| `forwardMessages` | 30/min |

### Client -> Server (Incoming)

#### Messaging

| Event | Payload | Description |
|---|---|---|
| `sendMessage` | `{ conversationId, text?, media?, type?, ttlSeconds?, quotedMessageId?, forwardedFromMessageIds? }` | Send message. `ttlSeconds` enables self-destruct. |
| `editMessage` | `{ messageId, text }` | Edit message text (within 30s) |
| `deleteMessage` | `{ messageId }` | Delete message for self |
| `revokeMessage` | `{ messageId }` | Delete message for everyone |
| `deleteMessageForEveryone` | `{ messageId }` | Alias for revoke |
| `forwardMessages` | `{ messageIds, targetConversationIds }` | Forward messages to one or more conversations |
| `quoteMessage` | `{ conversationId, text, quotedMessageId, media? }` | Send a reply that quotes another message |

#### Reactions

| Event | Payload | Description |
|---|---|---|
| `addReaction` | `{ messageId, emoji }` | Add emoji reaction to message |
| `removeReaction` | `{ messageId, emoji }` | Remove emoji reaction |

#### Status

| Event | Payload | Description |
|---|---|---|
| `messageSeen` | `{ conversationId, messageId }` | Mark message as seen |
| `messageDelivered` | `{ conversationId, messageId }` | Mark message as delivered |
| `markAllSeen` | `{ conversationId }` | Mark all messages in conversation as seen |
| `typing:start` | `{ conversationId }` | User started typing |
| `typing:stop` | `{ conversationId }` | User stopped typing |

#### Group Management

| Event | Payload | Description |
|---|---|---|
| `joinGroup` | `{ conversationId }` | Join group conversation room |
| `leaveGroup` | `{ conversationId }` | Leave group conversation room |
| `addMembers` | `{ conversationId, memberIds }` | Add members to group (must be active friends) |
| `removeMember` | `{ conversationId, userId }` | Remove member from group |
| `setAdmin` | `{ conversationId, userId, isAdmin }` | Promote/demote member to admin |
| `transferOwner` | `{ conversationId, newOwnerId }` | Transfer group ownership |
| `dissolveGroup` | `{ conversationId }` | Dissolve/delete group |
| `approveMember` | `{ conversationId, userId }` | Approve pending member |
| `rejectMember` | `{ conversationId, userId }` | Reject pending member |

#### Conversation Actions

| Event | Payload | Description |
|---|---|---|
| `pinConversation` | `{ conversationId }` | Pin conversation |
| `unpinConversation` | `{ conversationId }` | Unpin conversation |
| `archiveConversation` | `{ conversationId }` | Archive conversation |
| `unarchiveConversation` | `{ conversationId }` | Unarchive conversation |
| `muteConversation` | `{ conversationId }` | Mute conversation |
| `unmuteConversation` | `{ conversationId }` | Unmute conversation |

#### Message Actions

| Event | Payload | Description |
|---|---|---|
| `pinMessage` | `{ messageId }` | Pin message in conversation |
| `unpinMessage` | `{ messageId }` | Unpin message |

#### Polls

| Event | Payload | Description |
|---|---|---|
| `createPoll` | `{ conversationId, question, options, allowMultipleVotes, expiresIn }` | Create poll |
| `votePoll` | `{ pollId, optionIds }` | Vote on poll |

#### Media

| Event | Payload | Description |
|---|---|---|
| `voice_message` | `{ conversationId, text?, media }` | Send voice message |
| `location_share` | `{ conversationId, latitude, longitude, placeName? }` | Share location |

### Server -> Client (Outgoing)

#### Message Events

| Event | Payload | Description |
|---|---|---|
| `receiveMessage` | `Message` | New message received |
| `message:edited` | `{ messageId, text, editedAt }` | Message was edited |
| `message:deleted` | `{ messageId, conversationId }` | Message deleted for me |
| `message:revoked` | `{ messageId, conversationId }` | Message revoked/deleted for everyone |
| `message:deleted_for_everyone` | `{ messageId, conversationId }` | Alias for revoked |
| `message:reaction` | `{ messageId, reaction }` | Reaction added |
| `message:reaction:remove` | `{ messageId, userId, emoji }` | Reaction removed |
| `message:reactions:clear` | `{ messageId }` | All reactions cleared |
| `message:pinned` | `{ messageId, conversationId }` | Message pinned |
| `message:unpinned` | `{ messageId, conversationId }` | Message unpinned |
| `message:quoted` | `{ messageId, conversationId, quotedMessage }` | Quote reply received |
| `message:reaction_summary` | `{ messageId, reactions }` | Summary of all reactions |
| `message:recall` | `{ messageId, conversationId }` | Message recalled |
| `message:edit_start` | `{ messageId, editorId }` | Someone started editing |
| `message:edit_end` | `{ messageId, editorId }` | Someone finished editing |
| `voice_message` | `{ message }` | Voice message received |
| `location_share` | `{ message }` | Location share received |

#### Conversation Events

| Event | Payload | Description |
|---|---|---|
| `conversation:created` | `{ conversation }` | New conversation created |
| `conversation:updated` | `{ conversationId, changes }` | Conversation metadata updated |
| `conversation:members_added` | `{ conversationId, members }` | Members added |
| `conversation:member_removed` | `{ conversationId, userId, removedBy }` | Member removed |
| `conversation:pin_toggled` | `{ conversationId, pinned }` | Pin status changed |
| `conversation:archived_toggled` | `{ conversationId, archived }` | Archive status changed |
| `conversation:mute_changed` | `{ conversationId, muted }` | Mute status changed |

#### Group Events

| Event | Payload | Description |
|---|---|---|
| `group:member_left` | `{ conversationId, userId }` | Member left group |
| `group:member_joined` | `{ conversationId, userId }` | Member joined group |
| `group:dissolved` | `{ conversationId }` | Group dissolved |
| `group:renamed` | `{ conversationId, name, changedBy }` | Group name changed |
| `group:avatar_changed` | `{ conversationId, avatarUrl, changedBy }` | Group avatar changed |
| `group:admin_changed` | `{ conversationId, userId, isAdmin }` | Admin status changed |
| `group:owner_transferred` | `{ conversationId, newOwnerId }` | Ownership transferred |
| `group:member_approved` | `{ conversationId, userId }` | Pending member approved |
| `group:member_rejected` | `{ conversationId, userId }` | Pending member rejected |
| `group:settings_updated` | `{ conversationId, settings }` | Group settings updated |

#### Poll Events

| Event | Payload | Description |
|---|---|---|
| `poll:new` | `{ poll, message }` | New poll created |
| `poll:vote` | `{ pollId, voterId, optionIds, results }` | Vote cast on poll |
| `poll:closed` | `{ pollId }` | Poll closed/expired |

#### Presence Events

| Event | Payload | Description |
|---|---|---|
| `online_status` | `{ userId, isOnline }` | User online status |
| `user_presence` | `{ userId, lastSeen }` | User presence (last seen) |
| `user:online` | `{ userId, socketId, timestamp }` | User online (relayed) |
| `user:offline` | `{ userId, timestamp }` | User offline (relayed) |

---

## `/v1/calls` Namespace

Call namespace using LiveKit cloud infrastructure.

### Client -> Server (Incoming)

| Event | Payload | Description |
|---|---|---|
| `call:join` | `{ callId: string }` | Join a call room |
| `call:leave` | `{ callId: string }` | Leave a call room |

### Server -> Client (Outgoing)

| Event | Payload | Description |
|---|---|---|
| `call:incoming` | `callData` | Incoming call notification |
| `call:ongoing` | `callData` | Call is already in progress (for re-connect) |
| `call:joined` | `{ callId, socketOnly?: true, conversationId?, userId?, status?, participant? }` | Socket room join acknowledgement or participant joined |
| `call:left` | `payload` | Left the call room |
| `call:declined` | `payload` | Call was declined |
| `call:missed` | `payload` | Call was missed |
| `call:busy` | `payload` | User is busy |
| `call:ended` | `payload` | Call ended |

### Call Flow

```
1. Caller: POST /v1/calls -> creates call -> server emits call:incoming to callees
2. Callee: receives call:incoming
3. Callee: socket.emit("call:join", { callId }) -> server emits call:joined
4. Callee: POST /v1/calls/{callId}/join -> gets LiveKit token
5. Either: socket.emit("call:leave") or DELETE /v1/calls/{callId} -> server emits call:ended
```

---


## `/friends` Namespace

Friend request and friendship events.

### Client -> Server

| Event | Description |
|---|---|
| `ping` | Heartbeat |

### Server -> Client

| Event | Payload | Description |
|---|---|---|
| `friend_request:received` | `{ type, data, timestamp }` | Received a friend request |
| `friend_request:accepted` | `{ type, data, timestamp }` | Friend request accepted |
| `friend_request:rejected` | `{ type, data, timestamp }` | Friend request rejected |
| `friend_request:canceled` | `{ type, data, timestamp }` | Friend request canceled |
| `friendship:unfriended` | `{ type, data, timestamp }` | User was unfriended |
| `block:detected` | `{ type, data, timestamp }` | A block was detected (mutual) |

---

## `/blocks` Namespace

Block notification events.

### Client -> Server

| Event | Description |
|---|---|
| `ping` | Heartbeat |

### Server -> Client

| Event | Payload | Description |
|---|---|---|
| `block:blocked` | `{ type, data, timestamp }` | User was blocked |
| `block:unblocked` | `{ type, data, timestamp }` | User was unblocked |

---

## `/user` Namespace

User presence namespace. Requires authentication.

### Client -> Server

| Event | Payload | Description |
|---|---|---|
| `heartbeat` | — | Update last seen timestamp for the user |

### Behavior

On connection, automatically calls `presenceUseCase.touchSocket(userId, default:{socketId})`.

---

## Room Naming Conventions

| Room Pattern | Purpose | Used By |
|---|---|---|
| `user:{userId}` | Personal user room | Root namespace (auto-joined) |
| `user_room:{userId}` | Personal user room (alias) | Root namespace (auto-joined) |
| `group:{conversationId}` | Conversation room | Root (via subscribeConversation) |
| `group_room:{conversationId}` | Conversation room (alias) | Root (via subscribeConversation) |
| `default:{socketId}` | Per-socket presence tracking | User namespace |
| `messages:{socketId}` | Per-socket messages | Messages namespace |

---

## Authentication

All Socket.IO connections require JWT token authentication:

```typescript
// Option 1: handshake.auth.token
const socket = io("/", {
  auth: { token: "Bearer <jwt>" }
});

// Option 2: query parameter
const socket = io("/", {
  query: { token: "Bearer <jwt>" }
});

// Option 3: Authorization header (via proxy)
const socket = io("/", {
  extraHeaders: { Authorization: "Bearer <jwt>" }
});
```

JWT payload must contain `sub` field (user ID).

---

## Error Handling

| Error | Description |
|---|---|
| `Authentication error: No token provided` | No token in auth/query/headers |
| `Authentication error: Invalid token` | Token verification failed |

On authentication failure, the socket connection is rejected with the error message.

---

## Connection Lifecycle

```
1. CONNECTING: Client initiates WebSocket
2. AUTHENTICATING: Server validates JWT
3. CONNECTED: Server emits "connected" with socket metadata
4. ACTIVE: Normal event exchange
5. RECONNECTING: Connection dropped, client retries
6. DISCONNECTED: Server cleans up registry, emits user:offline if last connection
```

---

## Implementation Files

| File | Namespace | Description |
|---|---|---|
| `src/share/component/socket-io.ts` | `/` (root) | Main Socket.IO server, auth, connection registry |
| `src/modules/chat/infras/transport/socket-service.ts` | `/messages` | Messaging socket service |
| `src/modules/user/infras/transport/socket-service.ts` | `/user` | User presence socket service |
| `src/modules/call/infras/transport/call-v2-socket.service.ts` | `/v1/calls` | Call service |
| `src/modules/friend-requests/infras/transport/socket-service.ts` | `/friends` | Friend request notifications |
| `src/modules/blocks/infras/transport/socket-service.ts` | `/blocks` | Block notifications |
| `src/modules/my-cloud/infras/transport/socket-service.ts` | `/` (root) | My Cloud realtime actions |
| `src/modules/chat/constants/socket-events.ts` | — | Socket event name constants |
| `src/modules/my-cloud/constants/socket-events.ts` | — | My Cloud socket event constants |
