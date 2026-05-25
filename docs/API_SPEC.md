# API Specification

## Tổng quan

Backend ChatBE expose REST API bằng Express và realtime API bằng Socket.IO. Swagger UI chạy tại:

```text
http://localhost:3000/api-docs
```

Nguồn chi tiết request/response đầy đủ là `docs/swagger/main.yaml` và các file trong `docs/swagger/paths`. Tài liệu này đóng vai trò catalog theo module, kèm các convention và flow chính để frontend/backend cùng thống nhất.

Base URLs:

| Môi trường | URL |
| --- | --- |
| Local | `http://localhost:3000` |
| Production mẫu trong Swagger | `https://api.chatbe.example.com` |

Version prefix:

- `/v1`: version public duy nhất hiện tại. Các luồng chat/user/call mới đã được hợp nhất dưới `/v1`.

## Authentication

Protected route dùng JWT Bearer token:

```http
Authorization: Bearer <accessToken>
```

Token được kiểm tra bởi `authMiddleware`, sau đó requester được đặt vào `res.locals.requester`. Các route đăng nhập, đăng ký, refresh, forgot/reset password và verify email không yêu cầu access token, trừ khi route được khai báo qua middleware auth.

### Device/session headers

Auth module đọc thêm các header này để quản lý session theo thiết bị:

| Header | Mục đích |
| --- | --- |
| `x-device-id` | ID thiết bị; nếu thiếu khi login/register backend có thể sinh mới |
| `x-device-type` | Loại thiết bị do client gửi |
| `x-device-platform` | `web` hoặc `app` |
| `x-display-label` | Tên hiển thị thiết bị |
| `x-device-location` | Vị trí gần đúng do client gửi |
| `user-agent` | Parse thông tin browser/OS/device |

### Token flow chính

1. `POST /v1/auth/register` tạo user và có thể trả token nếu không bắt buộc verify email.
2. `POST /v1/auth/login` trả `accessToken`, `refreshToken`, `tokenType`, TTL, user và device/session info. Khi bật hybrid cookie, backend đồng thời set refresh token vào HttpOnly cookie `chatbe_refresh_token`.
3. `POST /v1/auth/refresh` đổi refresh token lấy cặp access/refresh token mới. Endpoint ưu tiên `refreshToken` trong JSON body, sau đó fallback sang cookie `chatbe_refresh_token`.
4. `POST /v1/auth/logout` revoke session hiện tại.
5. `POST /v1/auth/logout-all` revoke toàn bộ session của user.
6. `DELETE /v1/auth/sessions/{deviceId}` revoke một thiết bị cụ thể.

## Request Conventions

### JSON body

Các API thông thường nhận `Content-Type: application/json`. DTO validation dùng Zod trong `src/modules/*/model/dto.ts`.

### Pagination

Project có cả page/limit và cursor pagination:

- Page style: `page`, `limit`, có thể kèm `total`.
- Cursor style: `cursor`, `limit`, response có thể trả `nextCursor`, `hasMore` hoặc meta tương ứng.
- DynamoDB cursor được build từ `LastEvaluatedKey` encode base64.

### Upload

Hai luồng upload chính:

- Upload qua backend multipart: `POST /v1/media/upload`, `POST /v1/media/upload-multiple`.
- Upload cloud/presigned: request URL bằng `POST /v1/media/request-upload-url`, upload trực tiếp lên S3/R2, sau đó confirm bằng `POST /v1/media/confirm-upload`.

My Cloud cũng có endpoint upload riêng dưới `/v1/my-cloud/upload*`.

## Response Format

`/v1` được gắn `responseFormatMiddleware`, nên response được normalize về envelope hiện tại.

Success:

```json
{
  "status": "success",
  "msg": "OK",
  "data": {}
}
```

Success có meta:

