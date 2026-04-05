# Tai lieu API Backend cho Frontend (v1)

Tai lieu nay duoc trich tu implementation hien tai trong code backend.
Tat ca endpoint duoc mount voi prefix `/v1`.

## Tong quan

| Muc            | Gia tri                                   |
| -------------- | ----------------------------------------- |
| Base URL local | `http://localhost:3000/v1`                |
| Auth           | `Authorization: Bearer <jwt-token>`       |
| Content-Type   | `application/json`, `multipart/form-data` |

## Chuan response envelope

Backend normalize response qua middleware.
Frontend nen parse theo 2 envelope duoi day.

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

Error code thuong gap: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `CONFLICT`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

## Error examples cho endpoint nhay cam

Muc tieu cua phan nay la giup FE map loi theo tung endpoint de hien thi message dung ngu canh.

### 401 Unauthorized

Endpoint nhay cam thuong gap:

1. `GET /profile`
2. `POST /conversations/{conversationId}/messages`
3. `POST /friend-requests/{receiverId}`
4. `GET /search?q=...`

Example response:

```json
{
  "status": "error",
  "msg": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

Case FE can xu ly:

1. Token het han hoac sai format header.
2. User da dang xuat o thiet bi khac.
3. Request khong gui Authorization header.

### 403 Forbidden

Endpoint nhay cam thuong gap:

1. `POST /friend-requests/{receiverId}` khi hai ben da block nhau.
2. `PATCH /friend-requests/{requestId}` khi user khong du quyen cap nhat request.
3. `DELETE /groups/{groupId}/members/{userId}` khi requester khong phai admin/khong du quyen.

Example response (friend request bi block):

```json
{
  "status": "error",
  "msg": "Cannot send friend request because one user has blocked the other",
  "code": "FORBIDDEN"
}
```

Example response (khong du quyen thao tac):

```json
{
  "status": "error",
  "msg": "Unauthorized action",
  "code": "FORBIDDEN"
}
```

### 422 Validation Error

Endpoint nhay cam thuong gap:

1. `POST /auth/register` (phone/password invalid)
2. `GET /users/search` (thieu query `phone`)
3. `POST /conversations/private` (`targetUserId` khong dung uuid)
4. `POST /conversations/{conversationId}/messages` (thieu ca `text` va `media`)
5. `PATCH /friend-requests/{requestId}` (`status` khong hop le)

Example response (`POST /auth/register`):

```json
{
  "status": "error",
  "msg": "Phone number is invalid",
  "code": "VALIDATION_ERROR",
  "details": {
    "phone": "Phone number is invalid"
  }
}
```

Example response (`GET /users/search` thieu phone):

```json
{
  "status": "error",
  "msg": "phone is required",
  "code": "VALIDATION_ERROR"
}
```

Example response (`POST /conversations/private` uuid invalid):

```json
{
  "status": "error",
  "msg": "Validation error",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "path": ["targetUserId"],
      "message": "Invalid target user ID"
    }
  ]
}
```

Example response (`POST /conversations/{conversationId}/messages`):

```json
{
  "status": "error",
  "msg": "Either text or media is required",
  "code": "VALIDATION_ERROR"
}
```

### 404 Not Found

Endpoint nhay cam thuong gap:

1. `GET /users/search?phone=...` (khong tim thay user)
2. `PATCH /friend-requests/{requestId}` (request khong ton tai)
3. `DELETE /friend-requests/{requestId}` (request khong ton tai)
4. `POST /messages/{messageId}/quote` (message goc khong ton tai)
5. `DELETE /blocks/{blockedUserId}` (ban ghi block khong ton tai)

Example response (`GET /users/search`):

```json
{
  "status": "error",
  "msg": "User not found",
  "code": "NOT_FOUND"
}
```

Example response (`PATCH /friend-requests/{requestId}`):

```json
{
  "status": "error",
  "msg": "Friend request not found",
  "code": "NOT_FOUND"
}
```

Example response (`POST /messages/{messageId}/quote`):

```json
{
  "status": "error",
  "msg": "Message not found",
  "code": "NOT_FOUND"
}
```

### Goi y map UI loi cho FE

| Status | Nhom hien thi de xuat | Hanh dong FE                                       |
| ------ | --------------------- | -------------------------------------------------- |
| 401    | Session expired       | Clear token, dieu huong login                      |
| 403    | Permission blocked    | Hien thong bao khong du quyen / bi chan            |
| 422    | Invalid input         | Highlight field theo `details` neu co              |
| 404    | Data not found        | Hien state "du lieu khong ton tai" va refresh list |

## Auth va role

`auth` middleware dat requester vao `res.locals.requester` voi cac field chinh:

```json
{
  "sub": "userId",
  "role": "user"
}
```

Luu y: route `POST /users` trong code hien tai dang check `allowRoles([USER])`.

## Pagination

Nhieu endpoint tra ve payload dang:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "hasMore": false
}
```

## Media upload constraints

