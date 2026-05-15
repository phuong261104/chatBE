# Frontend Integration Guide V2

Updated: 2026-05-15

---

## 0. Source Verification & Handoff Packet

This document was checked against the current backend source on 2026-05-15:

- Route registration: `src/index.ts`
- V2 chat routes: `src/modules/chat/infras/transport/http/v2-chat.routes.ts`
- V2 call routes/socket: `src/modules/call/infras/transport/http/call-v2.routes.ts`, `src/modules/call/infras/transport/call-v2-socket.service.ts`
- V2 user routes: `src/modules/user/infras/transport/user-v2.routes.ts`
- V1/V2 friendship/block routes: `src/modules/friend-requests/index.ts`, `src/modules/friendships/index.ts`, `src/modules/blocks/index.ts`
- V1 media, my-cloud, AI routes: `src/modules/media/index.ts`, `src/modules/my-cloud/index.ts`, `src/modules/ai/infras/transport/http-service.ts`

Frontend handoff reading order:

| Priority | File / URL | Purpose | Status |
|---|---|---|---|
| 1 | `docs/FE_INTEGRATION_GUIDE_V2.md` | Main integration guide and source-verified endpoint inventory | Required |
| 2 | `docs/SOCKET_EVENTS_V2_REFERENCE.md` | Socket.IO namespaces/events including chat, calls, friends, blocks, My Cloud | Required |
| 3 | `docs/handoff/FRONTEND_API_SOCKET_V2_CHANGES.md` | Concise V1 -> V2 migration notes | Required |
| 4 | `docs/handoff/FRONTEND_CALL_INTEGRATION_GUIDE.md` | Call V2 LiveKit integration flow | Required for calls |
| 5 | `http://localhost:3000/api-docs` | Swagger UI for exact request/response schemas | Required |
| 6 | `docs/SOCKET_FRIENDS_BLOCKS_REFERENCE.md` | Detailed friendship/block socket payloads | Reference |
| 7 | `docs/CHAT_WEBSOCKET_EVENTS_CHECKLIST.md` | Chat websocket implementation checklist and caveats | Reference |
| 8 | `docs/handoff/FRONTEND_HANDOFF_FILES_V2.md` | Handoff file checklist for frontend devs | Reference |

Notes:

- REST V2 uses `/v2`; legacy modules that do not have dedicated V2 business rules remain mounted under `/v1`.
- Friend requests, friendships, and blocks are mounted under both `/v1` and `/v2`; behavior is the same unless stated otherwise.
- Swagger is the schema source of truth for request/response field details. This guide focuses on frontend flows and route/event inventory.

---

## 1. Overview

This guide covers the V2 API and Socket.IO integration for frontend clients. **Always prefer V2 endpoints** over V1 when both exist — V2 includes critical features like hidden conversations (PIN protection), message requests (stranger messages), TTL messages, stricter group membership rules, and privacy-aware presence.

### Key Differences: V1 vs V2

| Feature | V1 | V2 |
|---|---|---|
| Conversations list | Returns hidden conversations | Automatically excludes hidden |
| Private messages to strangers | Allowed or blocked by server | Creates message request, requires acceptance |
| Message edit window | Server-defined | Strictly 30 seconds |
| Self-destruct messages | Not supported | Supported via `ttlSeconds` |
| Hidden conversations | Not supported | PIN-protected hide/unlock/unhide |
| Group member validation | Members can be anyone | Members must be active friends |
| Profile visibility | Fixed | Privacy-controlled (`everyone`, `friends`, `nobody`) |
| Presence | Public last seen | Privacy-aware last seen |
| Friend suggestions | Basic | Relationship-aware with scoring |

---

## 2. API Base URLs

```
Production: https://api.example.com
Local:      http://localhost:3000

Auth:       /v1/auth/*
User V1:    /v1/users/*
User V2:    /v2/users/*
Chat V1:    /v1/conversations/*
Chat V2:    /v2/conversations/*
Calls V1:   /v1/calls/*
Calls V2:   /v2/calls/*
Media:      /v1/media/*
Friend requests: /v1/friend-requests/* and /v2/friend-requests/*
Friendships:     /v1/friendships/* and /v2/friendships/*
Blocks:          /v1/blocks/* and /v2/blocks/*
My Cloud:        /v1/my-cloud/*
Search:          /v1/search
AI:              /v1/ai/*
Swagger:    /api-docs
```