```json
{
  "status": "success",
  "msg": "OK",
  "data": [],
  "meta": {
    "cursor": "base64-last-evaluated-key",
    "hasMore": true,
    "limit": 20
  }
}
```

Error:

```json
{
  "status": "error",
  "msg": "Invalid request",
  "code": "BAD_REQUEST",
  "details": {}
}
```

HTTP status vẫn là nguồn phân loại chính. Middleware map code phổ biến:

| HTTP | Code |
| --- | --- |
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 405 | `METHOD_NOT_ALLOWED` |
| 409 | `CONFLICT` |
| 422 | `VALIDATION_ERROR` |
| 500+ | `INTERNAL_ERROR` |

Một số controller legacy trả `{ error: string }` hoặc `{ message: string }`; middleware sẽ normalize khi route nằm dưới `/v1`.

## Endpoint Catalog

### Auth v1

| Method | Path | Mục đích |
| --- | --- | --- |
| POST | `/v1/auth/register` | Đăng ký user bằng phone/email/password |
| POST | `/v1/auth/login` | Đăng nhập và tạo session thiết bị |
| POST | `/v1/auth/refresh` | Refresh access token |
| POST | `/v1/auth/logout` | Đăng xuất session hiện tại |
| POST | `/v1/auth/logout-all` | Đăng xuất toàn bộ thiết bị |
| POST | `/v1/auth/introspect` | Kiểm tra token |
| POST | `/v1/auth/send-verification` | Gửi mã verify email |
| POST | `/v1/auth/verify-email` | Verify email bằng code |
| POST | `/v1/auth/resend-verification` | Gửi lại mã verify |
| POST | `/v1/auth/forgot-password` | Gửi OTP reset password |
| POST | `/v1/auth/verify-reset-otp` | Verify OTP reset password |
| POST | `/v1/auth/resend-reset-otp` | Gửi lại OTP reset password |
| POST | `/v1/auth/reset-password` | Đặt mật khẩu mới |
| POST | `/v1/auth/change-password` | Đổi mật khẩu khi đã login |
| GET | `/v1/auth/sessions` | List session thiết bị |
| DELETE | `/v1/auth/sessions` | Revoke toàn bộ session |
| DELETE | `/v1/auth/sessions/{deviceId}` | Revoke một session |
| PATCH | `/v1/auth/avatar` | Cập nhật avatar auth profile |

### User

| Method | Path | Mục đích |
| --- | --- | --- |
| GET/PATCH | `/v1/users/me/profile` | Profile của user hiện tại kèm privacy settings |
| PATCH | `/v1/users/me/privacy` | Cập nhật privacy settings |
| GET | `/v1/users/me/avatar-history` | Lịch sử avatar |
| GET/POST | `/v1/users` | List user hoặc admin tạo user |
| GET | `/v1/users/search` | Search user có áp dụng privacy |
| GET | `/v1/users/search-by-phone` | Search phone có áp dụng privacy |
| GET | `/v1/users/{id}/presence` | Presence theo privacy |
| GET | `/v1/users/{id}/public` | Public profile theo relationship/privacy |
| GET/PATCH/DELETE | `/v1/users/{id}` | Xem/cập nhật/xóa user theo id |
| GET | `/v1/friends/suggestions` | Gợi ý bạn bè |

### Chat v1 - Conversations

| Method | Path | Mục đích |
| --- | --- | --- |
| POST | `/v1/conversations/private` | Lấy hoặc tạo private conversation |
| GET | `/v1/conversations/unread-count` | Tổng unread count |
| GET | `/v1/conversations` | List conversations |
| GET | `/v1/conversations/cursor` | List conversations bằng cursor |
| GET | `/v1/conversations/{conversationId}` | Conversation detail |
| POST/DELETE | `/v1/conversations/{conversationId}/mute` | Mute/unmute conversation |
| POST/DELETE | `/v1/conversations/{conversationId}/pin-conversation` | Pin/unpin conversation |
| POST/DELETE | `/v1/conversations/{conversationId}/archive` | Archive/unarchive conversation |
| GET | `/v1/conversations/{conversationId}/statistics` | Thống kê conversation |
| GET | `/v1/conversations/{conversationId}/members/online` | Online members |
| GET | `/v1/conversations/{conversationId}/drafts` | Drafts |
| POST | `/v1/conversations/{conversationId}/copy` | Copy conversation |
| GET | `/v1/users/{userId}/conversations` | Shared conversations với user khác |

