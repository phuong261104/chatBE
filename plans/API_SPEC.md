## API_SPEC (generated)

Tài liệu này là bản tóm tắt các REST API chính của backend (dựa trên scan mã nguồn và file OpenAPI hiện có).

Base URL: `/v1` (ví dụ local: `http://localhost:3000/v1`)

Auth: hầu hết endpoints yêu cầu header

- Authorization: `Bearer <accessToken>`
- Device/session headers (tuỳ endpoint): `x-device-id`, `x-device-type`, `x-device-platform`, `x-display-label`, `x-device-location`, `user-agent`

Response envelope (middleware `response-format`):

```
{
  "status": "success" | "error",
  "msg": "...",
  "data": ...,
  "meta": ...
}
```

---

## Chính (tóm tắt endpoints)

1. Auth

- POST /v1/auth/register — đăng ký
- POST /v1/auth/login — login, trả access/refresh token
- POST /v1/auth/refresh — refresh token
- POST /v1/auth/logout — logout current session
- POST /v1/auth/logout-all — revoke all sessions
- GET /v1/auth/sessions — list sessions
- DELETE /v1/auth/sessions/{deviceId} — revoke device

2. Users

- GET /v1/users — list users (page/limit)
- POST /v1/users — create (admin)
- GET /v1/users/{id} — detail
- PATCH /v1/users/{id} — update
- GET /v1/users/me/profile — my profile
- PATCH /v1/users/me/profile — update my profile
- GET /v1/users/me/avatar-history — avatar history
- GET /v1/users/search — search users (query params / privacy applied)
- GET /v1/users/search-by-phone — search by phone
- GET /v1/users/{id}/presence — presence

3. Chat / Conversations

- POST /v1/conversations/private — get or create private conversation (body: { targetUserId })
- GET /v1/conversations — list conversations (page/cursor)
- GET /v1/conversations/unread-count — unread total
- GET /v1/conversations/{conversationId} — conversation detail

Conversation actions:

- POST/DELETE /v1/conversations/{conversationId}/mute — mute/unmute
- POST/DELETE /v1/conversations/{conversationId}/pin-conversation — pin/unpin
- POST/DELETE /v1/conversations/{conversationId}/archive — archive/unarchive

4. Messages

- GET /v1/conversations/{conversationId}/messages — load messages (cursor/limit)
- POST /v1/conversations/{conversationId}/messages — send message (body: SendMessageRequest)
- POST /v1/conversations/{conversationId}/seen — mark seen (body: { lastSeenMessageId })
- POST /v1/conversations/{conversationId}/delivered — mark delivered (body: { lastDeliveredMessageId })
- PUT /v1/messages/{messageId} — edit message (body: { text })
- POST /v1/messages/{messageId}/revoke — revoke
- POST /v1/messages/{messageId}/delete — delete for me
- POST /v1/messages/forward — forward messages (body: { messageIds, targetConversationIds })
- POST/DELETE /v1/messages/{messageId}/pin — pin/unpin
- POST /v1/messages/{messageId}/quote — quote/reply (body similar to send)
- POST /v1/messages/{messageId}/react — add reaction (body: { emoji })
- GET /v1/messages/{messageId}/reactions — list reactions

5. Groups / Polls / Reminders / Notes

- POST /v1/groups — create group (body: CreateGroupRequest)
- PUT /v1/groups/{groupId} — update group
- GET/POST /v1/groups/{groupId}/members — list/add members
- DELETE /v1/groups/{groupId}/members/{userId} — remove member
- POST /v1/groups/{groupId}/leave — leave group

Polls & utilities:

- POST /v1/groups/{groupId}/polls — create poll
- GET /v1/groups/{groupId}/polls — list polls
- POST /v1/groups/{groupId}/polls/{pollId}/vote — vote
- POST /v1/groups/{groupId}/polls/{pollId}/options — add option
- POST /v1/groups/{groupId}/polls/{pollId}/lock — close poll
- POST/DELETE /v1/groups/{groupId}/polls/{pollId}/pin — pin/unpin

Reminders/notes and invite links supported (see codebase routes). Example:

- GET /v1/groups/{groupId}/invite-link
- POST /v1/groups/{groupId}/invite-link/regenerate
- POST /v1/invites/{token}/join

6. Media

- POST /v1/media/upload — multipart upload via backend
- POST /v1/media/upload-multiple
- POST /v1/media/request-upload-url — presigned URL
- POST /v1/media/confirm-upload — confirm cloud upload
- DELETE /v1/media/{filename}

7. Friend requests & Friendships

- POST /v1/friend-requests/{receiverId} — send request
- PATCH/DELETE /v1/friend-requests/{requestId} — update/cancel
- GET /v1/friend-requests/received, /sent
- GET /v1/friendships — list friends
- DELETE /v1/friendships/{friendId} — unfriend
- GET /v1/friendships/{friendId}/check

8. Blocks

- GET /v1/blocks
- POST /v1/blocks/{blockedUserId}
- DELETE /v1/blocks/{blockedUserId}
- GET /v1/blocks/{blockedUserId}/check

9. Search

- GET /v1/search?q=...&limit=...

10. Calls (LiveKit integration)

- POST /v1/calls — create call
- POST /v1/calls/{callId}/join — join call
- POST /v1/calls/{callId}/leave — leave
- GET /v1/calls/{callId}/token — get token

11. AI

- POST /v1/ai/\* — ai endpoints (summarize, smart-reply, translate, etc.)

---

## Conventions & Notes

- Validation uses zod DTOs in `src/modules/*/model/dto.ts`.
- Response normalization via `src/share/middleware/response-format.ts`.
- Auth middleware: `src/share/middleware/auth.ts`.
- Mount points and routers: many tests and helpers show routes mounted under `/v1` (see tests/helpers/\*).
- Full OpenAPI is available at `_docs/api/openapi.v1.yaml` (or `docs/swagger` in project). Use that for detailed schemas.

---

## Quick contact points in code (sources)

- Socket/IO bootstrap: `src/share/component/socket-io.ts`
- Chat HTTP controllers: `src/modules/chat/infras/transport/http-*` and `src/modules/chat/infras/transport/http-service.ts`
- Socket handlers: `src/modules/chat/infras/transport/socket/*` (register-handlers.ts, notifiers.ts, connection.handlers.ts)
- User routes: `src/modules/user/infras/transport/user-v2.routes.ts`
- Media: `src/modules/media` folder

Generated: automated scan (may omit very new/experimental routes). Nếu cần tôi có thể xuất OpenAPI YAML đầy đủ hoặc cập nhật file swagger từ source controllers.