All API responses follow the format:

```json
// Success
{ "data": { ... } }

// Error
{ "error": "Error message" }
```

---

## 3. Authentication

### 3.1 Login

```http
POST /v1/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 3600,
    "user": { "id": "...", "displayName": "...", "avatarUrl": "..." }
  }
}
```

### 3.2 Token Refresh

```http
POST /v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

### 3.3 Logout

```http
POST /v1/auth/logout
Authorization: Bearer <token>
```

### 3.4 Storing Tokens

Store tokens securely:
- **Access token**: Memory or `httpOnly` cookie (recommended)
- **Refresh token**: `httpOnly` cookie (never accessible from JS)
- Never store tokens in `localStorage` (XSS vulnerable)

---

## 4. Socket.IO Connection

### 4.1 Connecting

```javascript
import { io } from "socket.io-client";

const socket = io("/", {
  auth: {
    token: accessToken,
    deviceId: getDeviceId(),    // e.g., UUID stored in localStorage
    platform: "web",            // or "ios", "android", "desktop"
  },
  transports: ["websocket", "polling"],
  path: "/socket.io",
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});
```

### 4.2 Connection Lifecycle

```javascript
socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

socket.on("connected", (data) => {
  console.log("Authenticated:", data.userId, "socket:", data.socketId);
  console.log("Active connections:", data.activeConnections);
  console.log("Server time:", data.serverTime);
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error.message);
  if (error.message.includes("Invalid token")) {
    // Redirect to login
  }
});
```

### 4.3 Heartbeat

```javascript
// Send heartbeat every 25 seconds
setInterval(() => {
  socket.emit("ping");
}, 25000);

socket.on("pong", (data) => {
  const latency = Date.now() - data.timestamp;
  console.log("Latency:", latency, "ms");
});
```

### 4.4 Subscribe to Conversations

```javascript
// When opening a chat
socket.emit("subscribeConversation", { conversationId });

// When leaving a chat
socket.emit("unsubscribeConversation", { conversationId });
```

---

## 5. Chat V2 Endpoints

Source-verified V2 route inventory:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v2/conversations` | List conversations, hidden conversations excluded |
| `GET` | `/v2/conversations/cursor` | Cursor pagination list |
| `GET` | `/v2/conversations/strangers` | List pending stranger/message request conversations |
| `GET` | `/v2/conversations/{conversationId}/presence` | Conversation presence summary |
| `POST` | `/v2/conversations/{conversationId}/messages` | Send message in conversation |
| `POST` | `/v2/conversations/{conversationId}/profile-cards` | Send a profile card message |
| `POST` | `/v2/conversations/{conversationId}/hide` | Hide conversation with PIN |
| `POST` | `/v2/conversations/{conversationId}/unlock` | Unlock hidden conversation with PIN |
| `POST` | `/v2/conversations/{conversationId}/unhide` | Unhide conversation with PIN |
| `POST` | `/v2/messages/private` | Send private message; may create message request |
| `PUT` | `/v2/messages/{messageId}` | Edit message within 30 seconds |
| `GET` | `/v2/message-requests` | List pending message requests |
| `POST` | `/v2/message-requests/{conversationId}/accept` | Accept message request |
| `POST` | `/v2/message-requests/{conversationId}/reject` | Reject message request |
| `POST` | `/v2/groups` | Create group |
| `POST` | `/v2/groups/{groupId}/members` | Add group members |
| `POST` | `/v2/groups/{groupId}/leave` | Leave group; owner auto-transfer is handled |
| `PATCH` | `/v2/groups/{groupId}/settings` | Update group settings |

### 5.1 List Conversations (V2)

```http
GET /v2/conversations?page=1&limit=20
Authorization: Bearer <token>
```

Response:
```json
{
  "data": [
    {
      "_id": "0192a3bc-def0-7abc-8901-23456789abcd",
      "name": "Dev Team",
      "type": "group",
      "lastMessage": {
        "messageId": "...",
        "textPreview": "Hello everyone!",
        "createdAt": "2026-05-15T10:00:00.000Z"
      },
      "unreadCount": 3,
      "pinned": false,
      "muted": false,
      "archived": false
    }
  ]
}
```

