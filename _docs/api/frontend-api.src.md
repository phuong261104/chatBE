# Tai lieu API + Socket cho Frontend (tu src)

Tai lieu nay duoc tao moi dua tren code src. Tat ca endpoint duoc mount voi prefix `/v1`.

## 0. Tong quan

- Base URL local: `http://localhost:3000/v1`
- Content-Type: `application/json` (hoac `multipart/form-data` cho upload)
- Auth header: `Authorization: Bearer <jwt-token>`
- Socket.IO URL: `http://localhost:3000` (path: `/socket.io`)

## 0.1 Quy uoc du lieu

- Tat ca `id` la string (nhieu truong la UUID). FE coi la opaque.
- Truong thoi gian (Date) khi tra ve JSON se la ISO 8601 string (vd `2026-03-31T10:00:00.000Z`).
- Rieng `presence.lastSeen` la epoch milliseconds (number).
- Truong khong co gia tri thuong bi bo trong response (khong phai `null`).
- `status` va `msg` luon co trong response envelope (muc 2).

## 1. Auth

- Dang ky: `POST /auth/register` -> tra ve token + user
- Dang nhap: `POST /auth/login` -> tra ve token
- Token la JWT, het han sau `7d` (config)
- Truyen token trong HTTP header: `Authorization: Bearer <token>`
- Truyen token cho Socket.IO qua handshake:
  - `auth: { token }` hoac `query: { token }`
- Token payload co field `sub` (userId) va `role` (admin|user)
- Mot so route co role check (vd `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`)

## 2. Response envelope + Error format

Tat ca response JSON di qua middleware format, FE nen doc theo envelope sau.

### Success

```json
{
  "status": "success",
  "msg": "OK",
  "data": {},
  "meta": {}
}
```

### Error

```json
{
  "status": "error",
  "msg": "Validation error",
  "code": "VALIDATION_ERROR",
  "details": {}
}
```

- 204 No Content: khong co body.
- `details` co the la object hoac array tu Zod errors.

### Map HTTP status -> code

| HTTP status | code               |
| ----------- | ------------------ |
| 400         | BAD_REQUEST        |
| 401         | UNAUTHORIZED       |
| 403         | FORBIDDEN          |
| 404         | NOT_FOUND          |
| 405         | METHOD_NOT_ALLOWED |
| 409         | CONFLICT           |
| 422         | VALIDATION_ERROR   |
| 500+        | INTERNAL_ERROR     |

## 3. Pagination

Co 2 kieu paging:

### Kieu A: `data.items` (items + total)

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "hasMore": false
}
```

Dung o: `/friend-requests/*`, `/friendships`, `/blocks`, `/my-cloud`.

### Kieu B: `data` la array, meta o `meta`

```json
{
  "status": "success",
  "msg": "OK",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "filter": {}
  }
}
```

Dung o: `GET /users` (BaseHttpService).

Query params mac dinh:
- `page` default 1
- `limit` default phu thuoc tung endpoint (xem muc 6). `GET /users` default 10.

## 4. Upload constraints

- Max file size: 10MB
- Max files (upload multiple): 10
- Allowed mime types:
  - `image/jpeg`, `image/png`, `image/gif`, `image/webp`
  - `video/mp4`, `video/mpeg`, `video/quicktime`
  - `audio/mpeg`, `audio/wav`
  - `application/pdf`
- Public static URL: `/uploads/{filename}`

## 5. Danh sach endpoint (method, path, muc dich)

### Auth + User

| Method | Path                  | Muc dich |
| ------ | --------------------- | -------- |
| POST   | /auth/register        | Dang ky, tra token + user |
| POST   | /auth/login           | Dang nhap, tra token |
| GET    | /profile              | Lay profile user hien tai |
| PATCH  | /profile              | Cap nhat profile user hien tai |
| POST   | /users                | Tao user (can auth + role) |
| GET    | /users/search         | Tim user theo phone |
| GET    | /users/{id}/presence  | Lay presence user |
| GET    | /users/{id}           | Lay detail user |
| GET    | /users                | List user |
| PATCH  | /users/{id}           | Cap nhat user |
| DELETE | /users/{id}           | Xoa user |
| POST   | /rpc/introspect       | Introspect token (internal) |

### Chat / Message / Group

| Method | Path | Muc dich |
| ------ | ---- | -------- |
| POST | /conversations/private | Tao/lay private conversation |
| GET | /conversations/unread-count | Tong unread count |
| GET | /conversations | List conversations |
| GET | /conversations/{conversationId} | Detail conversation |
| GET | /conversations/{conversationId}/messages | Load messages (cursor) |
| POST | /conversations/{conversationId}/messages | Gui message |
| POST | /messages/{messageId}/revoke | Thu hoi message |
| POST | /messages/{messageId}/delete | Xoa message phia toi |
| POST | /messages/forward | Forward messages |
| POST | /conversations/{conversationId}/seen | Mark seen |
| POST | /conversations/{conversationId}/delivered | Mark delivered |
| POST | /groups | Tao group |
| POST | /groups/{groupId}/members | Them members |
| DELETE | /groups/{groupId}/members/{userId} | Xoa member |
| PUT | /groups/{groupId} | Update group info |
| POST | /groups/{groupId}/leave | Roi group |
| GET | /groups/{groupId}/members | Lay members |
| POST | /conversations/{conversationId}/mute | Mute conversation |
| DELETE | /conversations/{conversationId}/mute | Unmute conversation |
| POST | /conversations/{conversationId}/pin-conversation | Pin conversation |
| DELETE | /conversations/{conversationId}/pin-conversation | Unpin conversation |
| POST | /conversations/{conversationId}/archive | Archive conversation |
| DELETE | /conversations/{conversationId}/archive | Unarchive conversation |
| PUT | /messages/{messageId} | Edit message |
| POST | /messages/{messageId}/pin | Pin message |
| DELETE | /messages/{messageId}/pin | Unpin message |
| GET | /conversations/{conversationId}/pinned-messages | Lay pinned messages |
| POST | /messages/{messageId}/react | Them reaction |
| DELETE | /messages/{messageId}/react | Xoa reaction cua user |
| DELETE | /messages/{messageId}/reactions | Xoa tat ca reaction cua user |
| GET | /messages/{messageId}/reactions | Lay reactions |
| POST | /messages/{messageId}/quote | Quote message |
| POST | /groups/{groupId}/set-admin | Set/unset admin |
| POST | /groups/{groupId}/transfer-owner | Transfer owner |
| GET | /groups/{groupId}/members/pending | Lay pending members |
| PATCH | /groups/{groupId}/members/{userId}/approve | Approve member |
| PATCH | /groups/{groupId}/members/{userId}/reject | Reject member |
| PATCH | /groups/{groupId}/settings | Update group settings |
| GET | /groups/{groupId}/info | Group info |
| POST | /groups/{groupId}/polls | Tao poll |
| GET | /groups/{groupId}/polls | List polls |
| POST | /groups/{groupId}/polls/{pollId}/vote | Vote poll |
| GET | /groups/{groupId}/polls/{pollId}/results | Poll results |

### Friend Request

| Method | Path | Muc dich |
| ------ | ---- | -------- |
| POST | /friend-requests/{receiverId} | Gui loi moi ket ban |
| PATCH | /friend-requests/{requestId} | Update status (accepted/rejected/canceled) |
| DELETE | /friend-requests/{requestId} | Huy loi moi |
| GET | /friend-requests/received | List received requests |
| GET | /friend-requests/sent | List sent requests |

### Friendship

| Method | Path | Muc dich |
| ------ | ---- | -------- |
| GET | /friendships | List friends |
| DELETE | /friendships/{friendId} | Unfriend |
| GET | /friendships/{friendId}/check | Check friendship |
| GET | /users/{id}/mutual-friends | Mutual friends |
| GET | /users/{id}/suggestions | Friend suggestions |

### Block

| Method | Path | Muc dich |
| ------ | ---- | -------- |
| POST | /blocks/{blockedUserId} | Block user |
| DELETE | /blocks/{blockedUserId} | Unblock user |
| GET | /blocks | List blocked users |
| GET | /blocks/{blockedUserId}/check | Check block status |

### Media

| Method | Path | Muc dich |
| ------ | ---- | -------- |
| POST | /media/upload | Upload single file |
| POST | /media/upload-multiple | Upload multiple files |
| DELETE | /media/{filename} | Delete file |

### My Cloud

| Method | Path | Muc dich |
| ------ | ---- | -------- |
| GET | /my-cloud | List cloud items |
| POST | /my-cloud | Create cloud item |
| DELETE | /my-cloud/{id} | Delete cloud item |

### Search

| Method | Path | Muc dich |
| ------ | ---- | -------- |
| GET | /search | Global search |

## 6. Endpoint chi tiet (headers, params, query, body, response)

Ghi chu chung:
- Neu khong ghi ro, headers: `Authorization: Bearer <token>`.
- Response JSON tuan theo envelope o muc 2.
- 204 No Content: khong co body.

### POST /auth/register

Auth: khong
Headers: `Content-Type: application/json`
Params: none
Query: none
Body: RegisterRequest
Response: 201 -> data: TokenUser
Errors: 422

### POST /auth/login

Auth: khong
Headers: `Content-Type: application/json`
Params: none
Query: none
Body: LoginRequest
Response: 200 -> data: Token
Errors: 401

### GET /profile

Auth: co
Headers: `Authorization`
Params: none
Query: none
Body: none
Response: 200 -> data: UserProfile
Errors: 401

### PATCH /profile

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: none
Query: none
Body: UserUpdateRequest
Response: 200 -> data: true
Errors: 401, 422

### POST /users

Auth: co (role check)
Headers: `Authorization`, `Content-Type: application/json`
Params: none
Query: none
Body: UserCreateRequest
Response: 201 -> data: User
Errors: 401, 403, 422

### GET /users/search

Auth: co
Headers: `Authorization`
Params: none
Query: phone (string, required)
Body: none
Response: 200 -> data: User (khong co password/salt)
Errors: 401, 404, 422

### GET /users/{id}/presence

Auth: co
Headers: `Authorization`
Params: id (string)
Query: none
Body: none
Response: 200 -> data: Presence
Errors: 401, 422

### GET /users/{id}

Auth: khong
Headers: none
Params: id (string)
Query: none
Body: none
Response: 200 -> data: User
Note: current impl co the tra ve day du field trong User (bao gom password/salt). FE nen bo qua cac field nhay cam neu co.
Errors: 404

### GET /users

Auth: khong
Headers: none
Params: none
Query: page (int, default 1), limit (int, default 10, max 100)
Body: none
Response: 200 -> data: User[]; meta: { page, limit, filter }
Errors: 422

### PATCH /users/{id}

Auth: co (role check)
Headers: `Authorization`, `Content-Type: application/json`
Params: id (string)
Query: none
Body: UserUpdateRequest
Response: 200 -> data: User
Errors: 401, 403, 422

### DELETE /users/{id}

Auth: co (role check)
Headers: `Authorization`
Params: id (string)
Query: none
Body: none
Response: 204
Errors: 401, 403, 404

### POST /rpc/introspect

Auth: khong (internal)
Headers: `Content-Type: application/json`
Params: none
Query: none
Body: { token: string }
Response: 200 -> data: TokenPayload
Errors: 400

### POST /conversations/private

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: none
Query: none
Body: GetOrCreatePrivateConversationRequest
Response: 200 -> data: Conversation
Errors: 401, 422

### GET /conversations/unread-count

Auth: co
Headers: `Authorization`
Params: none
Query: none
Body: none
Response: 200 -> data: { totalUnread: number }
Note: chi tinh unread cua conversation con active va chua archive.
Errors: 401

### GET /conversations

Auth: co
Headers: `Authorization`
Params: none
Query: page (int, default 1), limit (int, default 20, max 100)
Body: none
Response: 200 -> data: ConversationWithMetadata[]
Note: response khong co `meta`/`items`, chi la array da duoc limit theo query.
Errors: 401

### GET /conversations/{conversationId}

Auth: co
Headers: `Authorization`
Params: conversationId (uuid)
Query: none
Body: none
Response: 200 -> data: ConversationDetail
Errors: 401, 403, 404

### GET /conversations/{conversationId}/messages

Auth: co
Headers: `Authorization`
Params: conversationId (uuid)
Query: cursor (string, optional), limit (int, default 20, max 100)
Body: none
Response: 200 -> data: LoadMessagesResult
Errors: 401, 403, 422

### POST /conversations/{conversationId}/messages

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: conversationId (uuid)
Query: none
Body: SendMessageRequest
Response: 201 -> data: Message
Errors: 401, 403, 422

### POST /messages/{messageId}/revoke

Auth: co
Headers: `Authorization`
Params: messageId (uuid)
Query: none
Body: none
Response: 200 -> data: Message
Errors: 401, 403, 404

### POST /messages/{messageId}/delete

Auth: co
Headers: `Authorization`
Params: messageId (uuid)
Query: none
Body: none
Response: 200 -> data: { success: true }
Errors: 401, 403, 404

### POST /messages/forward

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: none
Query: none
Body: ForwardMessagesRequest
Response: 201 -> data: Message[]
Errors: 401, 422

### POST /conversations/{conversationId}/seen

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: conversationId (uuid)
Query: none
Body: MarkSeenRequest
Response: 200 -> data: { success: true }
Errors: 401, 422

### POST /conversations/{conversationId}/delivered

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: conversationId (uuid)
Query: none
Body: MarkDeliveredRequest
Response: 200 -> data: { success: true }
Errors: 401, 422

### POST /groups

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: none
Query: none
Body: CreateGroupRequest
Response: 201 -> data: CreateGroupResult
Errors: 401, 422

### POST /groups/{groupId}/members

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: groupId (uuid)
Query: none
Body: AddMembersRequest
Response: 200 -> data: ConversationMember[]
Note: chi admin moi duoc them member.
Errors: 401, 400, 403, 404, 422

### DELETE /groups/{groupId}/members/{userId}

Auth: co
Headers: `Authorization`
Params: groupId (uuid), userId (uuid)
Query: none
Body: none
Response: 204
Note: chi admin moi duoc xoa nguoi khac; user co the tu roi group.
Errors: 401, 400, 403, 404

### PUT /groups/{groupId}

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: groupId (uuid)
Query: none
Body: UpdateGroupInfoRequest
Response: 200 -> data: Conversation
Note: chi admin moi duoc update group info.
Errors: 401, 400, 403, 404, 422

### POST /groups/{groupId}/leave

Auth: co
Headers: `Authorization`
Params: groupId (uuid)
Query: none
Body: none
Response: 200 -> data: { success: true }
Note: chi member cua group moi roi duoc.
Errors: 401, 400, 404, 422

### GET /groups/{groupId}/members

Auth: co
Headers: `Authorization`
Params: groupId (uuid)
Query: none
Body: none
Response: 200 -> data: ConversationMember[]
Note: chi ap dung cho group conversation.
Errors: 401, 400, 403, 404, 422

### POST /conversations/{conversationId}/mute

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: conversationId (uuid)
Query: none
Body: MuteConversationRequest
Response: 200 -> data: { success: true }
Errors: 401, 422

### DELETE /conversations/{conversationId}/mute

Auth: co
Headers: `Authorization`
Params: conversationId (uuid)
Query: none
Body: none
Response: 200 -> data: { success: true }
Errors: 401

### POST /conversations/{conversationId}/pin-conversation

Auth: co
Headers: `Authorization`
Params: conversationId (uuid)
Query: none
Body: none
Response: 200 -> data: { success: true }
Errors: 401

### DELETE /conversations/{conversationId}/pin-conversation

Auth: co
Headers: `Authorization`
Params: conversationId (uuid)
Query: none
Body: none
Response: 200 -> data: { success: true }
Errors: 401

### POST /conversations/{conversationId}/archive

Auth: co
Headers: `Authorization`
Params: conversationId (uuid)
Query: none
Body: none
Response: 200 -> data: { success: true }
Errors: 401

### DELETE /conversations/{conversationId}/archive

Auth: co
Headers: `Authorization`
Params: conversationId (uuid)
Query: none
Body: none
Response: 200 -> data: { success: true }
Errors: 401

### PUT /messages/{messageId}

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: messageId (uuid)
Query: none
Body: EditMessageRequest
Response: 200 -> data: Message
Errors: 401, 403, 422

### POST /messages/{messageId}/pin

Auth: co
Headers: `Authorization`
Params: messageId (uuid)
Query: none
Body: none
Response: 200 -> data: Message
Errors: 401, 403

### DELETE /messages/{messageId}/pin

Auth: co
Headers: `Authorization`
Params: messageId (uuid)
Query: none
Body: none
Response: 200 -> data: Message
Errors: 401, 403

### GET /conversations/{conversationId}/pinned-messages

Auth: co
Headers: `Authorization`
Params: conversationId (uuid)
Query: none
Body: none
Response: 200 -> data: Message[]
Errors: 401, 422

### POST /messages/{messageId}/react

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: messageId (uuid)
Query: none
Body: AddReactionRequest
Response: 201 -> data: MessageReaction
Errors: 401, 422

### DELETE /messages/{messageId}/react

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: messageId (uuid)
Query: none
Body: RemoveReactionRequest
Response: 200 -> data: { success: true, deletedCount: number }
Errors: 401, 422

### DELETE /messages/{messageId}/reactions

Auth: co
Headers: `Authorization`
Params: messageId (uuid)
Query: none
Body: none
Response: 200 -> data: { success: true, deletedCount: number }
Errors: 401, 422

### GET /messages/{messageId}/reactions

Auth: co
Headers: `Authorization`
Params: messageId (uuid)
Query: none
Body: none
Response: 200 -> data: ReactionResult
Errors: 401, 422

### POST /messages/{messageId}/quote

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: messageId (uuid)
Query: none
Body: QuoteMessageRequest
Response: 201 -> data: Message
Note: quotedMessageId lay tu path, conversationId tu message goc.
Errors: 401, 404, 422

### POST /groups/{groupId}/set-admin

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: groupId (uuid)
Query: none
Body: SetAdminRequest
Response: 200 -> data: Conversation
Note: chi ap dung cho group; targetUserId phai la member.
Errors: 401, 400, 404

### POST /groups/{groupId}/transfer-owner

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: groupId (uuid)
Query: none
Body: TransferOwnerRequest
Response: 200 -> data: Conversation
Note: chi ap dung cho group; newOwnerId phai la member.
Errors: 401, 400, 404

### GET /groups/{groupId}/members/pending

Auth: co
Headers: `Authorization`
Params: groupId (uuid)
Query: none
Body: none
Response: 200 -> data: ConversationMember[]
Note: chi ap dung cho group conversation.
Errors: 401, 400, 404

### PATCH /groups/{groupId}/members/{userId}/approve

Auth: co
Headers: `Authorization`
Params: groupId (uuid), userId (uuid)
Query: none
Body: none
Response: 200 -> data: ConversationMember
Errors: 401, 400, 404

### PATCH /groups/{groupId}/members/{userId}/reject

Auth: co
Headers: `Authorization`
Params: groupId (uuid), userId (uuid)
Query: none
Body: none
Response: 200 -> data: { success: true }
Errors: 401, 400, 404

### PATCH /groups/{groupId}/settings

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: groupId (uuid)
Query: none
Body: UpdateGroupSettingsRequest
Response: 200 -> data: Conversation
Note: chi admin moi duoc update settings.
Errors: 401, 400, 403, 404

### GET /groups/{groupId}/info

Auth: co
Headers: `Authorization`
Params: groupId (uuid)
Query: none
Body: none
Response: 200 -> data: GroupInfo
Note: chi member cua group moi xem duoc.
Errors: 401, 403, 404

### POST /groups/{groupId}/polls

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: groupId (uuid)
Query: none
Body: CreatePollRequest
Response: 201 -> data: Poll
Note: chi ap dung cho group conversation, requester phai la member.
Errors: 401, 400, 403, 404

### GET /groups/{groupId}/polls

Auth: co
Headers: `Authorization`
Params: groupId (uuid)
Query: none
Body: none
Response: 200 -> data: Poll[]
Note: chi ap dung cho group conversation.
Errors: 401, 400, 404

### POST /groups/{groupId}/polls/{pollId}/vote

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: groupId (uuid), pollId (uuid)
Query: none
Body: VotePollRequest
Response: 200 -> data: Poll
Note: 400 neu poll het han hoac optionIds khong hop le.
Errors: 401, 400, 404

### GET /groups/{groupId}/polls/{pollId}/results

Auth: co
Headers: `Authorization`
Params: groupId (uuid), pollId (uuid)
Query: none
Body: none
Response: 200 -> data: Poll
Note: 404 neu pollId khong ton tai.
Errors: 401, 404

### POST /friend-requests/{receiverId}

Auth: co
Headers: `Authorization`
Params: receiverId (uuid)
Query: none
Body: none
Response: 201 -> data: { id: string, status: "pending" }
Errors: 401, 403, 422

### PATCH /friend-requests/{requestId}

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: requestId (uuid)
Query: none
Body: UpdateFriendRequestRequest
Response: 200 -> data: { id: string, status: string }
Errors: 401, 403, 404, 422

### DELETE /friend-requests/{requestId}

Auth: co
Headers: `Authorization`
Params: requestId (uuid)
Query: none
Body: none
Response: 204
Errors: 401, 403, 404

### GET /friend-requests/received

Auth: co
Headers: `Authorization`
Params: none
Query: page, limit
Body: none
Response: 200 -> data: Paging<FriendRequest>
Errors: 401

### GET /friend-requests/sent

Auth: co
Headers: `Authorization`
Params: none
Query: page, limit
Body: none
Response: 200 -> data: Paging<FriendRequest>
Errors: 401

### GET /friendships

Auth: co
Headers: `Authorization`
Params: none
Query: page, limit
Body: none
Response: 200 -> data: Paging<Friendship>
Note: items la ban ghi Friendship (userA/userB), khong phai user profile.
Errors: 401

### DELETE /friendships/{friendId}

Auth: co
Headers: `Authorization`
Params: friendId (uuid)
Query: none
Body: none
Response: 204
Errors: 401, 404

### GET /friendships/{friendId}/check

Auth: co
Headers: `Authorization`
Params: friendId (uuid)
Query: none
Body: none
Response: 200 -> data: { isFriend: boolean }
Errors: 401

### GET /users/{id}/mutual-friends

Auth: co
Headers: `Authorization`
Params: id (uuid)
Query: limit (int, default 20)
Body: none
Response: 200 -> data: { items: MutualFriend[], total: number }
Errors: 401, 404

### GET /users/{id}/suggestions

Auth: co
Headers: `Authorization`
Params: id (uuid)
Query: limit (int, default 20)
Body: none
Response: 200 -> data: { items: FriendSuggestion[], total: number }
Errors: 401

### POST /blocks/{blockedUserId}

Auth: co
Headers: `Authorization`
Params: blockedUserId (uuid)
Query: none
Body: none
Response: 200 -> data: { id: string, message: string }
Errors: 401, 400

### DELETE /blocks/{blockedUserId}

Auth: co
Headers: `Authorization`
Params: blockedUserId (uuid)
Query: none
Body: none
Response: 204
Errors: 401, 404

### GET /blocks

Auth: co
Headers: `Authorization`
Params: none
Query: page, limit
Body: none
Response: 200 -> data: Paging<Block>
Errors: 401, 400

### GET /blocks/{blockedUserId}/check

Auth: co
Headers: `Authorization`
Params: blockedUserId (uuid)
Query: none
Body: none
Response: 200 -> data: { isBlocked: boolean }
Errors: 401, 400

### POST /media/upload

Auth: co
Headers: `Authorization`, `Content-Type: multipart/form-data`
Params: none
Query: none
Body: field `file` (binary)
Response: 201 -> data: MediaUploadResponse
Errors: 400, 500

### POST /media/upload-multiple

Auth: co
Headers: `Authorization`, `Content-Type: multipart/form-data`
Params: none
Query: none
Body: field `files` (array<binary>, max 10)
Response: 201 -> data: MediaUploadMultipleResponse
Errors: 400, 500

### DELETE /media/{filename}

Auth: co
Headers: `Authorization`
Params: filename (string)
Query: none
Body: none
Response: 204
Errors: 400, 500

### GET /my-cloud

Auth: co
Headers: `Authorization`
Params: none
Query: page (int, default 1), limit (int, default 20, max 100), type (file|note, optional)
Body: none
Response: 200 -> data: Paging<CloudItem>
Errors: 401, 400

### POST /my-cloud

Auth: co
Headers: `Authorization`, `Content-Type: application/json`
Params: none
Query: none
Body: CreateCloudItemRequest
Response: 201 -> data: CloudItem
Errors: 401, 422

### DELETE /my-cloud/{id}

Auth: co
Headers: `Authorization`
Params: id (string)
Query: none
Body: none
Response: 204
Errors: 401, 404

### GET /search

Auth: co
Headers: `Authorization`
Params: none
Query: q (string, required, 1-200), limit (int, default 10, max 50)
Body: none
Response: 200 -> data: SearchResult
Errors: 401, 422

## 7. Schemas (Request)

### RegisterRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| phone | string | yes | regex `^\+?[0-9]{8,15}$` |
| password | string | yes | min 6 |
| email | string | no | email |
| displayName | string | no |  |

### LoginRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| email | string | no | email |
| phone | string | no | regex `^\+?[0-9]{8,15}$` |
| password | string | yes | min 6 |

Note: can co email hoac phone, bat buoc co it nhat 1.

### UserCreateRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| email | string | no | email |
| phone | string | no |  |
| username | string | no |  |
| password | string | yes |  |
| salt | string | yes |  |
| displayName | string | no |  |
| avatarUrl | string | no |  |
| bio | string | no |  |
| verified | object | no | xem UserVerified |
| privacy | object | no | xem UserPrivacy |
| settings | object | no | xem UserSettings |

Note: bat buoc co it nhat 1 trong hai truong `email` hoac `phone`.

### UserUpdateRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| email | string | no | email |
| phone | string | no |  |
| username | string | no |  |
| password | string | no |  |
| salt | string | no |  |
| status | string | no | active|disabled |
| displayName | string | no |  |
| avatarUrl | string | no |  |
| bio | string | no |  |
| verified | object | no |  |
| privacy | object | no |  |
| settings | object | no |  |

### GetOrCreatePrivateConversationRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| targetUserId | string | yes | uuid |

### CreateGroupRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| name | string | yes | 1-100 |
| memberIds | string[] | yes | min 1, uuid |
| avatarUrl | string | no | url |

### AddMembersRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| memberIds | string[] | yes | min 1, uuid |

### UpdateGroupInfoRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| name | string | no | 1-100 |
| avatarUrl | string | no | url |

### SendMessageRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| text | string | no | max 5000 |
| media | MediaAttachment[] | no | it nhat 1 phai co text hoac media |

### ForwardMessagesRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| messageIds | string[] | yes | min 1, uuid |
| targetConversationIds | string[] | yes | min 1, uuid |

### MarkSeenRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| lastSeenMessageId | string | yes | uuid |

### MarkDeliveredRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| lastDeliveredMessageId | string | yes | uuid |

### MuteConversationRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| muteUntil | string | no | ISO datetime |
| duration | number | no | seconds/minutes (backend tu xu ly) |

### EditMessageRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| text | string | yes | min 1, max 5000 |

### AddReactionRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| emoji | string | yes | 1-10 chars |

### RemoveReactionRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| emoji | string | no | neu co, xoa emoji cu the |

### QuoteMessageRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| text | string | no | max 5000 |
| media | MediaAttachment[] | no | it nhat 1 phai co text hoac media |

Note: quotedMessageId lay tu path `/messages/{messageId}/quote`.

### SetAdminRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| targetUserId | string | yes | uuid |
| isAdmin | boolean | yes | true/false |

### TransferOwnerRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| newOwnerId | string | yes | uuid |

### UpdateGroupSettingsRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| allowSendLink | boolean | no | default true |
| requireApproval | boolean | no | default false |
| allowMemberInvite | boolean | no | default true |

### CreatePollRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| question | string | yes | 1-500 |
| options | string[] | yes | 2-10 items, 1-200 |
| isMultipleChoice | boolean | no | default false |
| allowAddOption | boolean | no | default false |
| expiresAt | string | no | ISO datetime |

### VotePollRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| optionIds | string[] | yes | min 1 |

### UpdateFriendRequestRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| status | string | yes | pending|accepted|rejected|canceled |

### CreateCloudItemRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| type | string | yes | file|note |
| title | string | yes | 1-200 |
| content | string | no | max 10000 |
| fileUrl | string | no | required if type=file |
| fileName | string | no |  |
| fileSize | number | no |  |
| mimetype | string | no |  |

### GlobalSearchQuery

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| q | string | yes | 1-200 |
| limit | number | no | default 10, max 50 |

### MediaAttachment

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| url | string | yes |  |
| filename | string | yes |  |
| mimetype | string | yes |  |
| size | number | yes | bytes |

## 8. Data models (Response data)

### Enums

| Enum | Values |
| ---- | ------ |
| UserRole | admin, user |
| ConversationType | private, group |
| ConversationMemberRole | member, admin |
| ConversationMemberStatus | active, pending, rejected |
| MessageType | text, image, file, system |
| MediaType | image, file |
| FriendRequestStatus | pending, accepted, rejected, canceled |
| CloudItemType | file, note |

### UserProfile

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| email | string | no |  |
| phone | string | no |  |
| username | string | no |  |
| displayName | string | no |  |
| avatarUrl | string | no |  |
| bio | string | no |  |
| status | string | no | active|disabled |
| verified | object | no | { email: boolean, phone: boolean } |
| privacy | object | no | { searchableByEmail, searchableByPhone, searchableByUsername } |
| settings | object | no | { notifications: { push, inApp } } |
| lastLoginAt | string | no | ISO datetime |
| lastSeen | string | no | ISO datetime |
| createdAt | string | no | ISO datetime |
| updatedAt | string | no | ISO datetime |

### UserVerified

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| email | boolean | yes |  |
| phone | boolean | yes |  |

### UserPrivacy

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| searchableByEmail | boolean | yes |  |
| searchableByPhone | boolean | yes |  |
| searchableByUsername | boolean | yes |  |

### UserSettings

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| notifications | object | yes | { push: boolean, inApp: boolean } |

### Token

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| token | string | yes | JWT |

### TokenUser

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| token | string | yes | JWT |
| user | object | yes | id, email?, phone?, username?, displayName?, avatarUrl? |

### TokenPayload (rpc/introspect)

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| sub | string | yes | userId |
| role | string | yes | admin|user |

### Presence

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| userId | string | yes |  |
| isOnline | boolean | yes |  |
| lastSeen | number | yes | epoch ms |

### Conversation

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| type | string | yes | private|group |
| name | string | no |  |
| avatarUrl | string | no |  |
| createdBy | string | no |  |
| ownerId | string | no |  |
| admins | string[] | no |  |
| membersCount | number | no | default 0 |
| settings | object | no | allowSendLink, requireApproval, allowMemberInvite |
| lastMessage | object | no | messageId, senderId, type, textPreview, createdAt |
| lastMessageAt | string | no | ISO datetime |
| createdAt | string | yes | ISO datetime |
| updatedAt | string | yes | ISO datetime |

### ConversationWithMetadata

Bao gom tat ca field cua Conversation, them:

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| unreadCount | number | yes | default 0 |
| role | string | yes | member|admin |

### ConversationDetail

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| conversation | Conversation | yes |  |
| members | ConversationMember[] | yes | active members |
| currentUserRole | string | yes | member|admin |

### GroupInfo

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| conversation | Conversation | yes |  |
| members | ConversationMember[] | yes | active members |
| currentUserRole | string | yes | member|admin |
| settings | GroupSettings | yes | default: allowSendLink=true, requireApproval=false, allowMemberInvite=true |

### GroupSettings

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| allowSendLink | boolean | no | default true |
| requireApproval | boolean | no | default false |
| allowMemberInvite | boolean | no | default true |

### CreateGroupResult

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| conversation | Conversation | yes |  |
| members | ConversationMember[] | yes |  |
| systemMessage | Message | yes | system message when group created |

### LoadMessagesResult

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| messages | Message[] | yes | page theo cursor |
| nextCursor | string | yes | empty string khi khong con page |
| hasMore | boolean | yes |  |

### ConversationMember

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| conversationId | string | yes |  |
| userId | string | yes |  |
| role | string | yes | member|admin |
| status | string | yes | active|pending|rejected |
| joinedAt | string | yes | ISO datetime |
| leftAt | string | no | ISO datetime |
| unreadCount | number | no | default 0 |
| lastReadMessageId | string | no |  |
| lastReadAt | string | no | ISO datetime |
| lastSeenMessageId | string | no |  |
| lastDeliveredMessageId | string | no |  |
| muteUntil | string | no | ISO datetime |
| pinned | boolean | no | default false |
| archived | boolean | no | default false |

### Message

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| conversationId | string | yes |  |
| senderId | string | yes |  |
| type | string | yes | text|image|file|system |
| text | string | no |  |
| media | MessageMedia[] | no |  |
| deletedForUserIds | string[] | no |  |
| quotedMessageId | string | no |  |
| quotedMessagePreview | string | no |  |
| createdAt | string | yes | ISO datetime |
| editedAt | string | no | ISO datetime |
| deletedAt | string | no | ISO datetime |
| pinned | boolean | no | default false |
| pinnedAt | string | no | ISO datetime |

### MessageMedia

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| url | string | yes |  |
| mediaType | string | yes | image|file |
| name | string | no |  |
| size | number | no |  |
| width | number | no |  |
| height | number | no |  |

### MessageReaction

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| messageId | string | yes |  |
| userId | string | yes |  |
| emoji | string | yes |  |
| count | number | no | default 1 |
| createdAt | string | yes | ISO datetime |

### ReactionResult

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| reactions | MessageReaction[] | yes |  |
| grouped | object | yes | { emoji: count } |

### Poll

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| conversationId | string | yes |  |
| question | string | yes |  |
| options | PollOption[] | yes |  |
| createdBy | string | yes |  |
| isMultipleChoice | boolean | no | default false |
| allowAddOption | boolean | no | default false |
| expiresAt | string | no | ISO datetime |
| totalVotes | number | no | default 0 |
| createdAt | string | yes | ISO datetime |
| updatedAt | string | yes | ISO datetime |

### PollOption

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| text | string | yes |  |
| voteCount | number | no | default 0 |
| votedUserIds | string[] | no | default [] |

### FriendRequest

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| fromUserId | string | yes |  |
| toUserId | string | yes |  |
| status | string | yes | pending|accepted|rejected|canceled |
| createdAt | string | yes | ISO datetime |
| respondedAt | string | no | ISO datetime |

### Friendship

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| userA | string | yes | min(userId1, userId2) |
| userB | string | yes | max(userId1, userId2) |
| createdAt | string | yes | ISO datetime |

### MutualFriend

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| displayName | string | no |  |
| avatarUrl | string | no |  |
| mutualFriendsCount | number | yes |  |

### FriendSuggestion

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| displayName | string | no |  |
| avatarUrl | string | no |  |
| mutualFriendsCount | number | yes |  |
| mutualFriendIds | string[] | yes |  |

### Block

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| blockerId | string | yes |  |
| blockedUserId | string | yes |  |
| createdAt | string | yes | ISO datetime |

### CloudItem

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| id | string | yes |  |
| userId | string | yes |  |
| type | string | yes | file|note |
| title | string | yes |  |
| content | string | no |  |
| fileUrl | string | no |  |
| fileName | string | no |  |
| fileSize | number | no |  |
| mimetype | string | no |  |
| createdAt | string | yes | ISO datetime |
| updatedAt | string | yes | ISO datetime |

### MediaUploadResponse

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| filename | string | yes |  |
| originalName | string | yes |  |
| mimetype | string | yes |  |
| size | number | yes | bytes |
| url | string | yes |  |
| path | string | yes |  |
| uploadedAt | string | yes | ISO datetime |

### MediaUploadMultipleResponse

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| files | MediaUploadResponse[] | yes |  |
| count | number | yes |  |

### SearchResult

| Field | Type | Required | Default/Notes |
| ----- | ---- | -------- | ------------- |
| users | array | yes | { id, displayName?, avatarUrl?, username? } |
| conversations | array | yes | { id, type, name?, avatarUrl?, membersCount } |
| messages | array | yes | { id, conversationId, senderId, text?, createdAt } |

## 9. Vi du thuc te

### Vi du thanh cong (dang nhap)

Request:

```json
POST /v1/auth/login
{
  "phone": "+84901234567",
  "password": "123456"
}
```

Response:

```json
{
  "status": "success",
  "msg": "OK",
  "data": {
    "token": "<jwt>"
  }
}
```

### Vi du thanh cong (gui message)

Request:

```json
POST /v1/conversations/0d2c/messages
{
  "text": "hello",
  "media": [
    {
      "url": "https://cdn/app/file.png",
      "filename": "file.png",
      "mimetype": "image/png",
      "size": 12345
    }
  ]
}
```

Response:

```json
{
  "status": "success",
  "msg": "Created",
  "data": {
    "id": "msg_123",
    "conversationId": "0d2c",
    "senderId": "u_1",
    "type": "text",
    "text": "hello",
    "createdAt": "2026-03-31T10:00:00.000Z"
  }
}
```

### Vi du loi (validation)

Request:

```json
GET /v1/users/search
```

Response:

```json
{
  "status": "error",
  "msg": "phone is required",
  "code": "VALIDATION_ERROR"
}
```

### Vi du loi (unauthorized)

Request:

```json
GET /v1/profile
```

Response:

```json
{
  "status": "error",
  "msg": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

### Vi du thanh cong (tao group)

Request:

```json
POST /v1/groups
{
  "name": "Team A",
  "memberIds": ["u_2", "u_3"],
  "avatarUrl": "https://cdn/app/group.png"
}
```

Response:

```json
{
  "status": "success",
  "msg": "Created",
  "data": {
    "conversation": { "id": "c_1", "type": "group", "name": "Team A" },
    "members": [ { "id": "m_1", "userId": "u_1" } ],
    "systemMessage": { "id": "msg_sys_1", "type": "system" }
  }
}
```

### Vi du thanh cong (friend request)

Request:

```json
POST /v1/friend-requests/u_2
{}
```

Response:

```json
{
  "status": "success",
  "msg": "Created",
  "data": { "id": "fr_1", "status": "pending" }
}
```

### Vi du thanh cong (upload file)

Request (multipart/form-data): field `file`

Response:

```json
{
  "status": "success",
  "msg": "Created",
  "data": {
    "filename": "file.png",
    "mimetype": "image/png",
    "size": 12345,
    "url": "http://localhost:3000/uploads/file.png"
  }
}
```

### Vi du socket (join group + receive message)

Client emit:

```json
{ "event": "joinGroup", "data": { "conversationId": "c_1" } }
```

Server emit:

```json
{
  "event": "receiveMessage",
  "data": { "conversationId": "c_1", "message": { "id": "msg_1", "text": "hello" } }
}
```

## 10. Socket.IO

### 10.1 Luong ket noi + auth

- FE connect: `io("http://localhost:3000", { path: "/socket.io", auth: { token } })`
- Neu khong co token hoac token invalid, server tra error `Authentication error`.
- Sau khi connect, server join cac room:
  - `user:{userId}` va `user_room:{userId}` (namespace /messages)
  - `user:{userId}` (namespace /friends)
- Nen tao socket rieng cho cac namespace: `/messages`, `/friends`, va root (presence)

### 10.2 Namespace /messages

#### Client -> Server (emit)

| Event | Payload | Required/Notes |
| ----- | ------- | -------------- |
| joinGroup | { conversationId: string } | conversationId bat buoc |
| leaveGroup | { conversationId: string } | conversationId bat buoc |
| messageSeen | { conversationId: string, lastSeenMessageId: string } | ca 2 bat buoc |
| messageDelivered | { conversationId: string, lastDeliveredMessageId: string } | ca 2 bat buoc |
| typing:start | { toUserId?: string, groupId?: string } | bat buoc 1 trong 2 |
| typing:stop | { toUserId?: string, groupId?: string } | bat buoc 1 trong 2 |

#### Ack (callback)

Ap dung cho: `joinGroup`, `leaveGroup`, `messageSeen`, `messageDelivered`.

Success:

```json
{ "success": true, "message": "Joined group <id>" }
```

Error:

```json
{ "success": false, "error": "Unauthorized" }
```

#### Server -> Client (listen)

| Event | Payload | Required/Notes |
| ----- | ------- | -------------- |
| receiveMessage | { conversationId: string, message: Message } |  |
| messageSeen | { conversationId: string, userId: string, lastSeenMessageId: string } |  |
| messageDelivered | { conversationId: string, userId: string, lastDeliveredMessageId: string } |  |
| conversation:created | { conversation: Conversation, systemMessage: Message } |  |
| conversation:members_added | { conversationId: string, newMembers: ConversationMember[] } |  |
| conversation:member_removed | { conversationId: string, removedUserId: string } |  |
| conversation:updated | { conversationId: string, data: Conversation } |  |
| message:revoked | { conversationId: string, message: Message } |  |
| message:edited | { conversationId: string, message: Message } |  |
| message:pinned | { conversationId: string, message: Message } |  |
| message:unpinned | { conversationId: string, message: Message } |  |
| message:reaction | { messageId: string, reaction: MessageReaction } |  |
| message:reaction:remove | { messageId: string, userId: string, emoji?: string } | emoji co the khong co |
| message:reactions:clear | { messageId: string, userId: string } |  |
| typing:start | { userId: string, toUserId?: string, groupId?: string } |  |
| typing:stop | { userId: string, toUserId?: string, groupId?: string } |  |
| group:admin_changed | { conversationId: string, targetUserId: string, isAdmin: boolean } |  |
| group:owner_transferred | { conversationId: string, oldOwnerId: string, newOwnerId: string } |  |
| poll:new | { conversationId: string, poll: Poll } |  |
| poll:vote | { pollId: string, userId: string, poll: Poll } |  |
| group:member_approved | { conversationId: string, userId: string, member: ConversationMember } |  |
| group:member_rejected | { conversationId: string, userId: string } |  |
| group:settings_updated | { conversationId: string, settings: GroupSettings } |  |

### 10.3 Namespace /friends

#### Client -> Server

- `ping` -> server `pong`

#### Server -> Client

| Event | Payload | Notes |
| ----- | ------- | ----- |
| friend_request:received | { type: "FRIEND_REQUEST_RECEIVED", data: { requestId, fromUserId, toUserId }, timestamp } |  |
| friend_request:accepted | { type: "FRIEND_REQUEST_ACCEPTED", data: { requestId, acceptedBy, fromUserId, toUserId }, timestamp } |  |
| friend_request:rejected | { type: "FRIEND_REQUEST_REJECTED", data: { requestId, rejectedBy, fromUserId, toUserId }, timestamp } |  |
| friend_request:canceled | { type: "FRIEND_REQUEST_CANCELED", data: { requestId, canceledBy, fromUserId, toUserId }, timestamp } |  |
| friendship:unfriended | { type: "UNFRIENDED", data: { unfriendedBy }, timestamp } | event co the chua duoc trigger |

### 10.4 Root namespace (presence)

#### Client -> Server

- `heartbeat` (giu online state)

#### Server -> Client

| Event | Payload |
| ----- | ------- |
| user:online | { userId: string } |
| user:offline | { userId: string } |

### 10.5 Retry / ack / timeout

- Ack hien co cho `joinGroup`, `leaveGroup`, `messageSeen`, `messageDelivered`.
- Khong co quy tac retry/timeout mac dinh trong backend; FE tu quy dinh retry/timeout khi can.

### 10.6 Event loi

- Auth error khi connect: `Authentication error: No token provided` hoac `Authentication error: Invalid token`.
- Ack error payload: `{ success: false, error: "..." }`.
