# Backend Architecture Audit

> Nguồn: phân tích source code tại `d:/be/bezl/chatBE/src/`
> Tài liệu này xác thực thông tin từ source code thực tế, không suy đoán.

---

## 1. Tổng quan kiến trúc backend

### Mô hình kiến trúc

Backend ChatBE tổ chức theo mô hình **Modular Monolith kết hợp Hexagonal Architecture (hexagon-ish)**:

- **Modular Monolith**: toàn bộ code triển khai trong một process duy nhất (`src/index.ts`). Không có service riêng biệt. Mỗi module (auth, user, chat, call, ai, media, search, blocks, friend-requests, friendships) là một đơn vị độc lập về mặt nghiệp vụ nhưng chia sẻ cùng một deployment.
- **Hexagonal Architecture**: mỗi module theo cấu trúc `model / dto / errors / interface / usecase / infras (repository + transport)`. Dependency chảy từ transport -> usecase -> repository, không ngược lại.

### Các layer chính

| Layer | Vai trò | Thư mục/File |
|---|---|---|
| Transport (HTTP) | Parse request/response, gọi usecase, điều phối socket | `src/modules/*/infras/transport/http/` |
| Transport (Socket) | Xử lý socket event, emit realtime | `src/modules/*/infras/transport/socket/` |
| UseCase | Business logic thuần túy, quy tắc nghiệp vụ, phân quyền | `src/modules/*/usecase/*.ts` |
| Repository | Truy xuất DynamoDB, ánh xạ entity | `src/modules/*/infras/repository/dynamodb/` |
| Middleware | Auth, response format, upload, rate limit, role check | `src/share/middleware/` |
| Infrastructure (Redis) | Session, presence, token blacklist, pub/sub | `src/share/component/redis-pubsub/`, `src/modules/*/infras/redis/` |
| External Adapter | LiveKit, Gemini, S3/Cloud storage, SMTP | `src/modules/call/`, `src/modules/ai/`, `src/modules/media/`, `src/modules/auth/infras/email/` |

### Dẫn chứng thư mục chính

```
src/
  index.ts                      # Entry point, bootstrap toàn bộ app
  share/
    app-error.ts                # Global error handling (AppError, responseErr)
    component/
      config.ts                # Env config loader
      socket-io.ts             # Socket.IO server + connection registry
      redis-pubsub/
        redis.ts               # Redis singleton client
        interface.ts           # IEventPublisher
    middleware/
      auth.ts                  # JWT auth middleware
      response-format.ts       # /v1 response envelope
      upload/                  # Multer + storage abstraction
      health-check.ts          # /health, /health/ready, /health/live
    repository/
      dynamodb/
        table-defs.ts          # Tất cả table schema, GSI, TTL (ALL_TABLES)
        client.ts              # DynamoDB client
        repo-dynamodb.ts       # Base repository class
        auto-init.ts           # Table auto-creation
    transport/
      http-server.ts           # Base controller (legacy, CRUD pattern)
    utils/
      logger.ts                # Winston logger
      rate-limiter.ts          # Redis-backed rate limiter
      retry.ts                 # Generic retry utility (backoff)
      zod-validators.ts        # Shared Zod schemas
  modules/
    auth/                      # Login, register, session, device, JWT, OTP
    user/                      # Profile, privacy, presence
    chat/                      # Conversation, message, group, poll, reminder, note
    media/                     # Upload, presigned URL, delete
    call/                      # LiveKit token, call session
    ai/                        # Gemini AI: summarize, smart-reply, translate, etc.
    search/                    # Global search
    blocks/                    # User block user
    friend-requests/           # Send, accept, reject friend request
    friendships/              # Friend list, unfriend, suggestions
```

---

## 2. Tech stack thực tế trong backend

| Công nghệ | Vai trò | File liên quan |
|---|---|---|
| **Node.js 22+** | Runtime | `package.json` devDependencies |
| **TypeScript 5.6** | Language | `package.json`, `tsconfig.json` |
| **Express 4.21** | HTTP framework | `package.json`, `src/index.ts` |
| **Socket.IO 4.8** | Realtime | `package.json`, `src/share/component/socket-io.ts`, `src/modules/*/infras/transport/socket/` |
| **AWS DynamoDB** (aws-sdk lib-dynamodb v3) | Database chính | `src/share/repository/dynamodb/`, `docs/DATABASE.md` |
| **Redis 7** (redis v4) | Session, token blacklist, presence, rate limit, pub/sub | `src/share/component/redis-pubsub/redis.ts`, `src/modules/auth/infras/redis/`, `src/modules/user/infras/repository/redis/`, `docker-compose.yml` |
| **JWT** (jsonwebtoken v9) + **bcrypt v5** | Authentication | `src/modules/auth/infras/token/`, `src/share/component/jwt.ts` |
| **Zod v3** | Request/response validation | `src/modules/*/model/dto.ts` |
| **Swagger YAML + Swagger UI** | API documentation | `docs/swagger/main.yaml`, `src/index.ts` |
| **LiveKit Server SDK v2** | Audio/video call token | `src/modules/call/infras/livekit/`, `src/modules/call/usecase/` |
| **Google Gemini** (@google/generative-ai v0.21) | AI features | `src/modules/ai/infras/provider/gemini-provider.ts` |
| **AWS S3 SDK** (@aws-sdk/client-s3, s3-request-presigner) | Cloud file storage | `src/modules/media/`, `src/share/middleware/upload/cloud-storage.ts` |
| **Nodemailer v6** | Email sending (OTP, verification) | `src/modules/auth/infras/email/` |
| **Winston v3** | Structured logging | `src/share/utils/logger.ts` |
| **Multer v1.4** | Multipart file upload | `src/share/middleware/upload/` |
| **Multer + local storage** | Local file storage fallback | `src/share/middleware/upload/local-storage.ts` |
| **CORS** | Cross-origin resource sharing | `src/index.ts` |
| **Morgan v1** | HTTP request logging | `src/index.ts` |
| **Jest v29** | Testing framework | `package.json`, `jest.config.ts`, `tests/` |
| **Docker** (Node 22 Alpine) | Containerization | `Dockerfile`, `docker-compose.yml`, `docker-compose.local.yml`, `docker-compose.prod.yml` |
| **PM2** | Process manager (production) | `ecosystem.config.js`, `npm run pm2:*` |
| **GitHub Actions CI/CD** | CI pipeline + CD to VPS/EC2 | `.github/workflows/ci.yml`, `.github/workflows/cd.yml`, `.github/workflows/cd-manual.yml` |
| **module-alias** | Path alias (@root, @modules, @share) | `package.json._moduleAliases`, `tsconfig.json` |
| **UUID v10** | ID generation | `package.json` |
| **Axios** | HTTP client (external) | `package.json` |
| **Chalk v4** | CLI color output | `src/share/utils/logger.ts` |

---

## 3. Các module/chức năng chính

### 3.1. Auth Module

- **Mục đích nghiệp vụ**: Xác thực người dùng, quản lý session thiết bị, JWT token, refresh token rotation, OTP reset password, email verification.
- **Service chính**: `AuthUseCase` (`src/modules/auth/usecase/index.ts`)
- **Transport chính**: `AuthHTTPService` (`src/modules/auth/infras/transport/`)
- **Model/entity**: `src/modules/auth/model/` (RegistrationDTOSchema, LoginDTOSchema, PasswordResetDTOSchema, OTP)
- **Middleware liên quan**: `authMiddleware` (`src/share/middleware/auth.ts`)
- **Infrastructure**:
  - `RedisSessionStore` — Redis lưu session theo deviceId (`session:{deviceId}`, `user:sessions:{userId}`)
  - `TokenBlacklistService` — Redis lưu blacklist access token theo JTI (`blacklist:{jti}`)
  - `RedisRefreshTokenStore` — Redis lưu refresh token (`refresh:{jti}`, `refresh:used:{jti}`)
  - `AccessTokenService` — Tạo/verify JWT access token
  - `RefreshTokenService` — Rotate refresh token
  - `EmailTemplateService` — Gửi email OTP/verification qua SMTP