> **Note:** Hidden conversations are NOT returned. Use `/v2/conversations/{id}/unlock` to view hidden conversations with PIN.

### 5.2 List Strangers (Message Requests)

```http
GET /v2/conversations/strangers?limit=50
Authorization: Bearer <token>
```

Use this to show the "Message Requests" / "Strangers" tab. Returns conversations with non-friends.

```json
{
  "data": [
    {
      "conversation": { ... },
      "otherUser": {
        "id": "...",
        "displayName": "John Doe",
        "avatarUrl": "https://..."
      },
      "messageRequestStatus": "pending"
    }
  ]
}
```

`messageRequestStatus`: `pending` | `rejected` | `accepted`

### 5.3 Message Requests

```http
GET /v2/message-requests?limit=50
Authorization: Bearer <token>
```

```http
POST /v2/message-requests/{conversationId}/accept
Authorization: Bearer <token>
```

```http
POST /v2/message-requests/{conversationId}/reject
Authorization: Bearer <token>
```

### 5.4 Send Message (V2)

```http
POST /v2/conversations/{conversationId}/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Hello!",
  "media": [],
  "ttlSeconds": 3600        // Optional: self-destruct after 1 hour
}
```

> `ttlSeconds`: Message will be auto-deleted after this many seconds (server-side TTL).

### 5.5 Send Private Message (V2)

```http
POST /v2/messages/private
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetUserId": "0192a3bc-def0-7abc-8901-23456789abcd",
  "text": "Hi!",
  "ttlSeconds": 86400       // Optional: 24 hours
}
```

Behavior:
- If friends: sends directly
- If not friends but stranger messages allowed: creates message request
- If blocked: returns `403`

### 5.6 Edit Message (V2)

```http
PUT /v2/messages/{messageId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Updated message"
}
```

> **Critical:** Edit window is strictly **30 seconds**. After that, server returns `403`.

### 5.7 Hidden Conversations

#### Hide (with PIN)

```http
POST /v2/conversations/{conversationId}/hide
Authorization: Bearer <token>
Content-Type: application/json

{
  "pin": "1234"
}
```

Hidden conversations disappear from the list. User must remember the PIN to unlock.

#### Unlock (view without unhiding)

```http
POST /v2/conversations/{conversationId}/unlock
Authorization: Bearer <token>
Content-Type: application/json

{
  "pin": "1234"
}
```

Returns conversation details. Does NOT unhide.

#### Unhide

```http
POST /v2/conversations/{conversationId}/unhide
Authorization: Bearer <token>
Content-Type: application/json

{
  "pin": "1234"
}
```

Conversation reappears in the list.

### 5.8 Get Conversation Presence

```http
GET /v2/conversations/{conversationId}/presence
Authorization: Bearer <token>
```

```json
{
  "data": [
    { "userId": "...", "isOnline": true, "lastSeen": null },
    { "userId": "...", "isOnline": false, "lastSeen": "2026-05-15T09:00:00.000Z" }
  ]
}
```

---

## 6. Groups V2

### 6.1 Create Group (V2)

```http
POST /v2/groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Dev Team",
  "memberIds": ["user-id-1", "user-id-2"],
  "avatarUrl": "https://cdn.example.com/group.png"
}
```

> **Important:** All `memberIds` must be active friends of the creator AND must not be blocked in either direction.

### 6.2 Add Members (V2)

```http
POST /v2/groups/{groupId}/members
Authorization: Bearer <token>
Content-Type: application/json

{
  "memberIds": ["user-id"]
}
```

Same validation as create — all targets must be active friends.

### 6.3 Leave Group (V2)

```http
POST /v2/groups/{groupId}/leave
Authorization: Bearer <token>
```

Behavior:
- **Owner leaves**: Ownership auto-transfers to oldest active admin, or oldest active member, or group marked inactive
- **Admin/Member leaves**: Normal leave

### 6.4 Update Group Settings (V2)

```http
PATCH /v2/groups/{groupId}/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "allowSendLink": true,
  "requireApproval": false,
  "allowMemberInvite": true,
  "whoCanSendMessages": "admins"
}
```

