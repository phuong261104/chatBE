# Socket.IO Events Overview

This is the quick map of public Socket.IO namespaces and event names. For full
payload details, use `docs/SOCKET_IO_BACKEND_REFERENCE.md`.

Checked against:

- `src/share/component/socket-io.ts`
- `src/modules/chat/constants/socket-events.ts`
- `src/modules/chat/infras/transport/socket/*`
- `src/modules/call/infras/transport/call-v2-socket.service.ts`
- `src/modules/friend-requests/infras/transport/socket-service.ts`
- `src/modules/blocks/infras/transport/socket-service.ts`

## Connection

- Socket.IO path: `/socket.io`
- Token sources: `handshake.auth.token`, `handshake.query.token`, or `Authorization: Bearer <jwt>`
- Optional metadata: `deviceId`, `platform`
- Successful root connection emits `connected`
- There is no dedicated `/user` namespace in current source; user heartbeat is handled on the root namespace through `heartbeat`

## Namespaces

| Namespace | Purpose | Main implementation |
| --- | --- | --- |
| `/` | Connection lifecycle, presence helpers | `src/share/component/socket-io.ts`, `src/modules/user/infras/transport/socket-service.ts` |
| `/messages` | Chat messages, read state, typing, groups, polls, reminders, notes | `src/modules/chat/infras/transport/socket-service.ts` |
| `/v1/calls` | Current LiveKit cloud call socket | `src/modules/call/infras/transport/call-v2-socket.service.ts` |
| `/friends` | Friend request and friendship notifications | `src/modules/friend-requests/infras/transport/socket-service.ts` |
| `/blocks` | Block/unblock notifications | `src/modules/blocks/infras/transport/socket-service.ts` |

## Root Namespace `/`

Root events are for presence and connection state.
Do not use root `messageSeen`, `messageDelivered`, or typing events for chat
business logic; they only touch activity/presence.

### Client -> Server

| Event | Payload | Notes |
| --- | --- | --- |
| `ping` | optional | Server emits `pong` with timestamp/server time/latency |
| `heartbeat` | ignored | Touches presence only |
| `subscribeConversation` | `{ conversationId }` | Joins `group:{conversationId}` and `group_room:{conversationId}` |
| `unsubscribeConversation` | `{ conversationId }` | Leaves both conversation rooms |
| `getOnlineStatus` | `{ userId }` | Ack returns online visibility fields |
| `getBatchOnlineStatus` | `{ userIds }` | Ack returns `statuses` |
| `typing:start` | any | Presence touch only |
| `typing:stop` | any | Presence touch only |

### Server -> Client

| Event | Payload |
| --- | --- |
| `connected` | `{ socketId, userId, connectionState, timestamp, activeConnections, reconnectAttempts, serverTime, heartbeatConfig }` |
| `pong` | `{ timestamp, serverTime, latency }` |
| `user:online` | `{ userId, socketId, timestamp, visibility, isOnline, online, lastSeen }` |
| `user:offline` | `{ userId, timestamp, reason?, visibility, isOnline, online, lastSeen }` |
| `session:revoked` | `{ userId, deviceId, reason, timestamp }` |

## Messages Namespace `/messages`

Business handlers use ack shape `{ success: true, ...data }` or
`{ success: false, error }`.

### Client -> Server

| Area | Events |
| --- | --- |
| Connection/status | `heartbeat`, `ping`, `joinGroup`, `leaveGroup`, `messageSeen`, `messageDelivered`, `markAllSeen`, `typing:start`, `typing:stop` |
| Message lifecycle | `sendMessage`, `editMessage`, `deleteMessage`, `revokeMessage`, `deleteMessageForEveryone`, `forwardMessages`, `quoteMessage`, `pinMessage`, `unpinMessage` |
| Reactions | `addReaction`, `removeReaction` |
| Conversation actions | `pinConversation`, `unpinConversation`, `archiveConversation`, `unarchiveConversation`, `muteConversation`, `unmuteConversation` |
| Group membership/settings | `addMembers`, `removeMember`, `setAdmin`, `transferOwner`, `approveMember`, `rejectMember`, `updateGroupSettings`, `updateGroupInfo`, `dissolveGroup` |
| Polls | `createPoll`, `votePoll`, `closePoll`, `pinPoll`, `unpinPoll` |
| Utilities | `createReminder`, `updateReminder`, `deleteReminder`, `createNote`, `updateNote`, `deleteNote` |
| Special media | `voice_message`, `location_share` |

Key payload names:

| Event | Required payload |
| --- | --- |
| `messageSeen` | `{ conversationId, lastSeenMessageId }` |
| `messageDelivered` | `{ conversationId, lastDeliveredMessageId }` |
| `typing:start`, `typing:stop` | `{ toUserId }` for private typing, or `{ groupId }` for group typing |
| `sendMessage` | `{ conversationId, text?, media?, ttlSeconds?, clientMessageId? }` |
| `quoteMessage` | `{ conversationId, quotedMessageId, text?, media? }` |
| `addMembers` | `{ groupId, memberIds }` |
| `removeMember` | `{ groupId, targetUserId }` |
| `setAdmin` | `{ groupId, targetUserId, isAdmin }` |
| `transferOwner` | `{ groupId, newOwnerId }` |
| `approveMember` | `{ groupId, userIdToApprove }` |
| `rejectMember` | `{ groupId, userIdToReject }` |
| `updateGroupSettings` | `{ groupId, allowSendLink?, requireApproval?, allowMemberInvite?, whoCanSendMessages?, whoCanAddMembers?, utilityPermissions? }` |
| `updateGroupInfo` | `{ groupId, name?, avatarUrl? }` |
| `createPoll` | `{ conversationId, question, options, isMultipleChoice?, allowAddOption?, showResultsBeforeClose?, expiresAt? }` |
| `votePoll` | `{ pollId, optionIds }` |
| `closePoll`, `pinPoll`, `unpinPoll` | `{ pollId }` |
| `createReminder` | `{ conversationId, title, description?, remindAt }` |
| `updateReminder` | `{ reminderId, title?, description?, remindAt?, status? }` |
| `deleteReminder` | `{ reminderId, conversationId? }` |
| `createNote` | `{ conversationId, title, content }` |
| `updateNote` | `{ noteId, title?, content? }` |
| `deleteNote` | `{ noteId, conversationId? }` |
| `voice_message` | `{ conversationId, mediaUrl, duration? }` |
| `location_share` | `{ conversationId, latitude, longitude, accuracy? }` |

### Server -> Client

| Area | Events |
| --- | --- |
| Message lifecycle | `receiveMessage`, `message:edited`, `message:deleted`, `message:revoked`, `message:deleted_for_everyone`, `message:pinned`, `message:unpinned`, `message:quoted` |
| Reactions | `message:reaction`, `message:reaction:remove`, `message:reactions:clear`, `message:reaction_summary` |
| Status/typing/presence | `messageSeen`, `messageDelivered`, `typing:start`, `typing:stop`, `user:online`, `user:offline`, `online_status`, `user_presence` |

`clientMessageId` on `sendMessage` is idempotent per
`{conversationId, senderId, clientMessageId}`. `messageSeen` and
`messageDelivered` broadcasts include read-state fields and are also emitted to
the actor user room so multiple tabs for the same user stay in sync.
| Conversation/group | `conversation:created`, `conversation:members_added`, `conversation:member_removed`, `conversation:updated`, `conversation:pin_toggled`, `conversation:archived_toggled`, `conversation:mute_changed`, `group:member_left`, `group:dissolved`, `group:renamed`, `group:avatar_changed`, `group:admin_changed`, `group:owner_transferred`, `group:member_approved`, `group:member_rejected`, `group:settings_updated` |
| Polls/utilities | `poll:new`, `poll:vote`, `poll:closed`, `poll:pinned`, `poll:unpinned`, `group:reminder_created`, `group:reminder_updated`, `group:reminder_deleted`, `group:note_created`, `group:note_updated`, `group:note_deleted` |
| Special media/notifier-only | `voice_message`, `location_share`, `message:recall`, `message:edit_start`, `message:edit_end` |

Notes:

- `group:member_joined` exists in `SocketEvent` constants, but no current emitter was found.
- `message:reaction_summary`, `message:recall`, `message:edit_start`, and `message:edit_end` are notifier methods; they are emitted only if a service path calls those notifiers.
- Direct socket `deleteMessage` emits `message:deleted` only to the deleting user. The notifier method can broadcast `message:deleted` when another path invokes it.

## Calls Namespace `/v1/calls`

| Direction | Events |
| --- | --- |
| Client -> Server | `call:join`, `call:leave` |
| Server -> Client | `call:incoming`, `call:ongoing`, `call:joined`, `call:left`, `call:declined`, `call:missed`, `call:busy`, `call:ended` |

## Friends Namespace `/friends`

| Direction | Events |
| --- | --- |
| Client -> Server | `ping` |
| Server -> Client | `pong`, `friend_request:received`, `friend_request:accepted`, `friend_request:rejected`, `friend_request:canceled`, `friendship:unfriended`, `block:detected` |

## Blocks Namespace `/blocks`

| Direction | Events |
| --- | --- |
| Client -> Server | `ping` |
| Server -> Client | `pong`, `block:blocked`, `block:unblocked` |

## Related Docs

- `docs/SOCKET_IO_BACKEND_REFERENCE.md`
- `docs/SOCKET_IO_CHAT_EVENTS_CHECKLIST.md`
- `docs/SOCKET_IO_FRIENDS_BLOCKS_REFERENCE.md`