- **API chính**: `/v1/auth/register`, `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout`, `/v1/auth/logout-all`, `/v1/auth/sessions`, `/v1/auth/change-password`, `/v1/auth/forgot-password`, `/v1/auth/verify-reset-otp`, `/v1/auth/reset-password`, `/v1/auth/verify-email`, `/v1/auth/sessions/{deviceId}`, `/v1/auth/avatar`

### 3.2. User Module

- **Mục đích nghiệp vụ**: Quản lý hồ sơ người dùng, privacy settings, presence (online/offline/last seen), avatar history, relationship-based visibility.
- **Service chính**: `UserUseCase`, `PresenceUseCase`, `RelationshipPrivacyPolicyV2` (`src/modules/user/usecase/`)
- **Transport chính**: `UserHTTPService`, `setupUserV2Routes` (`src/modules/user/infras/transport/`)
- **Socket service**: `UserSocketService` — xử lý heartbeat, presence emit (`src/modules/user/infras/transport/socket-service.ts`)
- **Model liên quan**: `src/modules/user/model/`
- **Middleware liên quan**: Presence check dựa trên privacy (`showOnline`, `showLastSeen`, `blockMessagesFromStrangers`)
- **Repository**: `DynamoUserRepository` (DynamoDB), `RedisPresenceRepository` (Redis: `online:{userId}`, `last_seen:{userId}`, `presence:user:{userId}:sockets`)
- **API chính**: `/v1/users/me/profile`, `/v1/users/me/privacy`, `/v1/users/me/avatar-history`, `/v1/users/{id}`, `/v1/users/search`, `/v1/users/search-by-phone`, `/v1/users/{id}/presence`, `/v1/users/{id}/public`, `/v1/friends/suggestions`

### 3.3. Chat Module (lớn nhất)

- **Mục đích nghiệp vụ**: Quản lý hội thoại private/group, tin nhắn, phản ứng, ghim, tìm kiếm, group management, utilities (poll, reminder, note), message request/stranger, hidden conversations, shared conversations, draft, typing, read/delivered, forward, copy.
- **Service chính**: `MessagingUseCaseFacade` tổng hợp ~70 handler (`src/modules/chat/usecase/index.ts`), `ChatAccessPolicy` kiểm tra quyền truy cập, `GroupUtilityWorker` chạy interval để close expired polls và process due reminders.
- **Transport chính**: `MessagingHttpService`, `ChatV2Controller` (`src/modules/chat/infras/transport/http/`)
- **Socket service**: `MessagingSocketService` — emit message, typing, reaction, group events (`src/modules/chat/infras/transport/socket/`)
- **Socket handlers**: `message.handlers.ts`, `member.handlers.ts`, `reaction.handlers.ts`, `invite-block.handlers.ts`, `notifiers.ts`
- **Socket event constants**: `src/modules/chat/constants/socket-events.ts` (khoảng 60+ event name)
- **Repositories** (DynamoDB):
  - `DynamoConversationRepository` — table `conversations`
  - `DynamoConversationMemberRepository` — table `conversation_members`
  - `DynamoMessageRepository` — table `messages`
  - `DynamoMessageReactionQueryRepository` / `DynamoMessageReactionCommandRepository` — table `message_reactions`
  - `DynamoMessageClassificationRepository` — table `message_classifications`
  - `DynamoPollRepository` (Query + Command) — table `polls`
  - `DynamoGroupReminderRepository` — table `group_reminders`
  - `DynamoGroupNoteRepository` — table `group_notes`
  - `DynamoGroupInviteLinkRepository` — table `group_invite_links`
  - `DynamoGroupBlockRepository` — table `group_blocks`
- **Model liên quan**: `src/modules/chat/model/` (Conversation, Message, ConversationMember, Poll, GroupReminder, GroupNote, Reaction, Classification, DTOs)
- **Middleware liên quan**: Socket rate limiter (`chat-socket-rate-limiter.test.ts` ghi nhận có rate limit cho socket)
- **API chính** (70+ endpoints): conversation CRUD, message CRUD, group CRUD + settings + members, poll CRUD + vote + pin + close, reminder CRUD + pin, note CRUD, media search, message search, reactions, read/delivered/seen markers, mute/pin/archive, invite links, group blocks, hidden conversations, message requests, drafts, translate, forward, copy, statistics, shared conversations, draft.

### 3.4. Media Module

- **Mục đích nghiệp vụ**: Upload file (local hoặc cloud), xóa file, request presigned URL, confirm upload.
- **Service chính**: `UploadMediaCmdHandler`, `UploadMultipleMediaCmdHandler`, `DeleteMediaCmdHandler`, `RequestPresignedUrlCmdHandler`, `ConfirmUploadCmdHandler`
- **Transport chính**: `MediaHttpService` (`src/modules/media/infras/transport/`)
- **Storage**: `LocalStorageAdapter` (`src/share/middleware/upload/local-storage.ts`) hoặc `CloudStorageAdapter` (`src/share/middleware/upload/cloud-storage.ts`) dùng AWS S3 SDK. Storage được chọn qua config `CLOUD_STORAGE_ENABLED`.
- **Model liên quan**: `src/modules/media/model/`
- **API chính**: `/v1/media/upload`, `/v1/media/upload-multiple`, `/v1/media/{filename}`, `/v1/media/request-upload-url`, `/v1/media/confirm-upload`, `/v1/media/upload-methods`

### 3.5. Call Module