`whoCanSendMessages`: `"all"` (everyone) or `"admins"` (admins only)

---

## 7. User V2 Endpoints

### 7.1 Get My Profile (V2)

```http
GET /v2/users/me/profile
Authorization: Bearer <token>
```

Includes privacy settings in the response.

### 7.2 Update My Profile (V2)

```http
PATCH /v2/users/me/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "Nguyen Van A",
  "bio": "Hello world!",
  "avatarUrl": "https://cdn.example.com/new-avatar.png"
}
```

### 7.3 Privacy Settings (V2)

```http
PATCH /v2/users/me/privacy
Authorization: Bearer <token>
Content-Type: application/json

{
  "lastSeen": "friends",
  "profilePhoto": "friends",
  "info": "everyone",
  "searchableByPhone": true,
  "allowStrangerMessage": "friends"
}
```

- `lastSeen`: Who can see last seen (`everyone`, `friends`, `nobody`)
- `profilePhoto`: Who can see profile photo
- `info`: Who can see bio/location/phone
- `searchableByPhone`: Allow search by phone number
- `allowStrangerMessage`: Who can send message requests (`everyone`, `friends`, `nobody`)

### 7.4 Avatar History (V2)

```http
GET /v2/users/me/avatar-history
Authorization: Bearer <token>
```

Returns history of previous avatars.

### 7.5 Get User Presence (V2)

```http
GET /v2/users/{userId}/presence
Authorization: Bearer <token>
```

Respects privacy settings — may return limited info for users with `lastSeen: "friends"`.

### 7.6 Get User Public Info (V2)

```http
GET /v2/users/{userId}/public
Authorization: Bearer <token>
```

Returns public-only profile info, respects privacy settings.

### 7.7 Friend Suggestions (V2)

```http
GET /v2/friends/suggestions
Authorization: Bearer <token>
```

```json
{
  "data": [
    {
      "userId": "...",
      "displayName": "...",
      "avatarUrl": "...",
      "mutualFriendsCount": 5,
      "sharedGroupIds": ["..."],
      "score": 65,
      "reasons": ["mutual_friends", "shared_groups"]
    }
  ]
}
```

Sorted by score descending.

### 7.8 Search Users (V2)

```http
GET /v2/users/search?q=keyword&limit=20
Authorization: Bearer <token>
```

```http
GET /v2/users/search-by-phone?phone=+84...&limit=20
Authorization: Bearer <token>
```

---

## 8. Calls V2

### 8.1 Create Call

```http
POST /v2/calls
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversationId": "0192a3bc-def0-7abc-8901-23456789abcd",
  "type": "video",
  "inviteAll": true
}
```

Response (success):
```json
{
  "data": {
    "call": {
      "callId": "...",
      "status": "ringing",
      "participants": { "callerId": { "status": "joined", "joinedAt": 1710000000000 } }
    },
    "invitedUserIds": ["..."],
    "busyUserIds": []
  }
}
```

If user is busy:
```json
// HTTP 409
{ "error": "Callee is busy", "data": { "busyUserIds": ["..."] } }
```

### 8.2 Get Active Call

```http
GET /v2/calls/conversations/{conversationId}/active
Authorization: Bearer <token>
```

### 8.3 Join Call (Get Token)

```http
POST /v2/calls/{callId}/join
Authorization: Bearer <token>
```

```json
{
  "data": {
    "call": { ... },
    "token": "eyJhbG...",
    "wsUrl": "wss://livekit.example.com",
    "roomName": "call-v2-...",
    "livekitProvider": "cloud"
  }
}
```

### 8.4 Leave/End Call

```http
POST /v2/calls/{callId}/leave
Authorization: Bearer <token>
```

```http
POST /v2/calls/{callId}/end
Authorization: Bearer <token>
```

```http
DELETE /v2/calls/{callId}
Authorization: Bearer <token>
```

### 8.5 Socket Events for Calls (V2)

Namespace: `/v2/calls`