### Chat v1 - Messages

| Method | Path | Mục đích |
| --- | --- | --- |
| GET/POST | `/v1/conversations/{conversationId}/messages` | Load/gửi message |
| POST | `/v1/conversations/{conversationId}/seen` | Mark seen |
| POST | `/v1/conversations/{conversationId}/delivered` | Mark delivered |
| GET | `/v1/conversations/{conversationId}/pinned-messages` | List pinned messages |
| GET | `/v1/conversations/{conversationId}/search` | Search messages |
| GET | `/v1/conversations/{conversationId}/media` | Search media |
| DELETE | `/v1/conversations/{conversationId}/messages/bulk` | Delete nhiều message |
| PUT | `/v1/messages/{messageId}` | Edit message |
| POST | `/v1/messages/{messageId}/revoke` | Revoke message |
| POST | `/v1/messages/{messageId}/delete` | Delete for me |
| POST | `/v1/messages/{messageId}/delete-for-everyone` | Delete for everyone |
| POST | `/v1/messages/forward` | Forward messages |
| POST | `/v1/messages/save-to-my-document` | Lưu message vào My Cloud/My Document |
| POST/DELETE | `/v1/messages/{messageId}/pin` | Pin/unpin message |
| POST | `/v1/messages/{messageId}/quote` | Quote/reply |
| POST | `/v1/messages/{messageId}/translate` | Dịch message |
| GET/DELETE | `/v1/messages/{messageId}/reactions` | List/clear reactions |
| POST/DELETE | `/v1/messages/{messageId}/react` | Add/remove reaction |

### Chat v1 - Groups, Polls, Utilities

| Method | Path | Mục đích |
| --- | --- | --- |
| POST | `/v1/groups` | Tạo group |
| PUT/DELETE | `/v1/groups/{groupId}` | Cập nhật hoặc giải tán group |
| GET | `/v1/groups/{groupId}/info` | Group info |
| GET/POST | `/v1/groups/{groupId}/members` | List/thêm members |
| DELETE | `/v1/groups/{groupId}/members/{userId}` | Remove member |
| POST | `/v1/groups/{groupId}/leave` | Rời group |
| POST | `/v1/groups/{groupId}/set-admin` | Set/unset admin |
| POST | `/v1/groups/{groupId}/transfer-owner` | Chuyển owner |
| GET | `/v1/groups/{groupId}/members/pending` | Pending members |
| PATCH | `/v1/groups/{groupId}/members/{userId}/approve` | Approve member |
| PATCH | `/v1/groups/{groupId}/members/{userId}/reject` | Reject member |
| PATCH | `/v1/groups/{groupId}/settings` | Cập nhật group settings |
| GET/POST | `/v1/groups/{groupId}/polls` | List/tạo poll |
| POST | `/v1/groups/{groupId}/polls/{pollId}/vote` | Vote poll |
| POST | `/v1/groups/{groupId}/polls/{pollId}/lock` | Close poll |
| POST/DELETE | `/v1/groups/{groupId}/polls/{pollId}/pin` | Pin/unpin poll |
| GET | `/v1/groups/{groupId}/polls/{pollId}/results` | Poll results |
| GET/POST | `/v1/groups/{groupId}/reminders` | List/tạo reminder |
| PUT/DELETE | `/v1/groups/{groupId}/reminders/{reminderId}` | Update/delete reminder |
| GET/POST | `/v1/groups/{groupId}/notes` | List/tạo note |
| PUT/DELETE | `/v1/groups/{groupId}/notes/{noteId}` | Update/delete note |