- **Mục đích nghiệp vụ**: Tạo/phát video/audio call token LiveKit, join/leave/reject/end call, call log ghi vào chat.
- **Service chính**: `CallV2Service`, `CallLogService` (`src/modules/call/usecase/`)
- **Transport chính**: `CallV2Controller` (`src/modules/call/infras/transport/http/`)
- **Socket service**: `CallV2SocketService` — emit `call:incoming`, `call:ringing`, `call:answered`, `call:rejected`, `call:ended`, `call:missed`
- **LiveKit adapter**: `LivekitService` hỗ trợ cả self-hosted (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`) và Cloud (`LIVEKIT_CLOUD_API_KEY`, `LIVEKIT_CLOUD_API_SECRET`, `LIVEKIT_CLOUD_WS_URL`)
- **Model liên quan**: `src/modules/call/model/`
- **API chính**: `/v1/calls` (tạo), `/v1/calls/{callId}/join`, `/v1/calls/{callId}/leave`, `/v1/calls/{callId}/reject`, `/v1/calls/{callId}/missed`, `/v1/calls/{callId}/end`, `/v1/calls/{callId}/token`, `/v1/calls/conversations/{conversationId}/active`, `/v1/calls/active-by-conversation/{conversationId}`

### 3.6. AI Module

- **Mục đích nghiệp vụ**: AI hỗ trợ chat — tóm tắt, gợi ý trả lời, điều chỉnh giọng văn, dịch, trích xuất công việc, kiểm duyệt nội dung, tìm kiếm thông minh.
- **Service chính**: `AiUseCaseFacade` tổng hợp `SummarizationUseCase`, `SmartReplyUseCase`, `ToneAdjustmentUseCase`, `TranslationUseCase`, `TaskExtractionUseCase`, `ModerationUseCase`, `SmartSearchUseCase`
- **Provider**: `GeminiProvider` (`src/modules/ai/infras/provider/gemini-provider.ts`) — gọi Google Gemini, có `withRetry` cho retry logic, model `gemini-2.0-flash` mặc định, config qua `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_MAX_TOKENS`, `AI_TEMPERATURE`.
- **Transport**: `AiHttpService` (REST) và `AiSocketService` (Socket.IO namespace `/ai`)
- **Socket events**: `ai:summarize`, `ai:smart_reply`, `ai:tone_adjust`, `ai:translate`, `ai:smart_search`, `ai:extract_tasks`, `ai:moderate`
- **Model liên quan**: `src/modules/ai/model/`
- **API chính**: `/v1/ai/summarize`, `/v1/ai/smart-reply`, `/v1/ai/tone-adjust`, `/v1/ai/translate`, `/v1/ai/detect-language`, `/v1/ai/smart-search`, `/v1/ai/extract-tasks`, `/v1/ai/moderate`

### 3.7. Search Module

- **Mục đích nghiệp vụ**: Tìm kiếm toàn cục — user, conversation, message, media.
- **Service chính**: `SearchUseCase` (`src/modules/search/usecase/`)
- **Transport chính**: `SearchHTTPService` (`src/modules/search/infras/transport/`)
- **Repositories**: `DynamoUserRepository`, `DynamoConversationRepository`, `DynamoMessageRepository`, `DynamoMessageClassificationRepository`, `DynamoBlockRepository`
- **API chính**: `/v1/search` (global search)

### 3.8. Blocks Module

- **Mục đích nghiệp vụ**: User chặn user khác. Kiểm tra block relationship trước mọi thao tác chat.
- **Service chính**: `BlockUseCase` (`src/modules/blocks/usecase/`)
- **Socket service**: `BlockNotificationSocketService` — thông báo realtime khi bị block
- **Repository**: `DynamoBlockRepository` (DynamoDB table `blocks`)
- **API chính**: `/v1/blocks`, `/v1/blocks/{blockedUserId}`, `/v1/blocks/{blockedUserId}/check`, `/v1/blocks/cursor`

### 3.9. Friend Requests Module

- **Mục đích nghiệp vụ**: Gửi, chấp nhận, từ chối lời mời kết bạn.
- **Service chính**: `FriendRequestUseCase`
- **Socket service**: `FriendNotificationSocketService` — realtime thông báo khi nhận/chấp nhận/từ chối
- **Repository**: `DynamoFriendRequestRepository`
- **API chính**: `/v1/friend-requests/{receiverId}`, `/v1/friend-requests/received`, `/v1/friend-requests/sent`, `/v1/friend-requests/{requestId}`, `/v1/friend-requests/count`

### 3.10. Friendships Module

- **Mục đích nghiệp vụ**: Quản lý danh sách bạn bè, unfriend, bạn chung, gợi ý kết bạn.
- **Service chính**: `FriendshipUseCase`
- **Socket service**: Dùng chung `FriendNotificationSocketService` từ friend-requests module
- **Repository**: `DynamoFriendshipRepository`
- **API chính**: `/v1/friendships`, `/v1/friendships/{friendId}`, `/v1/friendships/count`, `/v1/friendships/search`, `/v1/users/{id}/mutual-friends`, `/v1/users/{id}/suggestions`

### 3.11. Health Check

- **Endpoint**: `/health` (full), `/health/live` (liveness), `/health/ready` (readiness)
- **Implement**: `src/share/middleware/health-check.ts` — kiểm tra Redis ping và DynamoDB ListTables

---

## 4. Luồng xử lý chính của hệ thống

### 4.1. Luồng đăng nhập và quản lý phiên

1. Client gửi `POST /v1/auth/login` với body `{ email/phone, password }` và headers `x-device-id`, `x-device-platform`, `x-display-label`, `user-agent`.
2. `AuthUseCase.login()` hash password bằng bcrypt, so sánh với `password` field trong DynamoDB `users` table.
3. Tạo JWT access token (15 phút mặc định, `JWT_ACCESS_SECRET`) và refresh token (7 ngày mặc định, `JWT_REFRESH_SECRET`). Cả hai mang `sub` (userId), `jti`, `deviceId`, `tokenVersion`, `role`.
4. Refresh token được lưu vào Redis: `refresh:{jti}` với TTL = thời hạn refresh token.
5. Session metadata lưu vào Redis: `session:{deviceId}`, `user:sessions:{userId}`.
6. Refresh token rotate sau mỗi lần dùng: token cũ được đánh dấu consumed bằng `refresh:used:{jti}` trước khi tạo token mới. Nếu token đã consumed bị dùng lại, backend revoke toàn bộ session device đó.
7. Device limit: mỗi user giữ tối đa một session `web` và một session `app`; login mới cùng platform revoke session cũ cùng platform.
8. Khi refresh token hết hạn hoặc bị revoke, access token vẫn hoạt động đến khi hết TTL. Logout đưa token vào blacklist (`blacklist:{accessJti}`) và revoke session.
9. Sau đăng nhập, client kết nối Socket.IO bằng JWT token từ handshake. Server xác thực token trong middleware `authenticateSocketConnection`, emit `connected` event, đăng ký presence vào Redis (`online:{userId}`).

### 4.2. Luồng gửi tin nhắn realtime

1. Client gửi socket event `sendMessage` với payload `{ conversationId, text?, media?, clientMessageId?, ttlSeconds? }`.
2. `MessagingSocketService` (thông qua `messageSocketHandlers.handleSendMessage`) validate payload, kiểm tra membership bằng `ChatAccessPolicy`, kiểm tra rate limit.
3. Nếu `clientMessageId` được gửi, backend kiểm tra idempotency bằng cách query DynamoDB `clientMessageKey-index`. Nếu message đã tồn tại, trả về message cũ mà không tăng unread.
4. `SendMessageHandler` (private) hoặc `SendGroupMessageHandler` (group) tạo message record trong DynamoDB `messages` table với key `pk=CONV#{conversationId}`, `sk=MSG#{createdAtISO}#{messageId}`.
5. Cập nhật `conversation_members` cho mỗi member: tăng `unreadCount`, cập nhật `lastActivityAt`, cập nhật `lastMessage` / `lastMessageAt` trong `conversations`.
6. Nếu có media, classify vào `message_classifications` table (image/video/file/link/sticker/gif).
7. Backend emit `receiveMessage` (tên constant: `RECEIVE_MESSAGE`) vào `user:{userId}` room của mỗi member (bao gồm cả sender).
8. HTTP path tương đương: `POST /v1/conversations/{conversationId}/messages` cũng gọi cùng handler.

### 4.3. Luồng tạo hội thoại nhóm

1. Client gọi `POST /v1/groups` với `{ name, memberIds }`.
2. `CreateGroupHandler` tạo record trong `conversations` table (type=`group`), tạo member records trong `conversation_members` cho mỗi member với role tương ứng (owner, admin, member).
3. Phân quyền: người tạo là owner, có thể chỉ định admin. Owner/admin có thể `set-admin`, `transfer-owner`, `remove-member`, `dissolve-group`.
4. Group settings kiểm soát: `allowSendLink`, `requireApproval`, `allowMemberInvite`, `whoCanSendMessages`, `whoCanAddMembers`, `whoCanUpdateGroupInfo`, `whoCanPinMessages`, `newMemberCanViewHistory`, và quyền utilities (poll/reminder/note).
5. Backend emit group event qua Socket.IO cho các member.

### 4.4. Luồng upload media/file/avatar

1. **Luồng 1 (backend multipart)**: Client gửi `POST /v1/media/upload` với `multipart/form-data`. Backend dùng Multer, lưu file vào `uploads/` (local) hoặc upload lên S3. Trả về file URL.
2. **Luồng 2 (presigned URL)**: Client gọi `POST /v1/media/request-upload-url` để nhận presigned URL từ S3 SDK. Client upload trực tiếp lên S3. Sau đó gọi `POST /v1/media/confirm-upload` để backend ghi nhận metadata.
3. Storage được chọn qua `CLOUD_STORAGE_ENABLED`: nếu `true` dùng S3, ngược lại dùng local.
4. File metadata không được lưu vào database riêng — URL file được embed vào message media field.

### 4.5. Luồng gọi audio/video

1. Backend tạo call session khi nhận `POST /v1/calls` hoặc khi member join call (`POST /v1/calls/{callId}/join`).
2. `LivekitService` phát LiveKit token dựa trên provider (self-hosted hoặc Cloud). Token mang `participantIdentity`, `roomName`, permissions.
3. Call state runtime nằm trong service memory (`CallV2Service`). Khi call kết thúc (`POST /v1/calls/{callId}/end`), `CallLogService` ghi message type `call` vào chat conversation.
4. Backend emit socket events `call:incoming`, `call:ringing`, `call:answered`, `call:rejected`, `call:ended`, `call:missed`.

### 4.6. Luồng AI assistant

1. Backend gọi Google Gemini qua `GeminiProvider.generateContent()` với prompt và system instruction.
2. Có retry logic: `withRetry(fn, { retries: 3, delayMs: 3000, backoffMultiplier: 1 })` trong `gemini-provider.ts`.
3. AI dùng cho 7 chức năng: summarize (tóm tắt conversation), smart-reply (gợi ý trả lời), tone-adjust (điều chỉnh giọng văn), translate (dịch message), detect-language (nhận diện ngôn ngữ), extract-tasks (trích xuất công việc từ chat), moderate (kiểm duyệt nội dung nhạy cảm), smart-search (tìm kiếm thông minh).
4. Không lưu lịch sử hội thoại AI vào database. Mỗi request gửi toàn bộ context cần thiết.
5. Không có rate limit riêng cho AI (ngoài global rate limit HTTP).

---

## 5. Database, Redis và External Services

### 5.1. Database

**DynamoDB** — 15 table active (trong `ALL_TABLES`), 2 table có trong code nhưng chưa auto-init:

| Table | Domain | Primary Key | GSI |
|---|---|---|---|
| `users` | Auth/User | `id` | `email-index`, `phone-index`, `username-index` |
| `user_avatar_history` | User | `pk=userId`, `sk=createdAt` | `id-index` |
| `conversations` | Chat | `id` | `pairKey-index` |
| `conversation_members` | Chat | `pk=CONV#{id}`, `sk=MEM#{userId}` | `userId-index`, `id-index`, `userId-lastActivityAt-index` |
| `messages` | Chat | `pk=CONV#{id}`, `sk=MSG#{createdAt}#{id}` | `id-index`, `clientMessageKey-index` |
| `message_reactions` | Chat | `pk=MSG#{messageId}`, `sk=REACT#{userId}#{emoji}` | — |
| `message_classifications` | Chat/Search | `pk`, `sk` | `GSI1`, `messageId-index` |
| `polls` | Chat | `id` | `conversation-index`, `status-expiresAt-index` |
| `group_reminders` | Chat | `id` | `conversation-index`, `status-nextNotifyAt-index` |
| `group_notes` | Chat | `id` | `conversation-index` |
| `friendships` | Social | `pk=userA`, `sk=userB` | `userA-createdAt-index`, `userB-index` |
| `friend_requests` | Social | `id` | `senderId-index`, `receiverId-index`, `senderId-createdAt-index`, `receiverId-createdAt-index` |
| `group_invite_links` | Chat | `token` | `conversationId-status-index` |
| `group_blocks` | Chat | `pk=GROUP#{convId}`, `sk=USER#{userId}` | `userId-index`, `blockedBy-index` |
| `blocks` | Social | `pk=blockerId`, `sk=blockedUserId` | `blockerId-createdAt-index` *(chưa trong ALL_TABLES)* |
| `stories` | *(planned)* | — | — *(chưa có table definition)* |
| `story_views` | *(planned)* | — | — *(chưa có table definition)* |

- Billing mode: `PAY_PER_REQUEST` (on-demand) cho tất cả table.
- Messages table có TTL: `expireAtEpoch` enabled.
- Idempotency: messages table dùng `IDEMP#{conversationId}#{senderId}` + `sk=CLIENT#{clientMessageId}` cho retry dedup.

### 5.2. Redis

Redis được khởi tạo từ `RedisClient.init(REDIS_URL)` tại `src/index.ts`. Các nhóm dữ liệu:

| Nhóm | Key pattern | TTL | Mục đích |
|---|---|---|---|
| Session | `session:{deviceId}` | Theo token expiry | Session metadata theo thiết bị |
| User sessions | `user:sessions:{userId}` | — | Index tất cả session của user |
| Refresh token | `refresh:{jti}` | Theo token expiry | Lưu refresh token để rotate |
| Refresh consumed | `refresh:used:{jti}` | Bằng TTL cũ | Đánh dấu token đã rotate |
| Access token blacklist | `blacklist:{accessJti}` | TTL còn lại của token | Vô hiệu hóa access token |
| Online presence | `online:{userId}` | 60s (configurable) | User online status |
| Last seen | `last_seen:{userId}` | — | Timestamp last seen |
| Socket registry | `presence:user:{userId}:sockets` | — | Set các socketId online |
| Socket mapping | `presence:socket:{socketId}` | 60s | Map socketId -> userId |
| Rate limit | `ratelimit:{prefix}:{ip/clientId}` | 900s (configurable) | Global HTTP rate limit |

### 5.3. External Services

| Service | Vai trò | Config keys | File liên quan |
|---|---|---|---|
| **LiveKit Self-hosted** | Audio/video call | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL` | `src/modules/call/infras/livekit/` |
| **LiveKit Cloud** | Audio/video call (alternative) | `LIVEKIT_CLOUD_API_KEY`, `LIVEKIT_CLOUD_API_SECRET`, `LIVEKIT_CLOUD_WS_URL` | `src/modules/call/infras/livekit/` |
| **AWS S3 / Cloudflare R2** | Cloud media storage | `CLOUD_STORAGE_ENABLED`, `CLOUD_BUCKET_NAME`, `CLOUD_REGION`, `CLOUD_ACCESS_KEY_ID`, `CLOUD_SECRET_ACCESS_KEY` | `src/share/middleware/upload/cloud-storage.ts` |
| **Google Gemini** | AI features | `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_MAX_TOKENS`, `AI_TEMPERATURE` | `src/modules/ai/infras/provider/gemini-provider.ts` |
| **SMTP Gmail** | Email OTP/verification | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | `src/modules/auth/infras/email/` |
| **Docker (compose)** | Container runtime | — | `docker-compose.yml`, `docker-compose.local.yml`, `docker-compose.prod.yml` |
| **PM2** | Process manager | — | `ecosystem.config.js` |
| **Cloudflare Access** | SSH tunnel cho CD (VPS target) | `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | `.github/workflows/cd.yml` |
| **EC2** | Production deployment target (manual CD) | `EC2_HOST`, `EC2_SSH_PRIVATE_KEY` | `.github/workflows/cd-manual.yml` |
| **GitHub Container Registry (GHCR)** | Docker image registry | `GITHUB_TOKEN` | `.github/workflows/ci.yml` |

---

## 6. Ưu điểm kiến trúc hiện tại

1. **Tách module rõ ràng, dễ phát triển và bảo trì**: Mỗi module có cấu trúc `model/dto/errors/interface/usecase/infras` riêng. Business logic tập trung trong usecase, transport chỉ parse request/gọi usecase. Module có thể phát triển độc lập bởi các developer khác nhau.

2. **Tách biệt transport và business logic**: Express handler và Socket.IO callback không chứa logic nghiệp vụ. Mọi business rule đều nằm trong usecase. Điều này giúp test business logic dễ dàng (unit test) mà không cần khởi động HTTP/Socket.

3. **Hỗ trợ realtime tốt với Socket.IO**: Socket.IO tích hợp sâu vào hệ thống. Global socket middleware xử lý auth, presence, heartbeat. Các socket service riêng cho từng module (chat, user, call, friend-request, block, AI). Ping/pong heartbeat mỗi 25s với timeout 20s. User room convention `user:{userId}` và group room `group:{conversationId}` nhất quán.

4. **Có cache/session trong Redis giúp tăng hiệu năng**: Session và token blacklist nằm trong Redis — O(1) lookup thay vì query DynamoDB. Presence online/offline tracking bằng Redis keys với TTL tự động cleanup. Rate limiting dùng Redis `INCR` + `EXPIRE` — không tốn thêm database. `RedisClient` có `IEventPublisher` interface để publish/subscribe Redis pub/sub cho cross-instance messaging.

5. **Có thể scale theo chiều ngang với Redis adapter**: `ConnectionRegistry` (in-memory) có thể thay thế bằng Redis adapter cho Socket.IO. Khi chạy nhiều backend instance phía sau load balancer, mỗi instance giữ in-memory connection registry riêng — Redis pub/sub cho phép các instance giao tiếp để emit đến socket connection trên instance khác.

6. **Tách external services rõ ràng**: AI, LiveKit, S3 storage được tách qua adapter/provider. `GeminiProvider` implement `IAiProvider`, `LivekitService` handle cả self-hosted và cloud. Nếu cần đổi AI provider hoặc storage chỉ cần thay provider mà không sửa usecase.

7. **Dùng Zod cho validation**: Zod schema đặt gần transport layer và trong usecase. Type-safe validation với error message rõ ràng. Không tự tin input từ client.

8. **Phù hợp với hệ thống chat realtime**: Idempotency cho send message (`clientMessageKey-index`). Read/delivered/seen markers. Typing indicators. Group utility worker tự động close expired polls và process due reminders. Message TTL support. Rich message types: text, media, poll, reminder, note, sticker, GIF, file, profile card, location, voice.

9. **Có health check và Docker healthcheck**: `/health`, `/health/live`, `/health/ready` endpoints. Docker HEALTHCHECK trong Dockerfile. Readiness probe kiểm tra Redis và DynamoDB.

10. **CI/CD tự động đến production**: CI chạy type check + tests + Docker build + push image lên GHCR. CD tự động deploy lên VPS (qua Cloudflare Access tunnel) hoặc EC2. Manual CD qua workflow dispatch.

11. **Có retry utility cho external service**: `src/share/utils/retry.ts` cung cấp `withRetry` với exponential backoff. `GeminiProvider` dùng `withRetry` (3 retries, 3s delay, no backoff multiplier). Có thể reuse cho LiveKit/S3 calls.

---

## 7. Nhược điểm/hạn chế kiến trúc hiện tại

1. **Backend là một khối triển khai duy nhất (single monolith)**: Tất cả module chạy trong cùng một process Node.js. Nếu một module bị lỗi (ví dụ AI Gemini timeout), có thể ảnh hưởng đến chat message send vì cùng event loop. Không có process isolation giữa các module.

2. **Phụ thuộc hoàn toàn vào Redis**: Auth (session, blacklist, refresh token), presence (online/offline), rate limiting đều dùng Redis. Không có fallback khi Redis lỗi — người dùng không thể login, socket không biết ai online, rate limit không hoạt động.

3. **Không có circuit breaker cho external services**: Không tìm thấy implementation circuit breaker trong source code. Khi Gemini hoặc LiveKit bị slow/timeout, request sẽ block và có thể gây cascade failure. Retry utility có nhưng không có circuit breaker pattern (open/half-open/closed state).

4. **Không có message queue/broker**: Mọi thao tác đều synchronous. Khi gửi message, backend vừa lưu DB vừa emit socket event trong cùng request cycle. Group utility worker dùng `setInterval` đơn giản (không persistent, không reliable). Nếu server restart giữa lúc worker đang xử lý, job có thể bị miss.

5. **Không có centralized monitoring/observability**: Không tìm thấy Prometheus, Grafana, Datadog, Sentry, OpenTelemetry. Logging dùng Winston nhưng chỉ console output (file transport bị comment). Không có structured metrics (request latency, error rate, DB latency). Khó phát hiện bottleneck khi traffic tăng.

6. **Không có database connection pooling hoặc read replica**: DynamoDB SDK không có connection pool concept (dùng HTTP), nhưng không có cơ chế routing: đọc từ DynamoDB replica, ghi vào primary. Tất cả request đi vào cùng DynamoDB endpoint.

7. **In-memory connection registry không persistent**: `InMemoryConnectionRegistry` trong `socket-io.ts` lưu socket connections trong Map. Nếu backend restart, toàn bộ connection state mất. Socket.IO có reconnect mechanism phía client, nhưng presence state trong Redis không đủ để restore full session state.

8. **Không có request tracing/correlation ID**: Không tìm thấy middleware gắn correlation ID vào mỗi request. Debug distributed trace khó khăn.

9. **Socket rate limiting có thể chưa đầy đủ**: Có `checkRateLimit` cho HTTP requests và socket rate limit trong `message.handlers.ts`, nhưng không thấy global socket rate limit middleware có cấu hình linh hoạt như HTTP rate limiter.

10. **Không có graceful shutdown**: Không tìm thấy logic shutdown handler (xử lý SIGTERM/SIGINT) để đợi in-flight requests hoàn thành, đóng Redis connection, dừng Socket.IO graceful trước khi process exit.

11. **File upload không có virus scanning hoặc content validation**: Backend nhận file và lưu/forward lên S3 mà không kiểm tra nội dung. Không có size limit enforcement ở layer khác ngoài multer config.

12. **Message search dùng DynamoDB Query + in-memory filter**: Không dùng full-text search engine. Search messages bằng DynamoDB query trên partition key rồi filter text trong memory — hiệu quả giảm với conversation lớn. Không tìm thấy OpenSearch/Elasticsearch/Meilisearch integration.

---

## 8. So sánh với kiến trúc khác

### 8.1. Monolith truyền thống

**Giống**: Cả hai đều là single deployment unit. Tất cả code trong một repository, một build, một runtime process.

**Khác và ưu điểm của kiến trúc hiện tại**:
- Monolith truyền thống thường không có cấu trúc module rõ ràng. Kiến trúc hiện tại dùng hexagon-ish pattern với `model/dto/errors/interface/usecase/infras` trong mỗi module, giúp separation of concerns tốt hơn.
- Business logic tách biệt khỏi transport — dễ unit test hơn monolith truyền thống thường gắn logic vào controller.
- Dùng Redis cho session/presence thay vì DB-only, tăng hiệu năng.
- Socket.IO realtime tích hợp — monolith truyền thống thường không có realtime layer.

### 8.2. Microservices

**Chưa phải microservices ở điểm nào**:
- Tất cả module deploy trong cùng một Docker container/process.
- Không có service boundary rõ ràng — chat module import user repository trực tiếp, call module import chat module.
- Giao tiếp inter-module là in-process function call, không phải HTTP/gRPC/message queue.
- Không có independent scaling — nếu AI service tốn tài nguyên, nó ảnh hưởng chat service trong cùng process.

**Nếu chuyển sang microservices**:
- **Lợi ích**: Independent scaling (scale AI service khi cần, không cần scale toàn bộ), fault isolation (AI timeout không ảnh hưởng chat), team autonomy, technology diversity (dùng Python cho AI, Go cho chat core).
- **Chi phí tăng**: Network latency giữa services, distributed tracing phức tạp hơn, data consistency (eventual consistency thay vì ACID), operational overhead (mỗi service cần CI/CD, monitoring riêng), deployment coordination.
- **Vì sao nên giữ monolith hiện tại**: Hệ thống đang trong giai đoạn phát triển, chưa đủ traffic để justify microservices overhead. Modular monolith cho phép refactor dần sang microservices khi cần thiết mà không phải rewrite.

### 8.3. Event-driven architecture

**Hiện tại có dùng event/socket/pubsub**:
- Socket.IO emit events khi có message, reaction, group changes — gần với event-driven cho realtime notifications.
- Redis pub/sub interface (`IEventPublisher`) tồn tại trong `src/share/component/redis-pubsub/interface.ts`, nhưng **chưa thấy implementation nào thực sự dùng `RedisClient.publish()`** cho inter-module event.
- Group utility worker dùng `setInterval` để poll — không phải event-driven thực sự.

**Chưa đủ gọi là event-driven hoàn toàn**: True event-driven dùng message broker (Kafka, RabbitMQ, AWS SQS) để decouple producers và consumers. Hiện tại:
- Message send: synchronous (write DB -> emit socket trong cùng handler)
- AI calls: synchronous (HTTP request trong request context)
- Call events: synchronous (emit trong handler)
- Utility worker: polling, không phải event subscription

**Có thể cải tiến**: Thêm message queue/outbox pattern cho message send (đảm bảo at-least-once delivery), dùng SQS/SNS cho cross-service notification, dùng Kafka cho event sourcing trên message log.

---

## 9. Trade-off của kiến trúc hiện tại

### 9.1. Hiệu năng

**Lợi ích**:
- Socket.IO cho phép gửi message realtime gần như instant — không cần polling.
- Redis session/blacklist giảm DynamoDB reads cho mỗi request xác thực.
- Presence tracking dùng Redis keys thay vì query DB.
- DynamoDB `PAY_PER_REQUEST` tự động scale theo traffic mà không cần capacity planning.
- Idempotency bằng `clientMessageKey-index` tránh duplicate message khi retry.
- Message pagination bằng DynamoDB cursor (`LastEvaluatedKey`) hiệu quả hơn offset pagination.
- In-memory rate limiter bypass ở non-production (`NODE_ENV !== "production"`).

**Đánh đổi**:
- Socket message emit trong cùng request cycle — nếu emit chậm, request bị block. Không có async message processing.
- Presence dùng Redis keys với TTL 60s — có thể có stale online status trong 60s window.
- DynamoDB là eventual consistent by default. Read after write có thể chưa thấy data mới (cần strongly consistent read cho một số trường hợp).
- Group utility worker polling mỗi 30s — reminder/polls có thể notify trễ đến 30s.
- Search messages dùng in-memory filter sau DynamoDB query — tốn bộ nhớ và CPU cho large conversations.

### 9.2. Chi phí

**Lợi ích**:
- Triển khai đơn giản: 1 Docker container + 1 Redis container + DynamoDB (AWS) + S3 (AWS). ít hơn microservices cần nhiều service + message broker + service mesh.
- DynamoDB on-demand: chỉ trả tiền cho what-you-use, phù hợp giai đoạn đầu.
- Redis container nhỏ (~10MB RAM). Containerized deployment tối ưu resource.

**Đánh đổi**:
- Nếu traffic tăng cao, DynamoDB on-demand có thể đắt hơn provisioned capacity. Cần monitor và tối ưu access patterns.
- Redis Redis không có replica trong docker-compose base — cần thêm Redis Sentinel hoặc Cluster để production reliability, tăng chi phí và độ phức tạp.
- Không có CDN cho media files — `CLOUD_STORAGE_ENABLED` dùng S3 nhưng không có CloudFront. Media serving qua backend hoặc direct S3 URL.

### 9.3. Độ phức tạp

**Lợi ích**:
- Một backend duy nhất dễ quản lý, debug, trace request.
- Dependency injection qua constructor — mỗi module tự wire dependencies trong `setup*Hexagon()`.
- `MessagingUseCaseFacade` tổng hợp ~70 handler, đồng nhất interface, dễ navigate.
- Swagger YAML là source of truth cho API contract — frontend và backend thống nhất.

**Đánh đổi**:
- `setupMessagingHexagon` trong `src/modules/chat/index.ts` có hơn 1000 dòng — quá nhiều dependency injection code trong một file. Khó maintain khi module phình to.
- Nhiều usecase handler nhận 6-8 repository dependencies trong constructor — potential anti-pattern (too many dependencies).
- Không có clear async/worker process separation — utility worker chạy trong main process.

### 9.4. Khả năng mở rộng

**Lợi ích**:
- Có thể scale backend horizontally (nhiều container) nếu dùng Redis adapter cho Socket.IO và stick sessions bằng load balancer.
- DynamoDB scale vô hạn về data size — không cần sharding logic.
- Modular structure cho phép extract module thành microservice riêng khi cần.

**Đánh đổi**:
- Hiện tại `InMemoryConnectionRegistry` lưu socket connections in-process. Nếu chạy nhiều instance, mỗi instance không biết socket connection trên instance khác — dẫn đến emit không đến đúng user.
- Không có Redis adapter cho Socket.IO được cấu hình trong code — multi-instance scaling cần thêm bước config.
- DynamoDB single-region by default — không có cross-region replication.

---

## 10. Contextual Questions

### 10.1. Nếu traffic tăng đột biến thì hệ thống xử lý thế nào?

**Thành phần chịu tải đầu tiên**: 
- DynamoDB throttling: `ProvisionedThroughputExceededException` nếu đã dùng provisioned mode, hoặc DynamoDB on-demand tự scale nhưng latency tăng.
- Node.js event loop: nếu I/O bound operations (DB, Redis) queue lên, event loop bị block.
- Redis: nếu rate limit checks và presence updates tăng gấp nhiều lần.

**Backend có rate limit**: Có — `createRateLimitMiddleware` trong `src/share/utils/rate-limiter.ts` dùng Redis `INCR` + `EXPIRE`. Global limit mặc định 100 requests/900s per IP. Có thể configure qua `RATE_LIMIT_GLOBAL_MAX` và `RATE_LIMIT_GLOBAL_WINDOW`.

**Có thể scale thêm instance**: Có thể, nhưng cần cấu hình thêm:
- Load balancer phía trước (nginx, ALB) với sticky sessions hoặc JWT validation.
- Redis adapter cho Socket.IO thay vì `InMemoryConnectionRegistry`.
- Redis Sentinel/Cluster cho high availability.

**Bottleneck có thể**:
1. DynamoDB — hot partition key (cùng conversationId nhận nhiều message).
2. Redis — nếu presence updates quá nhiều (mỗi heartbeat touch Redis).
3. Node.js event loop — synchronous operations hoặc large payloads.
4. Memory — `InMemoryConnectionRegistry` Map grows với số socket connections.

### 10.2. Nếu backend bị downtime thì ảnh hưởng gì?

**Người dùng không gửi/nhận tin nhắn được**: 
- Socket.IO connection bị disconnect — client reconnect được nhưng không nhận message.
- HTTP API trả 503.
- Access token vẫn valid trong thời gian token còn hạn (15 phút), nhưng refresh token không kiểm tra được session state vì Redis có thể không reachable (nếu Redis vẫn chạy).

**Có cơ chế reconnect/token refresh**: 
- Socket.IO client có built-in auto-reconnect.
- Access token hết hạn sau 15 phút → client cần refresh token.
- Nếu backend down quá 15 phút, tất cả token hết hạn → user phải login lại.
- Không có offline message queue — message gửi trong lúc down bị mất (client có thể retry sau khi reconnect với cùng `clientMessageId` để idempotency).

**Cần bổ sung để giảm downtime**:
- Health check endpoint hiện có, nhưng không có auto-scaling policy tự động.
- PM2 restart policy (`max_restarts: 10`, `min_uptime: 10s`) — restart tự động khi crash nhưng không giải quyết OOM hoặc hang.
- Docker healthcheck tự restart unhealthy container.

### 10.3. Nếu Redis lỗi thì ảnh hưởng gì?

**Nghiêm trọng**: Hầu hết core functionality bị ảnh hưởng:

| Redis feature | Ảnh hưởng khi Redis lỗi |
|---|---|
| Session store | Không verify được session → tất cả request bị 401 (trừ public endpoints) |
| Token blacklist | Không revoke được token → logout không hiệu quả |
| Refresh token rotate | Không store/consume refresh token → refresh flow fail |
| Online presence | Không track online status → presence luôn offline |
| Socket presence port | Socket.IO presence event không emit đúng |
| Rate limiting | Rate limit bypass (fallback `allowed: true` ở non-production, production sẽ throw) |

**Backend có fallback không**: Không có graceful degradation. Không tìm thấy code handle Redis connection failure với fallback. `RedisClient._connect()` chỉ log error nhưng instance vẫn được tạo — các call sau sẽ throw.

### 10.4. Nếu database lỗi hoặc chậm thì ảnh hưởng gì?

- Gửi message: DynamoDB write fail → message không được lưu → emit không có gì để emit.
- Tạo hội thoại: DynamoDB write fail → conversation không tạo được.
- Đăng nhập: Nếu DynamoDB không đọc được user, bcrypt compare không chạy được → login fail.
- Không có retry logic mặc định cho DynamoDB operations. Retry utility (`withRetry`) tồn tại nhưng không được dùng cho DB calls.
- Không có queue — message không được buffered khi DB slow.

### 10.5. Nếu LiveKit hoặc AI service lỗi thì sao?

**LiveKit lỗi**:
- Không tạo được call token → call feature fail.
- Core chat message không bị ảnh hưởng vì call module tách biệt.
- **Degrade gracefully**: Call feature trả lỗi, chat vẫn hoạt động.

**AI (Gemini) lỗi**:
- AI endpoints trả lỗi 500.
- Core chat message không bị ảnh hưởng.
- `GeminiProvider` có `withRetry` (3 retries) nhưng không có circuit breaker — nếu Gemini slow, request block đến 9 giây (3 x 3s).
- **Degrade gracefully**: AI endpoints có thể fallback message tùy usecase (không tìm thấy fallback logic trong code).

### 10.6. Chiến lược scaling phù hợp

**Scale vertical trước, horizontal sau**:
- Hiện tại PM2 `instances: 1`, `exec_mode: "fork"` — vertical scaling là bước đầu tiên (tăng RAM/CPU).
- Horizontal scaling: cần load balancer + Redis adapter cho Socket.IO.

**Có cần load balancer**: Có nếu chạy nhiều hơn 1 instance. AWS ALB, nginx, hoặc Cloudflare.

**Có cần Redis adapter cho Socket.IO**: Bắt buộc nếu scale horizontal vì mỗi instance giữ connection riêng. Socket.IO Redis adapter (`@socket.io/redis-adapter`) cho phép pub/sub events qua Redis.

**Tách media/AI/call sang service riêng**:
- **Ngắn hạn**: Chưa cần. Module nhỏ, không chiếm nhiều tài nguyên.
- **Dài hạn**: Có thể tách AI thành service riêng nếu Gemini API latency ảnh hưởng chat. Media service tách khi upload volume cao. Call service tách khi LiveKit resource contention ảnh hưởng chat.

### 10.7. Khả năng chịu lỗi hiện tại

**Điểm đã có khả năng chịu lỗi**:
- **DynamoDB auto-init** với `process.exit(1)` nếu table creation fail — không chạy trên schema thiếu.
- **Docker healthcheck** tự restart unhealthy container (30s interval, 3 retries).
- **JWT token với blacklist** — revoke token không cần Redis state persistent.
- **Refresh token rotation** — phát hiện token reuse và revoke session.
- **PM2 restart policy** — tự restart khi crash (max 10 restarts, min 10s uptime).
- **Health endpoint** `/health/live` cho container orchestration.
- **Soft delete** pattern cho messages, friendships — không hard delete data quan trọng.
- **Idempotency** cho message send — retry an toàn.

**Điểm còn yếu**:
- Không có circuit breaker cho external services.
- Redis là single point of failure cho auth và presence.
- Không có graceful shutdown — in-flight requests bị kill khi restart.
- Không có dead letter queue hoặc retry cho failed message sends.
- Không có distributed tracing — khó debug cross-service issues.
- Không có centralized logging aggregation.

**Đề xuất cải tiến ngắn hạn**:
1. Thêm graceful shutdown handler (SIGTERM → đợi in-flight, close connections).
2. Thêm Redis Sentinel cho Redis HA.
3. Thêm circuit breaker cho Gemini và LiveKit calls.
4. Enable Winston file transports (uncomment trong `logger.ts`) + log rotation.

**Đề xuất cải tiến dài hạn**:
1. Thêm message queue (SQS/SNS hoặc BullMQ) cho async message processing.
2. Thêm Prometheus metrics endpoint + Grafana dashboard.
3. Thêm OpenTelemetry distributed tracing.
4. Thêm search engine (OpenSearch/Meilisearch) cho message search.
5. Thêm CDN (CloudFront) cho media files.

---

## 11. Kiến nghị cải tiện kiến trúc

### 11.1. Ngắn hạn

1. **Bổ sung graceful shutdown**: Xử lý SIGTERM, đợi in-flight requests hoàn thành (timeout 30s), đóng Redis connection, disconnect Socket.IO gracefully.

2. **Bổ sung circuit breaker**: Dùng thư viện như `opossum` cho Gemini và LiveKit calls. Open state khi error rate > 50%, half-open để test recovery, closed sau threshold.

3. **Hoàn thiện logging**: Uncomment file transports trong Winston logger. Thêm correlation/request ID vào mỗi request log. Log rotation với `maxsize`.

4. **Cấu hình Redis adapter cho Socket.IO**: Nếu scale nhiều instance, thêm `@socket.io/redis-adapter` để các instance chia sẻ socket events qua Redis pub/sub.

5. **Thêm Redis Sentinel/Cluster**: Cho production reliability. Master-replica setup với automatic failover.

6. **Thêm DynamoDB retry policy**: Wrapper cho DynamoDB calls với exponential backoff, dùng `withRetry` hiện có.

### 11.2. Dài hạn

1. **Tách AI service**: Extract thành service riêng (có thể dùng Python/FastAPI cho Gemini integration). Giao tiếp qua REST hoặc message queue. Lợi ích: independent scaling, technology flexibility, fault isolation.

2. **Thêm message queue/outbox**: Dùng BullMQ (Redis-backed) hoặc AWS SQS cho async message processing. Message send: write to outbox table → worker pick up → emit socket. Đảm bảo at-least-once delivery, decouple I/O.

3. **Thêm centralized monitoring**: Prometheus metrics endpoint (`/metrics`), Grafana dashboard, Alertmanager cho Slack/email. Metrics cần: request latency histogram, error rate counter, DynamoDB latency, Redis latency, socket connection count, active call count.

4. **Thêm centralized logging**: ELK stack (Elasticsearch + Logstash + Kibana) hoặc Loki + Grafana. Structured JSON logs thay vì plain text. Correlation ID trace từ API → DB → Socket.

5. **Thêm search engine**: Meilisearch hoặc OpenSearch cho full-text message search thay vì DynamoDB + in-memory filter. Index message content, support Vietnamese, typo tolerance.

6. **Tách media service**: Nếu upload volume cao, tách thành service riêng. Dùng Cloudflare R2 (S3-compatible) + Cloudflare Images cho optimized delivery.

7. **Database multi-region**: DynamoDB Global Tables nếu cần low-latency cho users ở nhiều region.

---

## 12. Danh sách file/thư mục quan trọng đã đọc

### Core bootstrap và cấu hình
- `package.json` — dependencies, scripts
- `src/index.ts` — entry point, module wiring, middleware setup
- `src/share/component/config.ts` — env config loader

### Shared infrastructure
- `src/share/component/socket-io.ts` — Socket.IO server, connection registry, auth middleware
- `src/share/component/redis-pubsub/redis.ts` — Redis singleton client
- `src/share/middleware/auth.ts` — JWT auth middleware
- `src/share/middleware/response-format.ts` — /v1 response envelope
- `src/share/middleware/health-check.ts` — health endpoints
- `src/share/middleware/index.ts` — middleware factory
- `src/share/utils/logger.ts` — Winston logger
- `src/share/utils/rate-limiter.ts` — Redis-backed rate limiter
- `src/share/utils/retry.ts` — generic retry utility
- `src/share/app-error.ts` — AppError class và global error handler
- `src/share/repository/dynamodb/table-defs.ts` — DynamoDB schema definitions
- `src/share/repository/dynamodb/auto-init.ts` — table auto-creation
- `src/share/repository/dynamodb/client.ts` — DynamoDB client
- `src/share/interface/index.ts` — shared interfaces (IRepository, IUseCase, Session, Token, etc.)
- `src/share/interface/service-context.ts` — middleware factory context
- `src/share/transport/http-server.ts` — base HTTP controller (legacy)

### Modules
- `src/modules/auth/index.ts` — auth module entry point
- `src/modules/auth/usecase/index.ts` — AuthUseCase (1108 dòng)
- `src/modules/auth/infras/token/access-token.ts` — JWT access token
- `src/modules/auth/infras/token/blacklist.ts` — Redis token blacklist
- `src/modules/auth/infras/redis/refresh-store.ts` — Redis refresh token store
- `src/modules/user/index.ts` — user module entry point
- `src/modules/user/infras/repository/redis/presence-repo.ts` — Redis presence repository
- `src/modules/chat/index.ts` — chat module entry point (1013 dòng)
- `src/modules/chat/constants/socket-events.ts` — socket event name constants
- `src/modules/chat/usecase/send-message.ts` — message send handler
- `src/modules/chat/usecase/group-utility-worker.ts` — background worker for polls/reminders
- `src/modules/chat/infras/transport/socket/message.handlers.ts` — socket message handlers
- `src/modules/media/index.ts` — media module entry point
- `src/modules/call/index.ts` — call module entry point
- `src/modules/ai/index.ts` — AI module entry point
- `src/modules/ai/infras/provider/gemini-provider.ts` — Gemini AI provider
- `src/modules/search/index.ts` — search module entry point
- `src/modules/blocks/index.ts` — blocks module entry point
- `src/modules/friend-requests/index.ts` — friend-requests module entry point
- `src/modules/friendships/index.ts` — friendships module entry point

### Docker và deployment
- `Dockerfile` — Node 22 Alpine image
- `docker-compose.yml` — Redis base service
- `docker-compose.local.yml` — local dev (backend + Redis)
- `docker-compose.prod.yml` — production (backend + Redis)
- `ecosystem.config.js` — PM2 process manager config

### CI/CD
- `.github/workflows/ci.yml` — type check + tests + Docker build/push
- `.github/workflows/cd.yml` — auto-deploy to VPS via Cloudflare Access
- `.github/workflows/cd-manual.yml` — manual deploy to EC2

### Documentation
- `docs/DATABASE.md` — DynamoDB schema và access patterns
- `docs/BE-ARCHITECTURE.md` — runtime architecture
- `docs/BE-PROJECT-RULES.md` — implementation conventions
- `docs/API_SPEC.md` — REST và Socket API catalog
- `docs/swagger/main.yaml` — OpenAPI source of truth
- `docs/swagger/paths/*.yaml` — chi tiết từng endpoint

### Testing
- `jest.config.ts` — Jest test configuration
- `tests/helpers/*.ts` — test harnesses (chat-e2e-harness, chat-e2e-socket, chat-e2e-repositories, etc.)
- `tests/*.test.ts` — 34 test files cho các domain: auth, social, chat, call, search

---

## 13. Kết luận ngắn

**Backend hiện tại phù hợp mô hình kiến trúc nào nhất?**

Modular Monolith kết hợp Hexagonal Architecture — đây là lựa chọn phù hợp nhất cho giai đoạn hiện tại. Mỗi module được tách biệt rõ ràng về mặt nghiệp vụ, có cấu trúc nội bộ nhất quán (model/dto/errors/interface/usecase/infras), và business logic không phụ thuộc vào transport layer. Mô hình này cho phép team phát triển độc lập, dễ test, và có thể refactor dần sang microservices khi hệ thống scale.

**Có phù hợp với hệ thống chat realtime không?**

Có. Socket.IO tích hợp toàn diện (auth, presence, typing, read/delivered, group events). Idempotency cho message send, presence tracking, message TTL, typing indicators, poll/reminder/note system — đều là những tính năng cần thiết cho chat realtime. DynamoDB single-digit millisecond latency cho point queries và sorted range queries phù hợp với chat access patterns.

**Điểm mạnh chính**:
- Cấu trúc module rõ ràng, hexagonal pattern nhất quán.
- Realtime layer (Socket.IO + Redis presence) thiết kế tốt.
- Auth với JWT + refresh token rotation + device session management toàn diện.
- Swagger YAML làm API contract source of truth.
- CI/CD tự động từ GitHub Actions đến production.
- Idempotency và soft delete pattern bảo vệ data integrity.
- Docker containerization và health check đầy đủ.

**Hạn chế chính**:
- Redis là single point of failure — không có fallback.
- Không có circuit breaker, retry logic hạn chế cho external services.
- Không có message queue — synchronous processing cho message send.
- Không có centralized monitoring/observability.
- Không có graceful shutdown và multi-instance Socket.IO adapter.
- Group utility worker dùng polling thay vì event-driven.
- Search dùng in-memory filter thay vì dedicated search engine.

**Định hướng mở rộng hợp lý**:
- **Ngắn hạn** (1-3 tháng): Thêm graceful shutdown, circuit breaker, hoàn thiện logging, cấu hình Redis Sentinel. Đây là low-hanging fruits cải thiện reliability mà không thay đổi kiến trúc.
- **Trung hạn** (3-6 tháng): Thêm message queue (BullMQ) cho async processing, Prometheus metrics, Socket.IO Redis adapter nếu scale multi-instance, search engine (Meilisearch).
- **Dài hạn** (6-12 tháng): Cân nhắc tách AI service thành service riêng, thêm distributed tracing (OpenTelemetry), multi-region DynamoDB nếu mở rộng user base quốc tế.