```javascript
const callSocket = io("/v2/calls", { auth: { token: accessToken } });

// Incoming call
callSocket.on("call:incoming", (callData) => {
  showIncomingCallUI(callData);
});

// Call already in progress (re-connect scenario)
callSocket.on("call:ongoing", (callData) => {
  showOngoingCallUI(callData);
});

// Joined call room
callSocket.on("call:joined", (data) => {
  console.log("Joined call:", data.callId);
});

// Left call room
callSocket.on("call:left", (data) => {
  closeCallUI();
});

// Call declined
callSocket.on("call:declined", (data) => {
  showDeclinedMessage(data);
});

// Call missed
callSocket.on("call:missed", (data) => {
  showMissedCallNotification(data);
});

// User busy
callSocket.on("call:busy", (data) => {
  showBusyMessage(data);
});

// Call ended
callSocket.on("call:ended", (data) => {
  closeCallUI();
});

// Join/leave
callSocket.emit("call:join", { callId });
callSocket.emit("call:leave", { callId });
```

---

## 9. Socket.IO Events (Chat)

Namespace: `/messages` (via root socket subscription)

### 9.1 Real-time Messages

```javascript
// When subscribed to a conversation, receive messages via:
socket.on("receiveMessage", (message) => {
  appendMessage(message);
});

socket.on("message:edited", ({ messageId, text, editedAt }) => {
  updateMessageText(messageId, text);
  showEditedIndicator(messageId);
});

socket.on("message:revoked", ({ messageId, conversationId }) => {
  removeMessage(messageId);
  showMessageRevoked(messageId);
});

socket.on("message:reaction", ({ messageId, reaction }) => {
  addReactionToMessage(messageId, reaction);
});

socket.on("message:reaction:remove", ({ messageId, userId, emoji }) => {
  removeReactionFromMessage(messageId, userId, emoji);
});

socket.on("message:pinned", ({ messageId, conversationId }) => {
  showPinnedIndicator(messageId);
});
```

### 9.2 Typing Indicators

```javascript
// Send typing
function onTextChange(conversationId) {
  debouncedEmit(() => {
    socket.emit("typing:start", { conversationId });
  });
}

function onTextEmpty() {
  socket.emit("typing:stop", { conversationId });
}

// Receive typing
socket.on("typing:start", ({ conversationId, userId }) => {
  showTypingIndicator(conversationId, userId);
});

socket.on("typing:stop", ({ conversationId, userId }) => {
  hideTypingIndicator(conversationId, userId);
});
```

### 9.3 Presence

```javascript
socket.on("user:online", ({ userId, socketId, timestamp }) => {
  updateUserOnlineStatus(userId, true);
});

socket.on("user:offline", ({ userId, timestamp, reason }) => {
  updateUserOnlineStatus(userId, false);
});

socket.on("online_status", ({ userId, isOnline }) => {
  updateUserOnlineStatus(userId, isOnline);
});
```

### 9.4 Group Events

```javascript
socket.on("group:member_joined", ({ conversationId, userId }) => {
  showMemberJoinedNotification(conversationId, userId);
});

socket.on("group:member_left", ({ conversationId, userId }) => {
  showMemberLeftNotification(conversationId, userId);
});

socket.on("group:admin_changed", ({ conversationId, userId, isAdmin }) => {
  updateMemberRole(conversationId, userId, isAdmin ? "admin" : "member");
});

socket.on("group:owner_transferred", ({ conversationId, newOwnerId }) => {
  updateGroupOwner(conversationId, newOwnerId);
});

socket.on("group:dissolved", ({ conversationId }) => {
  showGroupDissolvedMessage(conversationId);
  redirectToHome();
});

socket.on("group:settings_updated", ({ conversationId, settings }) => {
  updateGroupSettingsUI(conversationId, settings);
});
```

### 9.5 Poll Events

```javascript
socket.on("poll:new", ({ poll, message }) => {
  showNewPoll(message);
});

socket.on("poll:vote", ({ pollId, voterId, optionIds, results }) => {
  updatePollResults(pollId, results);
});

socket.on("poll:closed", ({ pollId }) => {
  markPollClosed(pollId);
});
```

---

## 10. V2-Only Features

### 10.1 Hidden Conversation PIN

- User sets a PIN when hiding a conversation
- PIN is bcrypt-hashed server-side
- Unhiding requires correct PIN
- Hidden conversations are excluded from list and search

### 10.2 Message Request Flow