| Rule                          | Gia tri                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Max file size                 | 10MB (default)                                                                                                                                   |
| Max files lan upload multiple | 10                                                                                                                                               |
| Public static URL             | `/uploads/{filename}`                                                                                                                            |
| Mime types                    | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `video/mp4`, `video/mpeg`, `video/quicktime`, `audio/mpeg`, `audio/wav`, `application/pdf` |

---

## User APIs

| Method | Path                      | Auth  | Mo ta                          |
| ------ | ------------------------- | ----- | ------------------------------ |
| POST   | `/auth/register`          | Khong | Dang ky, tra token + user      |
| POST   | `/auth/login`             | Khong | Dang nhap, tra token           |
| GET    | `/profile`                | Co    | Lay profile user hien tai      |
| PATCH  | `/profile`                | Co    | Cap nhat profile user hien tai |
| POST   | `/users`                  | Co    | Tao user (route co role check) |
| GET    | `/users/search?phone=...` | Co    | Tim user theo so dien thoai    |
| GET    | `/users/{id}/presence`    | Co    | Lay online/lastSeen            |
| GET    | `/users/{id}`             | Khong | Lay detail user                |
| GET    | `/users?page=1&limit=20`  | Khong | List user                      |
| PATCH  | `/users/{id}`             | Co    | Cap nhat user                  |
| DELETE | `/users/{id}`             | Co    | Xoa user                       |
| POST   | `/rpc/introspect`         | Khong | Introspect token (internal)    |

### Payload chinh

`POST /auth/register`

```json
{
  "phone": "+84901234567",
  "password": "123456",
  "email": "optional@example.com",
  "displayName": "optional"
}
```

`POST /auth/login`

```json
{
  "phone": "+84901234567",
  "password": "123456"
}
```

`GET /users/{id}/presence` response data:

```json
{
  "userId": "uuid",
  "isOnline": true,
  "lastSeen": 1711111111111
}
```

## Chat, Group, Message APIs

| Method | Path                                               | Auth | Mo ta                        |
| ------ | -------------------------------------------------- | ---- | ---------------------------- |
| POST   | `/conversations/private`                           | Co   | Tao/lay private conversation |
| GET    | `/conversations/unread-count`                      | Co   | Tong unread                  |
| GET    | `/conversations`                                   | Co   | List conversations           |
| GET    | `/conversations/{conversationId}`                  | Co   | Detail conversation          |
| GET    | `/conversations/{conversationId}/messages`         | Co   | Cursor pagination message    |
| POST   | `/conversations/{conversationId}/messages`         | Co   | Gui message                  |
| POST   | `/messages/{messageId}/revoke`                     | Co   | Thu hoi message              |
| POST   | `/messages/{messageId}/delete`                     | Co   | Xoa message phia toi         |
| POST   | `/messages/forward`                                | Co   | Forward message              |
| POST   | `/conversations/{conversationId}/seen`             | Co   | Mark seen                    |
| POST   | `/conversations/{conversationId}/delivered`        | Co   | Mark delivered               |
| POST   | `/groups`                                          | Co   | Tao group                    |
| POST   | `/groups/{groupId}/members`                        | Co   | Them member                  |
| DELETE | `/groups/{groupId}/members/{userId}`               | Co   | Xoa member                   |
| PUT    | `/groups/{groupId}`                                | Co   | Sua thong tin group          |
| POST   | `/groups/{groupId}/leave`                          | Co   | Roi group                    |
| GET    | `/groups/{groupId}/members`                        | Co   | Lay members                  |
| POST   | `/conversations/{conversationId}/mute`             | Co   | Mute conversation            |
| DELETE | `/conversations/{conversationId}/mute`             | Co   | Unmute conversation          |
| POST   | `/conversations/{conversationId}/pin-conversation` | Co   | Pin conversation             |
| DELETE | `/conversations/{conversationId}/pin-conversation` | Co   | Unpin conversation           |
| POST   | `/conversations/{conversationId}/archive`          | Co   | Archive conversation         |
| DELETE | `/conversations/{conversationId}/archive`          | Co   | Unarchive conversation       |
| PUT    | `/messages/{messageId}`                            | Co   | Edit message                 |
| POST   | `/messages/{messageId}/pin`                        | Co   | Pin message                  |
| DELETE | `/messages/{messageId}/pin`                        | Co   | Unpin message                |
| GET    | `/conversations/{conversationId}/pinned-messages`  | Co   | Lay pinned messages          |
| POST   | `/messages/{messageId}/react`                      | Co   | Them reaction                |
| DELETE | `/messages/{messageId}/react`                      | Co   | Xoa reaction user            |
| DELETE | `/messages/{messageId}/reactions`                  | Co   | Xoa tat ca reaction user     |
| GET    | `/messages/{messageId}/reactions`                  | Co   | Lay danh sach reaction       |
| POST   | `/messages/{messageId}/quote`                      | Co   | Quote message                |

### Payload chinh cua chat

`POST /conversations/private`

```json
{
  "targetUserId": "uuid"
}
```

`POST /conversations/{conversationId}/messages`

```json
{
  "text": "hello",
  "media": [
    {
      "url": "https://cdn/file.png",
      "filename": "file.png",
      "mimetype": "image/png",
      "size": 12345
    }
  ]
}
```

Rule: can co it nhat mot trong hai field `text` hoac `media`.