### Chat canonical additions

| Method | Path | Mục đích |
| --- | --- | --- |
| GET | `/v1/conversations/strangers` | Message request/stranger conversations |
| GET | `/v1/conversations/{conversationId}/presence` | Presence trong conversation |
| POST | `/v1/conversations/{conversationId}/profile-cards` | Gửi profile card |
| POST | `/v1/conversations/{conversationId}/hide` | Hide conversation |
| POST | `/v1/conversations/{conversationId}/unlock` | Unlock hidden conversation |
| POST | `/v1/conversations/{conversationId}/unhide` | Unhide conversation |
| POST | `/v1/messages/private` | Gửi private message |
| GET | `/v1/message-requests` | List message requests |
| POST | `/v1/message-requests/{conversationId}/accept` | Accept message request |
| POST | `/v1/message-requests/{conversationId}/reject` | Reject message request |

### Media

| Method | Path | Mục đích |
| --- | --- | --- |
| POST | `/v1/media/upload` | Upload một file qua backend |
| POST | `/v1/media/upload-multiple` | Upload nhiều file |
| DELETE | `/v1/media/{filename}` | Delete media |
| POST | `/v1/media/request-upload-url` | Request presigned URL |
| POST | `/v1/media/confirm-upload` | Confirm upload cloud |
| GET | `/v1/media/upload-methods` | Xem upload methods đang hỗ trợ |

### Friendships and Friend Requests

| Method | Path | Mục đích |
| --- | --- | --- |
| GET | `/v1/friendships` | List friends |
| DELETE | `/v1/friendships/{friendId}` | Unfriend |
| GET | `/v1/friendships/{friendId}/check` | Check friendship |
| GET | `/v1/users/{id}/mutual-friends` | Mutual friends |
| GET | `/v1/users/{id}/suggestions` | Friend suggestions |
| GET | `/v1/friendships/count` | Count friends |
| GET | `/v1/friendships/search` | Search friends |
| POST | `/v1/friend-requests/{receiverId}` | Gửi request |
| PATCH/DELETE | `/v1/friend-requests/{requestId}` | Accept/reject/cancel/delete request |
| GET | `/v1/friend-requests/received` | Requests đã nhận |
| GET | `/v1/friend-requests/sent` | Requests đã gửi |
| GET | `/v1/friend-requests/check/{targetUserId}` | Check request status |
| GET | `/v1/friend-requests/count` | Count pending requests |

Không còn social alias version khác; dùng các route `/v1` trong bảng trên.

### Blocks

| Method | Path | Mục đích |
| --- | --- | --- |
| POST/DELETE | `/v1/blocks/{blockedUserId}` | Block/unblock user |
| GET | `/v1/blocks` | List blocked users |
| GET | `/v1/blocks/{blockedUserId}/check` | Check block status |

Không còn block alias version khác; dùng các route `/v1` trong bảng trên.

### My Cloud

