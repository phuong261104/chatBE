# Chat Backend API & Socket.IO Reference
## d:\be\bezl\chatBE - Complete API Documentation for Frontend

> **Priority**: Socket.IO events are listed **first** for each feature (if implemented). REST APIs are fallback.
> **Base URL**: `http://localhost:3000/v1`
> **Socket Namespace**: `/messages`
> **Authentication**: Bearer token in `Authorization` header (HTTP) or `auth.token` / `query.token` (Socket)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Conversations](#2-conversations)
3. [Messages](#3-messages)
4. [Groups](#4-groups)
5. [Reactions](#5-reactions)
6. [Polls](#6-polls)
7. [Message Actions](#7-message-actions)
8. [Conversation Management](#8-conversation-management)
9. [Stickers & GIFs](#9-stickers--gifs)
10. [Read Receipts](#10-read-receipts)
11. [Hidden Messages](#11-hidden-messages)
12. [Forward from Cloud](#12-forward-from-cloud)
13. [Socket.IO Connection Guide](#13-socketio-connection-guide)

---

## 1. Authentication

### 1.1 Socket.IO Connection Auth

```typescript
// Connect to Socket.IO
const socket = io("http://localhost:3000/messages", {
  auth: {
    token: "YOUR_JWT_TOKEN",
    deviceId: "device_001",  // optional
    platform: "web"           // optional
  },
  transports: ["websocket", "polling"],
  query: {
    token: "YOUR_JWT_TOKEN",
    deviceId: "device_001"
  }
});

// Events emitted by server on connect
socket.on("connected", (data: {
  socketId: string;
  userId: string;
  connectionState: "connected";
  timestamp: number;
  activeConnections: number;
  heartbeatConfig: { interval: number; timeout: number };
}) => {
  console.log("Connected:", data);
});

// Event: user comes online
socket.on("user:online", (data: { userId: string; socketId: string; timestamp: number }) => {});

// Event: user goes offline
socket.on("user:offline", (data: { userId: string; timestamp: number; reason: string }) => {});

// Event: server heartbeat response
socket.on("pong", (data: { timestamp: number; serverTime: number; latency: number }) => {});
```

### 1.2 Keep-Alive / Heartbeat

```typescript
// Client sends ping every ~25s
socket.on("connect", () => {
  setInterval(() => {
    socket.emit("ping", { timestamp: Date.now() });
  }, 25000);
});
```

---

## 2. Conversations

### 2.1 Get or Create Private Conversation

**Socket (Priority):** Not implemented via socket yet. Use REST.

**REST API:**
```
POST /conversations/private
```
*Request:*
```json
{ "targetUserId": "user_id_here" }
```
*Response:* `201`
```json
{
  "data": {
    "id": "conv_xxx",
    "type": "private",
    "pairKey": "userA_userB",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 2.2 List Conversations

**Socket:** Not implemented. Use REST.

**REST API:**
```
GET /conversations?page=1&limit=20
```
*Response:* `200`
```json
{
  "data": [
    {
      "id": "conv_001",
      "name": "Nhóm Dev Team",
      "type": "group",
      "avatarUrl": "https://...",
      "lastMessage": { "messageId": "...", "senderId": "...", "type": "text", "textPreview": "Chào!", "createdAt": "..." },
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "unreadCount": 3,
      "pinned": true,
      "muteUntil": null,
      "archived": false,
      "membersCount": 5,
      "createdAt": "..."
    }
  ]
}
```

---

### 2.3 List Conversations (Cursor Pagination)

**REST API:**
```
GET /conversations/cursor?cursor=<nextCursor>&limit=20
```
*Response:* `200`
```json
{
  "status": "success",
  "msg": "OK",
  "pinned": [ /* pinned conversations */ ],
  "data": [ /* conversation list */ ],
  "nextCursor": "msg_abc123",
  "hasMore": true
}
```

---

### 2.4 Get Conversation Detail

**REST API:**
```
GET /conversations/:conversationId
```
*Response:* `200`
```json
{
  "data": {
    "conversation": { /* Conversation object */ },
    "members": [ /* ConversationMember[] */ ],
    "currentUserRole": "member"
  }
}
```

---

### 2.5 Get Total Unread Count

**REST API:**
```
GET /conversations/unread-count
```
*Response:* `200`
```json
{ "totalUnread": 42 }
```

---

### 2.6 Get Shared Conversations

**REST API:**
```
GET /users/:userId/conversations
```
*Response:* `200`
```json
{
  "data": [ /* Conversation[] - shared conversations between current user and target user */ ]
}
```

---

### 2.7 Get Conversation Statistics

**REST API:**
```
GET /conversations/:conversationId/statistics
```
*Response:* `200`
```json
{
  "data": {
    "messageCount": 150,
    "memberCount": 10,
    "activeMemberCount": 8,
    "lastActivity": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## 3. Messages

### 3.1 Send Message

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.SEND_MESSAGE, {
  conversationId: "conv_xxx",
  text: "Hello!",
  media: [
    {
      url: "https://cdn.example.com/img.jpg",
      filename: "photo.jpg",
      mimetype: "image/jpeg",
      size: 102400,
    }
  ]
}, (response: {
  success: boolean;
  messages?: Message[];
  error?: string;
}) => {
  // response.messages is Message[]
});
```

**REST API (Fallback):**
```
POST /conversations/:conversationId/messages
```
*Request:*
```json
{
  "text": "Hello!",
  "media": [{ "url": "...", "filename": "...", "mimetype": "...", "size": 102400 }]
}
```
*Response:* `201` — Returns `Message[]` (may be multiple if text+media+link)

**Receive (Server → Client):**
```typescript
socket.on(SocketEvent.RECEIVE_MESSAGE, (data: {
  message: Message;
  conversationId: string;
}) => {
  // New message received
});
```

---

### 3.2 Load Messages

**REST API:**
```
GET /conversations/:conversationId/messages?cursor=<cursor>&limit=20
```
*Response:* `200`
```json
{
  "data": {
    "messages": [
      {
        "id": "msg_001",
        "conversationId": "conv_001",
        "senderId": "user_123",
        "type": "text",
        "text": "Xin chào mọi người!",
        "media": [],
        "links": [],
        "quotedMessageId": null,
        "pinned": false,
        "createdAt": "2024-01-15T10:30:00Z",
        "editedAt": null,
        "deletedAt": null,
        "reactions": []
      }
    ],
    "nextCursor": "msg_abc456",
    "hasMore": true,
    "memberSeenMap": {
      "user_456": "msg_001",
      "user_789": "msg_003"
    }
  }
}
```

---

### 3.3 Mark as Seen

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.MESSAGE_SEEN, {
  conversationId: "conv_xxx",
  lastSeenMessageId: "msg_yyy"
}, (response) => { /* { success: boolean } */ });
```

**REST API (Fallback):**
```
POST /conversations/:conversationId/seen
```
*Request:* `{ "lastSeenMessageId": "msg_xxx" }`

**Receive (Server → Client):**
```typescript
socket.on(SocketEvent.MESSAGE_SEEN, (data: {
  conversationId: string;
  userId: string;
  lastSeenMessageId: string;
}) => {
  // Someone has seen messages
});
```

---

### 3.4 Mark as Delivered

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.MESSAGE_DELIVERED, {
  conversationId: "conv_xxx",
  lastDeliveredMessageId: "msg_yyy"
}, (response) => { /* { success: boolean } */ });
```

**REST API (Fallback):**
```
POST /conversations/:conversationId/delivered
```
*Request:* `{ "lastDeliveredMessageId": "msg_xxx" }`

**Receive:**
```typescript
socket.on(SocketEvent.MESSAGE_DELIVERED, (data: {
  conversationId: string;
  userId: string;
  lastDeliveredMessageId: string;
}) => {});
```

---

### 3.5 Get Conversation Media

**REST API:**
```
GET /conversations/:conversationId/media?cursor=<cursor>&limit=20&type=all|image|file|link|video|voice
```
*Response:* `200`
```json
{
  "data": {
    "images": [
      {
        "messageId": "msg_001",
        "url": "https://cdn.example.com/img.jpg",
        "name": "photo.jpg",
        "size": 102400,
        "width": 1920,
        "height": 1080,
        "mediaType": "image",
        "senderId": "user_123",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "files": [ /* FileItem[] */ ],
    "links": [ /* LinkItem[] */ ],
    "nextCursor": "msg_xyz789",
    "hasMore": true
  }
}
```

---

### 3.6 Typing Indicators

**Socket (Priority):** ✅ Implemented

```typescript
// Start typing
socket.emit(SocketEvent.TYPING_START, {
  toUserId: "user_xxx"      // for private chat
  // OR
  groupId: "conv_xxx"       // for group chat
});

// Stop typing
socket.emit(SocketEvent.TYPING_STOP, {
  toUserId: "user_xxx"
  // OR
  groupId: "conv_xxx"
});

// Receive
socket.on(SocketEvent.TYPING_START, (data: {
  userId: string;
  toUserId?: string;
  groupId?: string;
}) => {
  // userId is typing
});

socket.on(SocketEvent.TYPING_STOP, (data: {
  userId: string;
  toUserId?: string;
  groupId?: string;
}) => {
  // userId stopped typing
});
```

---

### 3.7 Get Online Status

**Socket (Priority):** ✅ Implemented

```typescript
// Check single user online status
socket.emit("getOnlineStatus", { userId: "user_xxx" }, (response: {
  userId: string;
  online: boolean;
  connectionCount: number;
  timestamp: number;
}) => {});

// Check batch users online status
socket.emit("getBatchOnlineStatus", { userIds: ["user_a", "user_b"] }, (response: {
  statuses: Array<{ userId: string; online: boolean; connectionCount: number }>;
  timestamp: number;
}) => {});

// Subscribe/Unsubscribe conversation rooms
socket.emit("subscribeConversation", { conversationId: "conv_xxx" }, (response: {
  success: boolean;
  room: string;
  timestamp: number;
}) => {});

socket.emit("unsubscribeConversation", { conversationId: "conv_xxx" }, (response) => {});
```

---

## 4. Groups

### 4.1 Create Group

**Socket:** Not implemented via socket. Use REST.

**REST API:**
```
POST /groups
```
*Request:*
```json
{
  "name": "Nhóm Dev Team",
  "memberIds": ["user_001", "user_002", "user_003"],
  "avatarUrl": "https://..."
}
```
*Response:* `201`
```json
{
  "data": {
    "conversation": { /* Conversation */ },
    "members": [ /* ConversationMember[] */ ],
    "systemMessage": { /* Message */ }
  }
}
```

**Receive:** (via REST, socket notification is sent automatically)
```typescript
socket.on(SocketEvent.CONVERSATION_CREATED, (data: {
  conversation: Conversation;
  systemMessage: Message;
}) => {});
```

---

### 4.2 Get Group Info

**REST API:**
```
GET /groups/:groupId/info
```
*Response:* `200`
```json
{
  "data": {
    "conversation": { /* Conversation */ },
    "members": [ /* ConversationMember[] */ ],
    "currentUserRole": "admin",
    "settings": {
      "allowSendLink": true,
      "requireApproval": false,
      "allowMemberInvite": true
    }
  }
}
```

---

### 4.3 Update Group Info

**REST API:**
```
PUT /groups/:groupId
```
*Request:* `{ "name": "New Name", "avatarUrl": "https://..." }`

**Receive:**
```typescript
socket.on(SocketEvent.GROUP_RENAMED, (data: {
  conversationId: string;
  newName: string;
  renamedBy: string;
}) => {});

socket.on(SocketEvent.GROUP_AVATAR_CHANGED, (data: {
  conversationId: string;
  avatarUrl: string;
  changedBy: string;
}) => {});
```

---

### 4.4 Dissolve Group (Owner Only)

**REST API:**
```
DELETE /groups/:groupId
```
*Response:* `200`

**Receive:**
```typescript
socket.on(SocketEvent.GROUP_DISSOLVED, (data: {
  conversationId: string;
  dissolvedBy: string;
}) => {});
```

---

### 4.5 Leave Group

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.LEAVE_GROUP, {
  conversationId: "conv_xxx"
}, (response) => { /* { success: boolean } */ });
```

**REST API (Fallback):**
```
POST /groups/:groupId/leave
```

**Receive:**
```typescript
socket.on(SocketEvent.GROUP_MEMBER_LEFT, (data: {
  conversationId: string;
  leftUserId: string;
  leftBy: string;
}) => {});
```

---

### 4.6 Get Group Members

**REST API:**
```
GET /groups/:groupId/members
```
*Response:* `200`
```json
{
  "data": [
    {
      "id": "mem_001",
      "conversationId": "conv_001",
      "userId": "user_123",
      "role": "admin",
      "status": "active",
      "joinedAt": "2024-01-01T00:00:00Z",
      "unreadCount": 0,
      "pinned": false
    }
  ]
}
```

---

### 4.7 Add Members

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.ADD_MEMBERS, {
  groupId: "conv_xxx",
  memberIds: ["user_a", "user_b"]
}, (response: { success: boolean; newMembers?: ConversationMember[] }) => {});
```

**REST API (Fallback):**
```
POST /groups/:groupId/members
```
*Request:* `{ "memberIds": ["user_a", "user_b"] }`

**Receive:**
```typescript
socket.on(SocketEvent.CONVERSATION_MEMBERS_ADDED, (data: {
  conversationId: string;
  newMembers: ConversationMember[];
  addedBy: string;
}) => {});
```

---

### 4.8 Remove Member

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.REMOVE_MEMBER, {
  groupId: "conv_xxx",
  targetUserId: "user_yyy"
}, (response) => { /* { success: boolean } */ });
```

**REST API (Fallback):**
```
DELETE /groups/:groupId/members/:userId
```

**Receive:**
```typescript
// To group room
socket.on(SocketEvent.CONVERSATION_MEMBER_REMOVED, (data: {
  conversationId: string;
  removedUserId: string;
  removedBy: string;
}) => {});

// To removed user directly
socket.on(SocketEvent.GROUP_MEMBER_LEFT, (data: {
  conversationId: string;
  leftUserId: string;
  leftBy: string;
}) => {});
```

---

### 4.9 Set Admin

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.SET_ADMIN, {
  groupId: "conv_xxx",
  targetUserId: "user_yyy",
  isAdmin: true
}, (response) => { /* { success: boolean } */ });
```

**REST API (Fallback):**
```
POST /groups/:groupId/set-admin
```
*Request:* `{ "targetUserId": "user_yyy", "isAdmin": true }`

**Receive:**
```typescript
socket.on(SocketEvent.GROUP_ADMIN_CHANGED, (data: {
  conversationId: string;
  targetUserId: string;
  isAdmin: boolean;
  changedBy: string;
}) => {});
```

---

### 4.10 Transfer Owner

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.TRANSFER_OWNER, {
  groupId: "conv_xxx",
  newOwnerId: "user_yyy"
}, (response) => { /* { success: boolean } */ });
```

**REST API (Fallback):**
```
POST /groups/:groupId/transfer-owner
```
*Request:* `{ "newOwnerId": "user_yyy" }`

**Receive:**
```typescript
socket.on(SocketEvent.GROUP_OWNER_TRANSFERRED, (data: {
  conversationId: string;
  oldOwnerId: string;
  newOwnerId: string;
}) => {});
```

---

### 4.11 Update Group Settings

**REST API:**
```
PATCH /groups/:groupId/settings
```
*Request:*
```json
{
  "allowSendLink": true,
  "requireApproval": false,
  "allowMemberInvite": true
}
```

**Receive:**
```typescript
socket.on(SocketEvent.GROUP_SETTINGS_UPDATED, (data: {
  conversationId: string;
  settings: GroupSettings;
}) => {});
```

---

### 4.12 Get Pending Members

**REST API:**
```
GET /groups/:groupId/members/pending
```

---

### 4.13 Approve Member

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.APPROVE_MEMBER, {
  groupId: "conv_xxx",
  userIdToApprove: "user_yyy"
}, (response) => { /* { success: boolean; member?: ConversationMember } */ });
```

**REST API (Fallback):**
```
PATCH /groups/:groupId/members/:userId/approve
```

**Receive:**
```typescript
socket.on(SocketEvent.GROUP_MEMBER_APPROVED, (data: {
  conversationId: string;
  userId: string;
  member: ConversationMember;
  approvedBy: string;
}) => {});
```

---

### 4.14 Reject Member

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.REJECT_MEMBER, {
  groupId: "conv_xxx",
  userIdToReject: "user_yyy"
}, (response) => { /* { success: boolean } */ });
```

**REST API (Fallback):**
```
PATCH /groups/:groupId/members/:userId/reject
```

**Receive:**
```typescript
socket.on(SocketEvent.GROUP_MEMBER_REJECTED, (data: {
  conversationId: string;
  userId: string;
  rejectedBy: string;
}) => {});
```

---

### 4.15 Get Online Members in Group

**REST API:**
```
GET /conversations/:conversationId/members/online
```
*Response:* `200`
```json
{
  "data": [
    { "userId": "user_1", "isOnline": true, "lastSeen": null },
    { "userId": "user_2", "isOnline": false, "lastSeen": "2024-01-15T09:00:00Z" }
  ]
}
```

---

## 5. Reactions

### 5.1 Add Reaction

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.ADD_REACTION, {
  messageId: "msg_xxx",
  emoji: "👍"
}, (response: { success: boolean; reaction?: MessageReaction }) => {});
```

**REST API (Fallback):**
```
POST /messages/:messageId/react
```
*Request:* `{ "emoji": "👍" }`

**Receive:**
```typescript
socket.on(SocketEvent.MESSAGE_REACTION, (data: {
  messageId: string;
  reaction: MessageReaction;
}) => {});
```

---

### 5.2 Remove Reaction

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.REMOVE_REACTION, {
  messageId: "msg_xxx",
  emoji: "👍"  // optional, removes specific emoji or all
}, (response: { success: boolean; deletedCount?: number }) => {});
```

**REST API (Fallback):**
```
DELETE /messages/:messageId/react
```
*Request:* `{ "emoji": "👍" }`

**Receive:**
```typescript
socket.on(SocketEvent.MESSAGE_REACTION_REMOVE, (data: {
  messageId: string;
  userId: string;
  emoji?: string;
}) => {});
```

---

### 5.3 Remove All Reactions

**REST API:**
```
DELETE /messages/:messageId/reactions
```

**Receive:**
```typescript
socket.on(SocketEvent.MESSAGE_REACTIONS_CLEAR, (data: {
  messageId: string;
  userId: string;
}) => {});
```

---

### 5.4 Get Reactions

**REST API:**
```
GET /messages/:messageId/reactions
```
*Response:* `200`
```json
{
  "data": {
    "reactions": [
      {
        "id": "react_001",
        "messageId": "msg_001",
        "userId": "user_123",
        "emoji": "👍",
        "createdAt": "2024-01-15T10:35:00Z",
        "user": { "id": "user_123", "avatarUrl": "...", "displayName": "Nguyễn Văn A" }
      }
    ],
    "grouped": { "👍": 5, "❤️": 2 }
  }
}
```

---

## 6. Polls

### 6.1 Create Poll

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.CREATE_POLL, {
  conversationId: "conv_xxx",
  question: "Chọn ngày họp?",
  options: ["Thứ 2", "Thứ 3", "Thứ 4"],
  isMultipleChoice: false,
  allowAddOption: true,
  expiresAt: "2024-01-20T10:00:00Z"  // optional
}, (response: { success: boolean; poll?: Poll }) => {});
```

**REST API (Fallback):**
```
POST /groups/:groupId/polls
```
*Request:*
```json
{
  "question": "Chọn ngày họp?",
  "options": ["Thứ 2", "Thứ 3", "Thứ 4"],
  "isMultipleChoice": false,
  "allowAddOption": true,
  "expiresAt": "2024-01-20T10:00:00Z"
}
```

**Receive:**
```typescript
socket.on(SocketEvent.POLL_NEW, (data: {
  conversationId: string;
  poll: Poll;
  createdBy: string;
}) => {});
```

---

### 6.2 Get Polls

**REST API:**
```
GET /groups/:groupId/polls
```

---

### 6.3 Vote Poll

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.VOTE_POLL, {
  pollId: "poll_xxx",
  optionIds: ["opt_001"]
}, (response: { success: boolean; poll?: Poll }) => {});
```

**REST API (Fallback):**
```
POST /groups/:groupId/polls/:pollId/vote
```
*Request:* `{ "optionIds": ["opt_001"] }`

**Receive:**
```typescript
socket.on(SocketEvent.POLL_VOTE, (data: {
  conversationId: string;
  pollId: string;
  poll: Poll;
  votedBy: string;
}) => {});
```

---

### 6.4 Get Poll Results

**REST API:**
```
GET /groups/:groupId/polls/:pollId/results
```

---

## 7. Message Actions

### 7.1 Edit Message

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.EDIT_MESSAGE, {
  messageId: "msg_xxx",
  text: "Updated text"
}, (response: { success: boolean; message?: Message }) => {});
```

**REST API (Fallback):**
```
PUT /messages/:messageId
```
*Request:* `{ "text": "Updated text" }`

**Receive:**
```typescript
socket.on(SocketEvent.MESSAGE_EDITED, (data: {
  conversationId: string;
  message: Message;
}) => {});
```

---

### 7.2 Delete Message (For Me)

**REST API:**
```
POST /messages/:messageId/delete
```

---

### 7.3 Delete Message (For Everyone)

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.DELETE_MESSAGE_FOR_EVERYONE, {
  messageId: "msg_xxx"
}, (response: { success: boolean; message?: Message }) => {});
```

**REST API (Fallback):**
```
POST /messages/:messageId/delete-for-everyone
```

**Receive:**
```typescript
socket.on(SocketEvent.MESSAGE_DELETED_FOR_EVERYONE, (data: {
  conversationId: string;
  messageId: string;
  deletedBy: string;
}) => {});
```

---

### 7.4 Revoke Message

**REST API:**
```
POST /messages/:messageId/revoke
```

**Receive:**
```typescript
socket.on(SocketEvent.MESSAGE_REVOKED, (data: {
  conversationId: string;
  message: Message;
}) => {});
```

---

### 7.5 Pin Message

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.PIN_MESSAGE, {
  messageId: "msg_xxx"
}, (response: { success: boolean; message?: Message }) => {});
```

**REST API (Fallback):**
```
POST /messages/:messageId/pin
```

**Receive:**
```typescript
socket.on(SocketEvent.MESSAGE_PINNED, (data: {
  conversationId: string;
  message: Message;
}) => {});
```

---

### 7.6 Unpin Message

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.UNPIN_MESSAGE, {
  messageId: "msg_xxx"
}, (response) => {});
```

**REST API (Fallback):**
```
DELETE /messages/:messageId/pin
```

**Receive:**
```typescript
socket.on(SocketEvent.MESSAGE_UNPINNED, (data: {
  conversationId: string;
  message: Message;
}) => {});
```

---

### 7.7 Get Pinned Messages

**REST API:**
```
GET /conversations/:conversationId/pinned-messages
```

---

### 7.8 Search Messages

**REST API:**
```
GET /conversations/:conversationId/search?query=keyword&cursor=<cursor>&limit=20
```
*Response:* `200`
```json
{
  "data": {
    "messages": [ /* Message[] */ ],
    "nextCursor": "msg_xyz",
    "hasMore": false,
    "total": 15
  }
}
```

---

### 7.9 Forward Messages

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.FORWARD_MESSAGES, {
  messageIds: ["msg_a", "msg_b"],
  targetConversationIds: ["conv_1", "conv_2"]
}, (response: { success: boolean; messages?: Message[] }) => {});
```

**REST API (Fallback):**
```
POST /messages/forward
```
*Request:*
```json
{
  "messageIds": ["msg_a", "msg_b"],
  "targetConversationIds": ["conv_1", "conv_2"]
}
```

**Receive:** (same as new message)
```typescript
socket.on(SocketEvent.RECEIVE_MESSAGE, (data: {
  message: Message;
  conversationId: string;
}) => {});
```

---

### 7.10 Quote Message (Reply with Quote)

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.QUOTE_MESSAGE, {
  conversationId: "conv_xxx",
  quotedMessageId: "msg_yyy",
  text: "I agree with this!",
  media: []  // optional
}, (response: { success: boolean; message?: Message }) => {});
```

**REST API (Fallback):**
```
POST /messages/:messageId/quote
```
*Request:*
```json
{
  "text": "I agree with this!",
  "media": []
}
```

**Receive:**
```typescript
// New message received (includes quotedMessageId)
socket.on(SocketEvent.RECEIVE_MESSAGE, (data) => {});

// Specific quote event
socket.on(SocketEvent.MESSAGE_QUOTED, (data: {
  conversationId: string;
  message: Message;
  quotedMessageId: string;
}) => {});
```

---

### 7.11 Delete Messages Bulk

**REST API:**
```
DELETE /conversations/:conversationId/messages/bulk
```
*Request:*
```json
{
  "messageIds": ["msg_a", "msg_b"],
  "before": "2024-01-15T00:00:00Z",
  "after": "2024-01-01T00:00:00Z"
}
```
Note: `messageIds` OR `before`/`after` range must be provided.

---

## 8. Conversation Management

### 8.1 Pin Conversation

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.PIN_CONVERSATION, {
  conversationId: "conv_xxx"
}, (response) => { /* { success: boolean } */ });
```

**REST API (Fallback):**
```
POST /conversations/:conversationId/pin-conversation
```

**Receive:**
```typescript
socket.on(SocketEvent.CONVERSATION_PIN_TOGGLED, (data: {
  conversationId: string;
  pinnedBy: string;
  pinned: boolean;
}) => {});
```

---

### 8.2 Unpin Conversation

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.UNPIN_CONVERSATION, {
  conversationId: "conv_xxx"
}, (response) => {});
```

**REST API (Fallback):**
```
DELETE /conversations/:conversationId/pin-conversation
```

---

### 8.3 Archive Conversation

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.ARCHIVE_CONVERSATION, {
  conversationId: "conv_xxx"
}, (response) => {});
```

**REST API (Fallback):**
```
POST /conversations/:conversationId/archive
```

**Receive:**
```typescript
socket.on(SocketEvent.CONVERSATION_ARCHIVED_TOGGLED, (data: {
  conversationId: string;
  userId: string;
  archived: boolean;
}) => {});
```

---

### 8.4 Unarchive Conversation

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.UNARCHIVE_CONVERSATION, {
  conversationId: "conv_xxx"
}, (response) => {});
```

**REST API (Fallback):**
```
DELETE /conversations/:conversationId/archive
```

---

### 8.5 Mute Conversation

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.MUTE_CONVERSATION, {
  conversationId: "conv_xxx",
  muteUntil: "2024-01-20T00:00:00Z",  // optional
  duration: 3600  // optional, seconds
}, (response) => {});
```

**REST API (Fallback):**
```
POST /conversations/:conversationId/mute
```
*Request:* `{ "duration": 3600, "muteUntil": "2024-01-20T00:00:00Z" }`

**Receive:**
```typescript
socket.on(SocketEvent.CONVERSATION_MUTE_CHANGED, (data: {
  conversationId: string;
  userId: string;
  mutedBy: string;
  muteUntil?: string;
  duration?: number;
  muted: boolean;
}) => {});
```

---

### 8.6 Unmute Conversation

**Socket (Priority):** ✅ Implemented
```typescript
socket.emit(SocketEvent.UNMUTE_CONVERSATION, {
  conversationId: "conv_xxx"
}, (response) => {});
```

**REST API (Fallback):**
```
DELETE /conversations/:conversationId/mute
```

---

### 8.7 Get Drafts

**REST API:**
```
GET /conversations/:conversationId/drafts
```

---

### 8.8 Translate Message

**REST API:**
```
POST /messages/:messageId/translate
```
*Request:* `{ "targetLanguage": "en" }`
*Response:*
```json
{
  "data": {
    "originalText": "Xin chào",
    "translatedText": "Hello",
    "detectedLanguage": "vi",
    "targetLanguage": "en"
  }
}
```

---

### 8.9 Copy Conversation

**REST API:**
```
POST /conversations/:conversationId/copy
```
*Request:*
```json
{
  "targetUserId": "user_xxx",
  "memberIds": ["user_a", "user_b"],
  "before": "2024-01-01T00:00:00Z",
  "after": "2024-01-15T00:00:00Z"
}
```

---

## 9. Stickers & GIFs

> These are implemented as message types. Use the Send Message flow with `type: "sticker"` or `type: "gif"`.

**REST API:** (via send message, type is determined by media content)
```
POST /conversations/:conversationId/messages
```
For stickers/GIFs, send with `media` containing the sticker/GIF URL and the system will create appropriate message type.

**Receive:** Same as regular message
```typescript
socket.on(SocketEvent.RECEIVE_MESSAGE, (data: {
  message: Message;  // message.type === "sticker" or "gif"
  conversationId: string;
}) => {});
```

---

## 10. Read Receipts

### 10.1 Get Read Receipts

**REST API:**
```
GET /messages/:messageId/receipts
```
*Response:* `200`
```json
{
  "data": [
    { "userId": "user_456", "readAt": "2024-01-15T10:35:00Z" },
    { "userId": "user_789", "readAt": "2024-01-15T10:36:00Z" }
  ]
}
```

---

### 10.2 Mark Multiple as Read

**REST API:** (via mark as seen)
```
POST /conversations/:conversationId/seen
```
Pass `lastSeenMessageId` to mark all messages up to that point as read.

---

## 11. Hidden Messages

### 11.1 Hide User Messages

**REST API:** (Not exposed via REST yet — requires use case integration)
> Note: The `HideUserMessagesHandler` exists but is not wired to REST API or Socket.
> Uses: `hiddenUserIds` array on `ConversationMember` model.

---

## 12. Forward from Cloud

**REST API:** (via forward messages)
```
POST /messages/forward
```
For cloud files, first upload to My Cloud module, then forward using cloud item IDs.

---

## 13. Socket.IO Connection Guide

### 13.1 Complete Connection Flow

```typescript
import { io, Socket } from "socket.io-client";

class ChatSocketService {
  private socket: Socket | null = null;

  connect(token: string, deviceId?: string) {
    this.socket = io("http://localhost:3000/messages", {
      auth: { token, deviceId, platform: "web" },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("Connected to chat server");
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error.message);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
    });

    // Setup all event listeners here
    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on("connected", (data) => console.log("Server confirmed:", data));
    this.socket.on("user:online", (data) => console.log("User online:", data.userId));
    this.socket.on("user:offline", (data) => console.log("User offline:", data.userId));

    // Conversation events
    this.socket.on("conversation:created", (data) => { /* new conversation */ });
    this.socket.on("conversation:members_added", (data) => { /* members added */ });
    this.socket.on("conversation:member_removed", (data) => { /* member removed */ });
    this.socket.on("conversation:updated", (data) => { /* conversation updated */ });
    this.socket.on("conversation:pin_toggled", (data) => { /* pin state changed */ });
    this.socket.on("conversation:archived_toggled", (data) => { /* archive state changed */ });
    this.socket.on("conversation:mute_changed", (data) => { /* mute state changed */ });

    // Group events
    this.socket.on("group:member_left", (data) => { /* member left */ });
    this.socket.on("group:dissolved", (data) => { /* group dissolved */ });
    this.socket.on("group:renamed", (data) => { /* group renamed */ });
    this.socket.on("group:avatar_changed", (data) => { /* avatar changed */ });
    this.socket.on("group:admin_changed", (data) => { /* admin status changed */ });
    this.socket.on("group:owner_transferred", (data) => { /* ownership transferred */ });
    this.socket.on("group:member_approved", (data) => { /* member approved */ });
    this.socket.on("group:member_rejected", (data) => { /* member rejected */ });
    this.socket.on("group:settings_updated", (data) => { /* settings changed */ });

    // Message events
    this.socket.on("receiveMessage", (data) => { /* new message */ });
    this.socket.on("message:edited", (data) => { /* message edited */ });
    this.socket.on("message:deleted", (data) => { /* message deleted for me */ });
    this.socket.on("message:deleted_for_everyone", (data) => { /* message deleted for all */ });
    this.socket.on("message:revoked", (data) => { /* message revoked */ });
    this.socket.on("message:pinned", (data) => { /* message pinned */ });
    this.socket.on("message:unpinned", (data) => { /* message unpinned */ });
    this.socket.on("message:quoted", (data) => { /* message quoted */ });
    this.socket.on("message:reactions_clear", (data) => { /* all reactions cleared */ });

    // Reaction events
    this.socket.on("message:reaction", (data) => { /* reaction added */ });
    this.socket.on("message:reaction:remove", (data) => { /* reaction removed */ });

    // Typing events
    this.socket.on("typing:start", (data) => { /* user started typing */ });
    this.socket.on("typing:stop", (data) => { /* user stopped typing */ });

    // Status events
    this.socket.on("messageSeen", (data) => { /* messages seen */ });
    this.socket.on("messageDelivered", (data) => { /* messages delivered */ });

    // Poll events
    this.socket.on("poll:new", (data) => { /* new poll created */ });
    this.socket.on("poll:vote", (data) => { /* poll voted */ });

    // Presence events
    this.socket.on("online_status", (data) => { /* online status changed */ });
    this.socket.on("user_presence", (data) => { /* user presence updated */ });

    // Advanced message events
    this.socket.on("message:reaction_summary", (data) => { /* reaction summary */ });
    this.socket.on("message:recall", (data) => { /* message recalled */ });
    this.socket.on("message:edit_start", (data) => { /* user started editing */ });
    this.socket.on("message:edit_end", (data) => { /* user ended editing */ });
    this.socket.on("voice_message", (data) => { /* voice message received */ });
    this.socket.on("location_share", (data) => { /* location shared */ });
  }

  // Convenience methods
  sendMessage(conversationId: string, text?: string, media?: any[]) {
    this.socket?.emit("sendMessage", { conversationId, text, media }, (res) => res);
  }

  joinConversation(conversationId: string) {
    this.socket?.emit("subscribeConversation", { conversationId }, (res) => res);
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit("unsubscribeConversation", { conversationId }, (res) => res);
  }

  disconnect() {
    this.socket?.disconnect();
  }
}
```

---

## Data Models

### Message

```typescript
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: "text" | "image" | "file" | "link" | "video" | "voice" | "sticker" | "gif" | "system";
  text?: string;
  media?: MessageMedia[];
  links?: string[];
  quotedMessageId?: string;
  quotedMessagePreview?: string;
  reactions?: MessageReaction[];
  pinned: boolean;
  pinnedAt?: Date;
  readBy?: Array<{ userId: string; readAt: Date }>;
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

interface MessageMedia {
  url: string;
  mediaType: "image" | "file" | "video" | "audio";
  name?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
}

interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
  user?: { id: string; avatarUrl?: string; displayName?: string };
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  type: "private" | "group";
  pairKey?: string;  // for private conversations: "userA_userB"
  name?: string;
  avatarUrl?: string;
  createdBy?: string;
  ownerId?: string;
  admins?: string[];
  membersCount: number;
  settings?: GroupSettings;
  lastMessage?: { messageId: string; senderId: string; type: string; textPreview?: string; createdAt: Date };
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface GroupSettings {
  allowSendLink: boolean;
  requireApproval: boolean;
  allowMemberInvite: boolean;
}
```

### ConversationMember

```typescript
interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  role: "member" | "admin";
  status: "active" | "pending" | "rejected";
  joinedAt: Date;
  leftAt?: Date;
  unreadCount: number;
  lastReadMessageId?: string;
  lastReadAt?: Date;
  lastSeenMessageId?: string;
  lastDeliveredMessageId?: string;
  muteUntil?: Date;
  pinned: boolean;
  pinnedAt?: Date;
  archived: boolean;
  hiddenUserIds: string[];
  updatedAt: Date;
}
```

### Poll

```typescript
interface Poll {
  id: string;
  conversationId: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  isMultipleChoice: boolean;
  allowAddOption: boolean;
  expiresAt?: Date;
  totalVotes: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PollOption {
  id: string;
  text: string;
  voteCount: number;
  votedUserIds: string[];
}
```

---

## Socket Event Reference Table

### Client → Server (Emit)

| Event | Payload | Response | Priority |
|-------|---------|----------|----------|
| `joinGroup` | `{ conversationId }` | `{ success, message }` | Socket ✅ |
| `leaveGroup` | `{ conversationId }` | `{ success }` | Socket ✅ |
| `messageSeen` | `{ conversationId, lastSeenMessageId }` | `{ success }` | Socket ✅ |
| `messageDelivered` | `{ conversationId, lastDeliveredMessageId }` | `{ success }` | Socket ✅ |
| `typing:start` | `{ toUserId }` or `{ groupId }` | — | Socket ✅ |
| `typing:stop` | `{ toUserId }` or `{ groupId }` | — | Socket ✅ |
| `sendMessage` | `{ conversationId, text?, media? }` | `{ success, messages }` | Socket ✅ |
| `editMessage` | `{ messageId, text }` | `{ success, message }` | Socket ✅ |
| `deleteMessage` | `{ messageId }` | `{ success }` | Socket ✅ |
| `revokeMessage` | `{ messageId }` | `{ success, message }` | REST only |
| `addReaction` | `{ messageId, emoji }` | `{ success, reaction }` | Socket ✅ |
| `removeReaction` | `{ messageId, emoji? }` | `{ success, deletedCount }` | Socket ✅ |
| `markAllSeen` | `{ conversationId }` | `{ success }` | Socket ✅ |
| `deleteMessageForEveryone` | `{ messageId }` | `{ success, message }` | Socket ✅ |
| `forwardMessages` | `{ messageIds, targetConversationIds }` | `{ success, messages }` | Socket ✅ |
| `quoteMessage` | `{ conversationId, quotedMessageId, text?, media? }` | `{ success, message }` | Socket ✅ |
| `dissolveGroup` | `{ groupId }` | `{ success }` | REST only |
| `pinConversation` | `{ conversationId }` | `{ success }` | Socket ✅ |
| `unpinConversation` | `{ conversationId }` | `{ success }` | Socket ✅ |
| `archiveConversation` | `{ conversationId }` | `{ success }` | Socket ✅ |
| `unarchiveConversation` | `{ conversationId }` | `{ success }` | Socket ✅ |
| `muteConversation` | `{ conversationId, muteUntil?, duration? }` | `{ success }` | Socket ✅ |
| `unmuteConversation` | `{ conversationId }` | `{ success }` | Socket ✅ |
| `pinMessage` | `{ messageId }` | `{ success, message }` | Socket ✅ |
| `unpinMessage` | `{ messageId }` | `{ success, message }` | Socket ✅ |
| `addMembers` | `{ groupId, memberIds }` | `{ success, newMembers }` | Socket ✅ |
| `removeMember` | `{ groupId, targetUserId }` | `{ success }` | Socket ✅ |
| `setAdmin` | `{ groupId, targetUserId, isAdmin }` | `{ success }` | Socket ✅ |
| `transferOwner` | `{ groupId, newOwnerId }` | `{ success }` | Socket ✅ |
| `approveMember` | `{ groupId, userIdToApprove }` | `{ success, member }` | Socket ✅ |
| `rejectMember` | `{ groupId, userIdToReject }` | `{ success }` | Socket ✅ |
| `createPoll` | `{ conversationId, question, options, isMultipleChoice?, allowAddOption?, expiresAt? }` | `{ success, poll }` | Socket ✅ |
| `votePoll` | `{ pollId, optionIds }` | `{ success, poll }` | Socket ✅ |
| `voiceMessage` | `{ conversationId, mediaUrl, duration? }` | `{ success, messages }` | Socket ✅ |
| `locationShare` | `{ conversationId, latitude, longitude, accuracy? }` | `{ success }` | Socket ✅ |
| `subscribeConversation` | `{ conversationId }` | `{ success, room, timestamp }` | Socket ✅ |
| `unsubscribeConversation` | `{ conversationId }` | `{ success }` | Socket ✅ |
| `getOnlineStatus` | `{ userId }` | `{ userId, online, connectionCount, timestamp }` | Socket ✅ |
| `getBatchOnlineStatus` | `{ userIds }` | `{ statuses, timestamp }` | Socket ✅ |

### Server → Client (Receive)

| Event | Payload | Triggered By |
|-------|---------|--------------|
| `receiveMessage` | `{ message: Message, conversationId }` | New message sent |
| `message:edited` | `{ conversationId, message }` | Message edited |
| `message:deleted` | `{ conversationId, messageId, deletedBy }` | Message deleted for user |
| `message:deleted_for_everyone` | `{ conversationId, messageId, deletedBy }` | Message deleted for all |
| `message:revoked` | `{ conversationId, message }` | Message revoked |
| `message:pinned` | `{ conversationId, message }` | Message pinned |
| `message:unpinned` | `{ conversationId, message }` | Message unpinned |
| `message:quoted` | `{ conversationId, message, quotedMessageId }` | Message quoted |
| `message:reaction` | `{ messageId, reaction }` | Reaction added |
| `message:reaction:remove` | `{ messageId, userId, emoji }` | Reaction removed |
| `message:reactions:clear` | `{ messageId, userId }` | All reactions cleared |
| `conversation:created` | `{ conversation, systemMessage }` | Group created |
| `conversation:members_added` | `{ conversationId, newMembers, addedBy }` | Members added |
| `conversation:member_removed` | `{ conversationId, removedUserId, removedBy }` | Member removed |
| `conversation:updated` | `{ conversationId, data }` | Conversation updated |
| `conversation:pin_toggled` | `{ conversationId, pinnedBy, pinned }` | Pin state changed |
| `conversation:archived_toggled` | `{ conversationId, userId, archived }` | Archive state changed |
| `conversation:mute_changed` | `{ conversationId, userId, mutedBy, muted, muteUntil?, duration? }` | Mute state changed |
| `group:member_left` | `{ conversationId, leftUserId, leftBy }` | Member left |
| `group:dissolved` | `{ conversationId, dissolvedBy }` | Group dissolved |
| `group:renamed` | `{ conversationId, newName, renamedBy }` | Group renamed |
| `group:avatar_changed` | `{ conversationId, avatarUrl, changedBy }` | Avatar changed |
| `group:admin_changed` | `{ conversationId, targetUserId, isAdmin, changedBy }` | Admin status changed |
| `group:owner_transferred` | `{ conversationId, oldOwnerId, newOwnerId }` | Ownership transferred |
| `group:member_approved` | `{ conversationId, userId, member, approvedBy }` | Member approved |
| `group:member_rejected` | `{ conversationId, userId, rejectedBy }` | Member rejected |
| `group:settings_updated` | `{ conversationId, settings }` | Settings updated |
| `poll:new` | `{ conversationId, poll, createdBy }` | Poll created |
| `poll:vote` | `{ conversationId, pollId, poll, votedBy }` | Poll voted |
| `typing:start` | `{ userId, toUserId? }` or `{ userId, groupId }` | User started typing |
| `typing:stop` | `{ userId, toUserId? }` or `{ userId, groupId }` | User stopped typing |
| `messageSeen` | `{ conversationId, userId, lastSeenMessageId }` | Messages marked seen |
| `messageDelivered` | `{ conversationId, userId, lastDeliveredMessageId }` | Messages marked delivered |
| `online_status` | `{ userId, isOnline }` | User online status |
| `user_presence` | `{ userId, lastSeen }` | User presence update |
| `message:reaction_summary` | `{ messageId, summary }` | Reaction summary |
| `message:recall` | `{ messageId, recallBy }` | Message recalled |
| `message:edit_start` | `{ messageId, userId }` | User started editing |
| `message:edit_end` | `{ messageId, userId }` | User ended editing |
| `voice_message` | `{ conversationId, message }` | Voice message |
| `location_share` | `{ conversationId, userId, location }` | Location shared |
| `user:online` | `{ userId, socketId, timestamp }` | User connected |
| `user:offline` | `{ userId, timestamp, reason }` | User disconnected |
| `connected` | Connection confirmation with heartbeat config | Server confirmation |
| `pong` | `{ timestamp, serverTime, latency }` | Heartbeat response |