```
1. Stranger sends message via POST /v2/messages/private
2. Receiver sees conversation in /v2/conversations/strangers with status "pending"
3. Receiver can:
   a. Accept -> POST /v2/message-requests/{id}/accept
   b. Reject -> POST /v2/message-requests/{id}/reject
4. After accept, messages flow normally
```

### 10.3 Self-Destruct Messages (TTL)

- Set `ttlSeconds` when sending message
- Server auto-deletes after TTL expires
- `expiresAt` / `expireAtEpoch` returned in message object
- Frontend should hide expired messages client-side

### 10.4 30-Second Edit Window

- After 30 seconds, edit endpoint returns `403`
- Frontend should disable edit button after 30s
- `editedAt` timestamp helps detect stale messages

### 10.5 Group Member Validation

- V2 requires all group members to be active friends
- Server validates before adding
- Frontend should pre-filter friend list before showing "Add to group" options

### 10.6 Presence Privacy

| User's `lastSeen` Setting | What Others See |
|---|---|
| `everyone` | Exact last seen time |
| `friends` | "Last seen X ago" for non-friends, exact for friends |
| `nobody` | "Last seen recently" for everyone |

---

## 11. Error Codes

### HTTP Error Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `400` | Bad request / validation |
| `401` | Unauthorized (invalid/expired token) |
| `403` | Forbidden (no permission) |
| `404` | Not found |
| `409` | Conflict (e.g., user busy on call) |
| `410` | Gone (e.g., call ended) |
| `422` | Unprocessable (validation error) |
| `500` | Internal server error |

### Common Error Shapes

```json
// Validation error
{ "error": "Validation failed", "details": { "field": "message" } }

// Permission error
{ "error": "Not authorized to send message (blocked / not member)" }

// Block error
{ "error": "User has blocked you" }

// Edit window expired
{ "error": "Edit window expired" }

// Stranger message blocked
{ "error": "Receiver blocks messages from strangers" }

// Duplicate
{ "error": "User is already a friend" }
```

---

## 12. Source-Verified Supporting API Inventory

The following modules are fully covered by backend and Swagger, but they are not all V2-only. Frontend should still implement the UI flows if the product needs the feature.

### 12.1 Auth V1

| Method | Path | UI / client use |
|---|---|---|
| `POST` | `/v1/auth/register` | Register |
| `POST` | `/v1/auth/login` | Login |
| `POST` | `/v1/auth/refresh` | Refresh access token |
| `POST` | `/v1/auth/introspect` | Validate token/session |
| `POST` | `/v1/auth/send-verification` | Send email verification |
| `POST` | `/v1/auth/resend-verification` | Resend verification |
| `POST` | `/v1/auth/verify-email` | Verify email OTP/code |
| `POST` | `/v1/auth/forgot-password` | Start password reset |
| `POST` | `/v1/auth/verify-reset-otp` | Verify password reset OTP |
| `POST` | `/v1/auth/resend-reset-otp` | Resend reset OTP |
| `POST` | `/v1/auth/reset-password` | Reset password |
| `POST` | `/v1/auth/change-password` | Change password while logged in |
| `POST` | `/v1/auth/logout` | Logout current session |
| `POST` | `/v1/auth/logout-all` | Logout all sessions |
| `GET` | `/v1/auth/sessions` | Session/device management |
| `DELETE` | `/v1/auth/sessions/{deviceId}` | Revoke one session |
| `DELETE` | `/v1/auth/sessions` | Revoke all sessions |
| `PATCH` | `/v1/auth/avatar` | Update avatar |

### 12.2 User V2

| Method | Path | UI / client use |
|---|---|---|
| `GET` | `/v2/users/me/profile` | My profile |
| `PATCH` | `/v2/users/me/profile` | Edit my profile |
| `PATCH` | `/v2/users/me/privacy` | Privacy settings |
| `GET` | `/v2/users/me/avatar-history` | Avatar history |
| `GET` | `/v2/users/search` | Search users |
| `GET` | `/v2/users/search-by-phone` | Search by phone |
| `GET` | `/v2/users/{id}/presence` | Privacy-aware presence |
| `GET` | `/v2/users/{id}/public` | Public profile |
| `GET` | `/v2/friends/suggestions` | Friend suggestions |

### 12.3 Media V1