`POST /messages/forward`

```json
{
  "messageIds": ["uuid"],
  "targetConversationIds": ["uuid"]
}
```

`POST /groups`

```json
{
  "name": "Team A",
  "memberIds": ["uuid"],
  "avatarUrl": "https://cdn/group.png"
}
```

`POST /messages/{messageId}/react`

```json
{
  "emoji": ":thumbsup:"
}
```

## Block APIs

| Method | Path                            | Auth | Mo ta              |
| ------ | ------------------------------- | ---- | ------------------ |
| POST   | `/blocks/{blockedUserId}`       | Co   | Block user         |
| DELETE | `/blocks/{blockedUserId}`       | Co   | Unblock user       |
| GET    | `/blocks`                       | Co   | List user da block |
| GET    | `/blocks/{blockedUserId}/check` | Co   | Check status block |

## Friend Request APIs

| Method | Path                            | Auth | Mo ta                       |
| ------ | ------------------------------- | ---- | --------------------------- |
| POST   | `/friend-requests/{receiverId}` | Co   | Gui loi moi ket ban         |
| PATCH  | `/friend-requests/{requestId}`  | Co   | Cap nhat trang thai loi moi |
| DELETE | `/friend-requests/{requestId}`  | Co   | Huy loi moi                 |
| GET    | `/friend-requests/received`     | Co   | Danh sach loi moi da nhan   |
| GET    | `/friend-requests/sent`         | Co   | Danh sach loi moi da gui    |

`PATCH /friend-requests/{requestId}` body:

```json
{
  "status": "accepted"
}
```

Gia tri hop le: `pending`, `accepted`, `rejected`, `canceled`.

## Friendship APIs

| Method | Path                            | Auth | Mo ta               |
| ------ | ------------------------------- | ---- | ------------------- |
| GET    | `/friendships`                  | Co   | Danh sach ban be    |
| DELETE | `/friendships/{friendId}`       | Co   | Huy ket ban         |
| GET    | `/friendships/{friendId}/check` | Co   | Kiem tra friendship |

## Media APIs

| Method | Path                     | Auth | Mo ta                             |
| ------ | ------------------------ | ---- | --------------------------------- |
| POST   | `/media/upload`          | Co   | Upload 1 file (field `file`)      |
| POST   | `/media/upload-multiple` | Co   | Upload nhieu file (field `files`) |
| DELETE | `/media/{filename}`      | Co   | Xoa file                          |

`POST /media/upload` response `data`:

```json
{
  "filename": "stored-name.png",
  "originalName": "avatar.png",
  "mimetype": "image/png",
  "size": 1234,
  "url": "http://localhost:3000/uploads/stored-name.png",
  "path": "uploads/stored-name.png",
  "uploadedAt": "2026-03-28T10:00:00.000Z"
}
```

## My Cloud APIs

| Method | Path                                         | Auth | Mo ta              |
| ------ | -------------------------------------------- | ---- | ------------------ |
| GET    | `/my-cloud?page=1&limit=20&type=file%7Cnote` | Co   | Lay item theo user |
| POST   | `/my-cloud`                                  | Co   | Tao item moi       |
| DELETE | `/my-cloud/{id}`                             | Co   | Xoa item           |

`POST /my-cloud` body:

```json
{
  "type": "file",
  "title": "Document",
  "content": "optional",
  "fileUrl": "https://cdn/doc.pdf",
  "fileName": "doc.pdf",
  "fileSize": 12000,
  "mimetype": "application/pdf"
}
```

Rule: neu `type = file` thi bat buoc co `fileUrl`.

## Search APIs

| Method | Path                         | Auth | Mo ta                              |
| ------ | ---------------------------- | ---- | ---------------------------------- |
| GET    | `/search?q=keyword&limit=10` | Co   | Tim users, conversations, messages |

Validation: `q` bat buoc 1..200, `limit` 1..50.

## Realtime events

Chi tiet event Socket.IO tach rieng tai file `realtime-events.md` trong cung thu muc.

## Sequence va edge cases quan trong

### Gui message

1. FE goi `POST /conversations/{conversationId}/messages`.
2. Backend validate payload (`text` hoac `media` bat buoc).
3. Backend tao message va emit `receiveMessage` cho cac thanh vien.
4. FE cap nhat message list va conversation preview.

### Seen/Delivered

1. FE goi API `seen` hoac `delivered` voi message id moi nhat.
2. Backend cap nhat marker va emit event cho user khac.
3. FE can idempotent tren UI de tranh duplicate update.

### Friend request

1. Sender goi create request.
2. Receiver nhan event `friend_request:received`.
3. Receiver accept/reject/cancel, sender nhan event tuong ung.

## Khuyen nghi tich hop FE

1. Tao API client parse envelope `status`, `msg`, `data`, `meta`, `code`, `details`.
2. Handle tap trung cac ma loi 401, 403, 404, 422.
3. Validate mime/size truoc khi upload de giam request fail.
4. Quan ly socket listeners theo lifecycle screen de tranh duplicate events.
5. Dung OpenAPI file `openapi.v1.yaml` de generate typed client.