| Method | Path | Mục đích |
| --- | --- | --- |
| GET/POST | `/v1/my-cloud` | List/tạo cloud item |
| GET | `/v1/my-cloud/items` | List items |
| POST | `/v1/my-cloud/upload` | Upload vào My Cloud |
| POST | `/v1/my-cloud/upload/presigned` | Request upload presigned cho My Cloud |
| POST | `/v1/my-cloud/upload/confirm` | Confirm upload |
| GET/PATCH/DELETE | `/v1/my-cloud/{id}` | Xem/cập nhật/delete item |
| PATCH | `/v1/my-cloud/{id}/pin` | Pin/unpin item |
| POST | `/v1/my-cloud/{id}/restore` | Restore item |
| DELETE | `/v1/my-cloud/{id}/permanent` | Delete permanent |
| POST | `/v1/my-cloud/{id}/share` | Share item bằng token |
| POST | `/v1/my-cloud/{id}/forward` | Forward item vào chat |
| GET | `/v1/my-cloud/shared/{shareToken}` | Xem item shared |
| GET | `/v1/my-cloud/search` | Search My Cloud |
| GET | `/v1/my-cloud/stats` | Stats |
| POST | `/v1/my-cloud/batch-delete` | Batch delete |
| POST | `/v1/my-cloud/trash/empty` | Empty trash |
| GET/POST | `/v1/my-cloud/collections` | List/tạo collection |
| GET/PATCH/DELETE | `/v1/my-cloud/collections/{id}` | Xem/cập nhật/delete collection |
| GET/POST | `/v1/my-cloud/collections/{id}/items` | List/add item vào collection |
| DELETE | `/v1/my-cloud/collections/{id}/items/{itemId}` | Remove item khỏi collection |

### Search

| Method | Path | Mục đích |
| --- | --- | --- |
| GET | `/v1/search` | Global search across supported domains |

### Calls

| Method | Path | Mục đích |
| --- | --- | --- |
| POST | `/v1/calls` | Tạo call LiveKit Cloud |
| GET | `/v1/calls/conversations/{conversationId}/active` | Active call theo conversation |
| GET | `/v1/calls/active-by-conversation/{conversationId}` | Alias active call |
| POST | `/v1/calls/{callId}/join` | Join call |
| POST | `/v1/calls/{callId}/leave` | Leave call |
| POST | `/v1/calls/{callId}/reject` | Reject call |
| POST | `/v1/calls/{callId}/missed` | Mark missed |
| POST | `/v1/calls/{callId}/end` | End call |
| DELETE | `/v1/calls/{callId}` | End call alias |
| GET | `/v1/calls/{callId}/token` | Lấy token |

### AI

Tất cả route AI nằm dưới `/v1/ai` và được bảo vệ bằng auth middleware.

| Method | Path | Mục đích |
| --- | --- | --- |
| POST | `/v1/ai/summarize` | Tóm tắt nội dung |
| POST | `/v1/ai/smart-reply` | Gợi ý trả lời |
| POST | `/v1/ai/tone-adjust` | Điều chỉnh giọng văn |
| POST | `/v1/ai/translate` | Dịch văn bản |
| POST | `/v1/ai/detect-language` | Detect language |

## Flow Details

### Register/login/session

- Client gửi phone/email/password và device headers.
- Auth usecase hash password bằng bcrypt, lưu user vào DynamoDB, tạo access/refresh token.
- Session metadata lưu trong Redis theo device, với một session web và một session app đang hoạt động cho mỗi user.
- Refresh token rotate sau mỗi lần dùng; token đã rotate được đánh dấu consumed để phát hiện reuse. Nếu refresh token cũ bị dùng lại, session của device đó bị revoke.
- Logout/revoke session đưa refresh token/session vào Redis revoke state và blacklist access token hiện tại để chặn refresh hoặc access tiếp.

### Profile/privacy

- Profile/privacy dùng `UserPrivacySchema` để kiểm soát search, birthday/phone/avatar visibility, online/last-seen và message từ stranger.
- Presence response có thể bị ẩn theo privacy và relationship.

### Private chat

- Private conversation lookup bằng `pairKey = minUserId:maxUserId`.
- Member state nằm ở `conversation_members`, không nằm trong conversation document.
- Message lưu ở `messages` theo `CONV#{conversationId}` và sort key thời gian.

### Group chat

- Group owner/admin/member được kiểm tra qua `conversation_members`.
- Settings điều khiển invite, require approval, link sending, who can send messages và permission cho poll/reminder/note.
- Group actions phát Socket.IO event tương ứng cho member liên quan.

### Message lifecycle