| Method | Path | UI / client use |
|---|---|---|
| `POST` | `/v1/media/upload` | Single multipart upload, field `file` |
| `POST` | `/v1/media/upload-multiple` | Multiple multipart upload, field `files`, max 10 |
| `DELETE` | `/v1/media/{filename}` | Delete uploaded media |
| `POST` | `/v1/media/request-upload-url` | Request presigned upload URL |
| `POST` | `/v1/media/confirm-upload` | Confirm presigned upload |
| `GET` | `/v1/media/upload-methods` | Discover supported upload methods |

### 12.4 Friend Requests / Friendships

These routes are mounted under both `/v1` and `/v2`.

Exact V2 aliases:

| Method | Path |
|---|---|
| `POST` | `/v2/friend-requests/{receiverId}` |
| `PATCH` | `/v2/friend-requests/{requestId}` |
| `DELETE` | `/v2/friend-requests/{requestId}` |
| `GET` | `/v2/friend-requests/received` |
| `GET` | `/v2/friend-requests/sent` |
| `GET` | `/v2/friend-requests/check/{targetUserId}` |
| `GET` | `/v2/friend-requests/count` |
| `GET` | `/v2/friendships` |
| `GET` | `/v2/friendships/count` |
| `GET` | `/v2/friendships/search` |
| `DELETE` | `/v2/friendships/{friendId}` |
| `GET` | `/v2/friendships/{friendId}/check` |
| `GET` | `/v2/users/{id}/mutual-friends` |
| `GET` | `/v2/users/{id}/suggestions` |

| Method | Path | UI / client use |
|---|---|---|
| `POST` | `/{version}/friend-requests/{receiverId}` | Send friend request |
| `PATCH` | `/{version}/friend-requests/{requestId}` | Accept/reject request by status |
| `DELETE` | `/{version}/friend-requests/{requestId}` | Cancel sent request |
| `GET` | `/{version}/friend-requests/received` | Received requests |
| `GET` | `/{version}/friend-requests/sent` | Sent requests |
| `GET` | `/{version}/friend-requests/check/{targetUserId}` | Request status with target |
| `GET` | `/{version}/friend-requests/count` | Pending count |
| `GET` | `/{version}/friendships` | Friends list |
| `GET` | `/{version}/friendships/count` | Friend count |
| `GET` | `/{version}/friendships/search` | Search friends |
| `DELETE` | `/{version}/friendships/{friendId}` | Unfriend |
| `GET` | `/{version}/friendships/{friendId}/check` | Friendship status |
| `GET` | `/{version}/users/{id}/mutual-friends` | Mutual friends |
| `GET` | `/{version}/users/{id}/suggestions` | Suggestions for a user |

### 12.5 Blocks

These routes are mounted under both `/v1` and `/v2`.

Exact V2 aliases:

| Method | Path |
|---|---|
| `POST` | `/v2/blocks/{blockedUserId}` |
| `DELETE` | `/v2/blocks/{blockedUserId}` |
| `GET` | `/v2/blocks` |
| `GET` | `/v2/blocks/{blockedUserId}/check` |

| Method | Path | UI / client use |
|---|---|---|
| `POST` | `/{version}/blocks/{blockedUserId}` | Block user |
| `DELETE` | `/{version}/blocks/{blockedUserId}` | Unblock user |
| `GET` | `/{version}/blocks` | Blocked users list |
| `GET` | `/{version}/blocks/{blockedUserId}/check` | Block status |

### 12.6 My Cloud V1

