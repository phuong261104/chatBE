## SOCKET_SPEC (generated)

Tài liệu tóm tắt các event Socket.IO chính (dựa trên scan mã nguồn trong `src/modules/*/infras/transport/socket`).

Auth: socket handshake yêu cầu JWT (middleware `authenticateSocketConnection` / `io.use(authenticateSocketConnection)`).

Namespaces:

- Default namespace (root) — bootstrapped in `src/share/component/socket-io.ts` — emits `connected` after handshake.
- Chat namespace: implemented under `src/modules/chat/infras/transport/socket` (may be `/messages` or root depending on configuration)
- AI namespace: `/ai` (events for ai features)

Common client -> server events

- `heartbeat` — payload: none. Keepalive.
- `ping` — payload: none. Server replies `pong` with timestamp/status.
- `subscribeConversation` — payload: { conversationId: string } — server will add socket to conversation room and callback with status.
- `unsubscribeConversation` — payload: { conversationId: string } — remove from room.
- `getOnlineStatus` — payload: { userId: string } — callback returns online state.
- `getBatchOnlineStatus` — payload: { userIds: string[] } — callback returns statuses.

Chat events (Client -> Server)

- `sendMessage` — payload: SendMessageRequest + optional clientMessageId. callback: created message or error.
- `editMessage` — payload: { messageId, text } — callback: updated message.
- `deleteMessage` — payload: { messageId } — callback: status.
- `revokeMessage` — payload: { messageId } — callback: status.
- `messageSeen` — payload: { conversationId, lastSeenMessageId } — broadcast to conversation/user rooms.
- `messageDelivered` — payload: { conversationId, lastDeliveredMessageId } — broadcast.
- `typing:start` — payload: { conversationId, toUserId?, groupId? } — server emit TYPING_START
- `typing:stop` — payload: same — server emit TYPING_STOP

Chat events (Server -> Client)

- `connected` — payload: { socketId, serverTime, sessionId, features? }
- `pong` — response to `ping`.
- `receiveMessage` — payload: Message — sent to user and group rooms.
- `message:edited` — payload: { messageId, updatedFields }
- `message:deleted` — payload: { messageId, deletedFor: [userId] }
- `message:revoked` — payload: { messageId }
- `message:deleted_for_everyone` — payload: { messageId }
- `online_status` / `ONLINE_STATUS` — payload: { userId, isOnline }
- `user_presence` / `USER_PRESENCE` — payload: { userId, lastSeen }
- `session:revoked` — payload: { deviceId?, reason }
- Typing events: `typing:start`, `typing:stop` forwarded to target rooms

Group / Poll / Utilities events

- Client -> Server:
  - `joinGroup`, `leaveGroup`, `addMembers`, `removeMember`, `setAdmin`, `transferOwner`, `createPoll`, `votePoll`, `addPollOption`, `pinPoll`, `unpinPoll`, `createReminder`, `updateReminder`, `deleteReminder`, `pinReminder`, `unpinReminder`, `createNote`, `getGroupInviteLink`, `regenerateGroupInviteLink`, `revokeGroupInviteLink`, `joinGroupByInvite`, `blockGroupMember`, `unblockGroupMember`.
- Server -> Client (examples):
  - `conversation:members_added`, `group:member_left`, `group:settings_updated`, `poll:new`, `poll:vote`, `poll:option_added`, `poll:closed`, `poll:pinned`, `poll:unpinned`, `group:reminder_created`, `group:reminder_updated`, `group:reminder_deleted`, `group:reminder_pinned`, `group:reminder_unpinned`, `group:reminder_due`, `group:note_created`, `group:member_joined`, `group:member_join_requested`, `group:invite_link_updated`, `group:invite_link_revoked`, `group:member_blocked`, `group:member_unblocked`.

Call events (real-time calling)

- Server -> Client: `call:incoming`, `call:ringing`, `call:answered`, `call:rejected`, `call:ended`, `call:missed`
- Client -> Server: `call:join`, `call:leave`, `call:reject`, `call:end`

AI namespace events (`/ai`)

- Client -> Server: `ai:summarize`, `ai:smart_reply`, `ai:tone_adjust`, `ai:translate`, `ai:smart_search`, `ai:extract_tasks`, `ai:moderate`.
- Server emits `ai:result` or `ai:error` as response events.

Rooms / naming conventions

- Conversation rooms: `group_room:{groupId}` for group broadcasts and `user_room:{userId}` or `user:{userId}` for per-user rooms. See `connection.handlers.ts` and `notifiers.ts`.
- Namespace-to-room patterns used in code: `this.namespace.to('user:' + userId)`, `this.namespace.to('group:' + conversationId)`, `user_room:${toUserId}`, `group_room:${groupId}`.

Callbacks and ack pattern

- Many events accept an optional callback `(response) => void` which server calls with `{ status, msg, data }` envelope. Tests and helpers frequently use `socket.emit(event, payload, cb)`.

Errors

- Socket errors are either sent via callback with error envelope or emitted as `error`/`<feature>:error` events.

---

## Sources in code

- Handlers register: `src/modules/chat/infras/transport/socket/register-handlers.ts`
- Connection logic: `src/modules/chat/infras/transport/socket/connection.handlers.ts`
- Notifiers (server emits): `src/modules/chat/infras/transport/socket/notifiers.ts`
- Global socket boot: `src/share/component/socket-io.ts`

Generated: automated scan of project. Nếu bạn muốn tài liệu chi tiết payload schemas, tôi có thể trích `dto.ts` tương ứng và mở rộng từng event.