- Send message tạo item trong `messages`, cập nhật `lastMessage` trong conversation và unread/activity trong member rows.
- Edit chỉ áp dụng message hợp lệ theo rule trong usecase.
- Delete for me cập nhật `deletedForUserIds`.
- Delete for everyone/revoke cập nhật lifecycle state và phát realtime event.
- Media/link được classify thêm vào `message_classifications` để search nhanh.

### Media upload

- Local upload dùng multer và storage config.
- Cloud upload yêu cầu `CLOUD_STORAGE_ENABLED=true`, bucket/region/access key hợp lệ.
- Presigned flow: request URL, client upload trực tiếp, confirm để backend ghi nhận metadata.

### Calls

- Calls dùng LiveKit Cloud config: `LIVEKIT_CLOUD_API_KEY`, `LIVEKIT_CLOUD_API_SECRET`, `LIVEKIT_CLOUD_WS_URL`.
- Call state runtime nằm trong service memory; call log có thể phát message hệ thống vào chat khi call kết thúc/missed/rejected.

### AI

- AI provider hiện dùng Google Gemini qua `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_MAX_TOKENS`, `AI_TEMPERATURE`.
- AI routes nên được gọi sau auth vì có thể dùng user context và conversation/message data.

## Realtime Socket API

Socket.IO server được tạo trong `src/share/component/socket-io.ts`; chat socket handlers nằm trong `src/modules/chat/infras/transport/socket`.

Auth:

- Socket handshake cần JWT token theo cấu hình socket middleware.
- Sau khi connect, server emit `connected`.

Các event nền:

- Client to server: `ping`, `heartbeat`, `subscribeConversation`, `unsubscribeConversation`, `getOnlineStatus`, `getBatchOnlineStatus`.
- Server to client: `connected`, `pong`, `online_status`, `user_presence`, `session:revoked`.

Chat event chính:

- Client to server: `sendMessage`, `editMessage`, `deleteMessage`, `revokeMessage`, `messageSeen`, `messageDelivered`, `typing:start`, `typing:stop`.
- Server to client: `receiveMessage`, `message:edited`, `message:deleted`, `message:revoked`, `message:deleted_for_everyone`.
- `sendMessage` nhận thêm optional `clientMessageId` để retry idempotent theo `{conversationId, senderId, clientMessageId}`; retry trả lại message đã tạo và không tăng unread lần hai.
- `receiveMessage` được emit vào `user:{userId}` của mọi member, gồm cả sender, nên nhiều tab cùng user đều nhận cùng message và frontend nên dedupe theo `message.id`.
- `messageSeen`/`messageDelivered` chỉ broadcast khi marker tiến lên. Payload giữ field cũ và bổ sung `conversationId`, `userId`, `lastSeenMessageId`/`lastDeliveredMessageId`, `lastReadMessageId`, `unreadCount`, các mốc `...At`, `...MessageCreatedAt`, `updatedAt`; actor user room cũng nhận event để các tab còn lại sync unread/read marker.

Group/poll/utility event chính:

- Client to server: `joinGroup`, `leaveGroup`, `addMembers`, `removeMember`, `setAdmin`, `transferOwner`, `createPoll`, `votePoll`, `createReminder`, `createNote`.
- Server to client: `conversation:members_added`, `group:member_left`, `group:settings_updated`, `poll:new`, `poll:vote`, `group:reminder_created`, `group:note_created`.

Call socket namespaces/services emit các event `call:incoming`, `call:ringing`, `call:answered`, `call:rejected`, `call:ended`, `call:missed`, và nhận `call:join`, `call:leave`.

## Source of Truth

- API detail đầy đủ: `docs/swagger/main.yaml`.
- HTTP mount: `src/index.ts`.
- DTO validation: `src/modules/*/model/dto.ts`.
- Response normalization: `src/share/middleware/response-format.ts`.
- Auth middleware: `src/share/middleware/auth.ts`.
- Socket event constants: `src/modules/chat/constants/socket-events.ts`.