| Method | Path | UI / client use |
|---|---|---|
| `GET` | `/v1/my-cloud`, `/v1/my-cloud/items` | List cloud items |
| `POST` | `/v1/my-cloud` | Create cloud item |
| `PATCH` | `/v1/my-cloud/{id}` | Update item |
| `DELETE` | `/v1/my-cloud/{id}` | Soft delete item |
| `POST` | `/v1/my-cloud/{id}/restore` | Restore from trash |
| `DELETE` | `/v1/my-cloud/{id}/permanent` | Permanent delete |
| `POST` | `/v1/my-cloud/trash/empty` | Empty trash |
| `PATCH` | `/v1/my-cloud/{id}/pin` | Pin/unpin item |
| `GET` | `/v1/my-cloud/stats` | Storage/statistics |
| `GET` | `/v1/my-cloud/search` | Search cloud items |
| `POST` | `/v1/my-cloud/batch-delete` | Batch delete |
| `POST` | `/v1/my-cloud/{id}/share` | Create share link |
| `GET` | `/v1/my-cloud/shared/{shareToken}` | Public/shared item |
| `POST` | `/v1/my-cloud/upload` | Multipart upload |
| `POST` | `/v1/my-cloud/upload/presigned` | Presigned upload URL |
| `POST` | `/v1/my-cloud/upload/confirm` | Confirm presigned upload |
| `POST` | `/v1/my-cloud/{id}/forward` | Forward cloud item to chat |
| `POST` | `/v1/my-cloud/collections` | Create collection |
| `GET` | `/v1/my-cloud/collections` | List collections |
| `GET` | `/v1/my-cloud/collections/{id}` | Collection detail |
| `PATCH` | `/v1/my-cloud/collections/{id}` | Update collection |
| `DELETE` | `/v1/my-cloud/collections/{id}` | Delete collection |
| `POST` | `/v1/my-cloud/collections/{id}/items` | Add item to collection |
| `DELETE` | `/v1/my-cloud/collections/{id}/items/{itemId}` | Remove item from collection |
| `GET` | `/v1/my-cloud/collections/{id}/items` | Collection items |

### 12.7 AI V1

| Method | Path | UI / client use |
|---|---|---|
| `POST` | `/v1/ai/summarize` | Summarize text/conversation content |
| `POST` | `/v1/ai/smart-reply` | Generate suggested replies |
| `POST` | `/v1/ai/tone-adjust` | Rewrite text tone |
| `POST` | `/v1/ai/translate` | Translate text |
| `POST` | `/v1/ai/detect-language` | Detect language |

### 12.8 Global Search V1

| Method | Path | UI / client use |
|---|---|---|
| `GET` | `/v1/search` | Global search |

---

## 13. Migration Checklist

If migrating from V1 to V2:

- [ ] Replace conversation list calls: `GET /v1/conversations` -> `GET /v2/conversations`
- [ ] Remove manual filtering of hidden conversations (V2 excludes them automatically)
- [ ] Add stranger/message request tab using `GET /v2/conversations/strangers`
- [ ] Update send message: add `ttlSeconds` support for self-destruct
- [ ] Add 30-second edit window timer UI
- [ ] Implement hidden conversation PIN flow (hide/unlock/unhide)
- [ ] Update group creation: pre-filter members to only show friends
- [ ] Update profile endpoints to V2 for privacy controls
- [ ] Update friend suggestions to V2 for scoring
- [ ] Add presence privacy handling based on user's privacy settings
- [ ] Update call integration to use `/v2/calls` namespace
- [ ] Implement Socket.IO `subscribeConversation` / `unsubscribeConversation`
- [ ] Remove V1 call socket namespace `/socket/calls` usage, switch to `/v2/calls`

---

## 14. File Structure Reference

```
src/
  index.ts                        # Main entry, route registration
  share/component/socket-io.ts    # Socket.IO root server
  modules/chat/
    infras/transport/
      socket-service.ts           # /messages namespace
      http/v2-chat.routes.ts      # Chat V2 routes
      http/v2-chat-controller.ts  # Chat V2 controller
    constants/socket-events.ts     # Event name constants
  modules/user/
    infras/transport/
      socket-service.ts           # /user namespace
      user-v2.routes.ts          # User V2 routes
      user-v2-http-service.ts    # User V2 service
  modules/call/
    infras/transport/
      call-v2-socket.service.ts   # /v2/calls namespace
      http/call-v2.routes.ts      # Call V2 routes
      http/call-v2.controller.ts  # Call V2 controller

docs/
  swagger/main.yaml               # OpenAPI spec
  swagger/paths/chat-v2.yaml      # Chat V2 paths
  swagger/paths/user-v2.yaml      # User V2 paths
  swagger/paths/calls.yaml        # Call V1/V2 paths
  handoff/FRONTEND_HANDOFF_FILES_V2.md # Handoff reading checklist
  SOCKET_EVENTS_V2_REFERENCE.md   # Socket.IO events reference
  FE_INTEGRATION_GUIDE_V2.md     # This file
```
