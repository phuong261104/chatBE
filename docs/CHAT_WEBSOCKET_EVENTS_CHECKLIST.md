# WebSocket Events — Chat
## Source: `src/modules/chat/infras/transport/socket-service.ts`
## Namespace: `/messages`
## Giải thích trạng thái: ✅ = Có handler + emit đầy đủ | ⚠️ = Có emit/nofify nhưng KHÔNG có socket.on handler phía server | ❌ = Chưa có

---

## 1. Client Emit (Frontend → Backend)

| # | Event | Payload | Handler | Trạng thái |
|---|-------|---------|---------|-----------|
| 1 | `joinGroup` | `{ conversationId }` | `handleJoinGroup` | ✅ |
| 2 | `leaveGroup` | `{ conversationId }` | `handleLeaveGroup` | ✅ |
| 3 | `sendMessage` | `{ conversationId, text?, media?[] }` | `handleSendMessage` | ✅ |
| 4 | `editMessage` | `{ messageId, text }` | `handleEditMessage` | ✅ |
| 5 | `deleteMessage` | `{ messageId }` | `handleDeleteMessage` | ✅ ⚠️ |
| 6 | `deleteMessageForEveryone` | `{ messageId }` | `handleDeleteMessageForEveryone` | ✅ |
| 7 | `revokeMessage` | `{ messageId }` | `handleRevokeMessage` | ✅ |
| 8 | `addReaction` | `{ messageId, emoji }` | `handleAddReaction` | ✅ |
| 9 | `removeReaction` | `{ messageId, emoji? }` | `handleRemoveReaction` | ✅ |
| 10 | `messageSeen` | `{ conversationId, lastSeenMessageId }` | `handleMessageSeen` | ✅ |
| 11 | `messageDelivered` | `{ conversationId, lastDeliveredMessageId }` | `handleMessageDelivered` | ✅ |
| 12 | `typing:start` | `{ toUserId?, groupId? }` | `handleTypingStart` | ✅ |
| 13 | `typing:stop` | `{ toUserId?, groupId? }` | `handleTypingStop` | ✅ |
| 14 | `forwardMessages` | `{ messageIds[], targetConversationIds[] }` | `handleForwardMessages` | ✅ |
| 15 | `quoteMessage` | `{ conversationId, quotedMessageId, text?, media? }` | `handleQuoteMessage` | ✅ |
| 16 | `pinConversation` | `{ conversationId }` | `handlePinConversation` | ✅ |
| 17 | `unpinConversation` | `{ conversationId }` | `handleUnpinConversation` | ✅ |
| 18 | `archiveConversation` | `{ conversationId }` | `handleArchiveConversation` | ✅ |
| 19 | `unarchiveConversation` | `{ conversationId }` | `handleUnarchiveConversation` | ✅ |
| 20 | `muteConversation` | `{ conversationId, muteUntil?, duration? }` | `handleMuteConversation` | ✅ |
| 21 | `unmuteConversation` | `{ conversationId }` | `handleUnmuteConversation` | ✅ |
| 22 | `pinMessage` | `{ messageId }` | `handlePinMessage` | ✅ |
| 23 | `unpinMessage` | `{ messageId }` | `handleUnpinMessage` | ✅ |
| 24 | `addMembers` | `{ groupId, memberIds[] }` | `handleAddMembers` | ✅ |
| 25 | `removeMember` | `{ groupId, targetUserId }` | `handleRemoveMember` | ✅ |
| 26 | `setAdmin` | `{ groupId, targetUserId, isAdmin }` | `handleSetAdmin` | ✅ |
| 27 | `transferOwner` | `{ groupId, newOwnerId }` | `handleTransferOwner` | ✅ |
| 28 | `approveMember` | `{ groupId, userIdToApprove }` | `handleApproveMember` | ✅ |
| 29 | `rejectMember` | `{ groupId, userIdToReject }` | `handleRejectMember` | ✅ |
| 30 | `createPoll` | `{ conversationId, question, options[], isMultipleChoice, allowAddOption, expiresAt? }` | `handleCreatePoll` | ✅ |
| 31 | `votePoll` | `{ pollId, optionIds[] }` | `handleVotePoll` | ✅ |
| 32 | `voice_message` | `{ conversationId, mediaUrl, duration? }` | `handleVoiceMessage` | ✅ |
| 33 | `location_share` | `{ conversationId, latitude, longitude, accuracy? }` | `handleLocationShare` | ✅ |
| 34 | `dissolveGroup` | `{ groupId }` | `handleDissolveGroup` | ✅ |
| 35 | `subscribeConversation` | `{ conversationId }` | — | ❌ |
| 36 | `unsubscribeConversation` | `{ conversationId }` | — | ❌ |
| 37 | `getOnlineStatus` | `{ userId }` | — | ❌ |
| 38 | `getBatchOnlineStatus` | `{ userIds[] }` | — | ❌ |
| 39 | `ping` | — | — | ❌ |

**Tổng:** 39 emit events | ✅ 34 | ❌ 5 (events 35–39 chưa hiện thực)

---

## 2. Server Emit (Backend → Frontend)

| # | Event | Payload | Triggered By | Trạng thái |
|---|-------|---------|-------------|-----------|
| 1 | `receiveMessage` | `{ message, conversationId }` | `handleSendMessage` | ✅ |
| 2 | `message:edited` | `{ conversationId, message }` | `handleEditMessage` | ✅ |
| 3 | `message:deleted` | `{ conversationId, messageId, deletedBy }` | `handleDeleteMessage` | ✅ ⚠️ |
| 4 | `message:deleted_for_everyone` | `{ conversationId, messageId, deletedBy }` | `handleDeleteMessageForEveryone` | ✅ |
| 5 | `message:revoked` | `{ conversationId, messageId, revokedBy }` | `handleRevokeMessage` | ✅ |
| 6 | `message:pinned` | `{ conversationId, message }` | `handlePinMessage` | ✅ |
| 7 | `message:unpinned` | `{ conversationId, message }` | `handleUnpinMessage` | ✅ |
| 8 | `message:reaction` | `{ messageId, reaction }` | `handleAddReaction` | ✅ |
| 9 | `message:reaction:remove` | `{ messageId, userId, emoji? }` | `handleRemoveReaction` | ✅ |
| 10 | `message:reactions:clear` | `{ messageId, userId }` | `http-service.removeAllReactionsAPI` | ✅ |
| 11 | `typing:start` | `{ userId, toUserId? }` hoặc `{ userId, groupId? }` | `handleTypingStart` | ✅ |
| 12 | `typing:stop` | `{ userId, toUserId? }` hoặc `{ userId, groupId? }` | `handleTypingStop` | ✅ |
| 13 | `messageSeen` | `{ conversationId, userId, lastSeenMessageId }` | `handleMessageSeen` | ✅ |
| 14 | `messageDelivered` | `{ conversationId, userId, lastDeliveredMessageId }` | `handleMessageDelivered` | ✅ |
| 15 | `conversation:created` | `{ conversation, systemMessage }` | `http-service.createGroupAPI` | ✅ |
| 16 | `conversation:updated` | `{ conversationId, data }` | `notifyGroupUpdated` | ✅ |
| 17 | `conversation:members_added` | `{ conversationId, newMembers[] }` | `handleAddMembers` | ✅ |
| 18 | `conversation:member_removed` | `{ conversationId, removedUserId }` | `handleRemoveMember` | ✅ |
| 19 | `conversation:pin_toggled` | `{ conversationId, pinnedBy, pinned }` | `handlePinConversation`, `handleUnpinConversation` | ✅ |
| 20 | `conversation:mute_changed` | `{ conversationId, muted, muteUntil? }` | `handleMuteConversation`, `handleUnmuteConversation` | ✅ |
| 21 | `conversation:archived_toggled` | `{ conversationId, userId, archived }` | `handleArchiveConversation`, `handleUnarchiveConversation` | ✅ |
| 22 | `group:member_left` | `{ conversationId, leftUserId, leftBy }` | `handleLeaveGroup`, `handleRemoveMember` | ✅ |
| 23 | `group:dissolved` | `{ conversationId, dissolvedBy }` | `handleDissolveGroup` | ✅ |
| 24 | `group:renamed` | `{ conversationId, newName, renamedBy }` | `http-service.updateGroupAPI` | ✅ |
| 25 | `group:avatar_changed` | `{ conversationId, avatarUrl, changedBy }` | `http-service.updateGroupAPI` | ✅ |
| 26 | `group:admin_changed` | `{ conversationId, targetUserId, isAdmin }` | `handleSetAdmin` | ✅ |
| 27 | `group:owner_transferred` | `{ conversationId, oldOwnerId, newOwnerId }` | `handleTransferOwner` | ✅ |
| 28 | `group:member_approved` | `{ conversationId, userId, member }` | `handleApproveMember` | ✅ |
| 29 | `group:member_rejected` | `{ conversationId, userId }` | `handleRejectMember` | ✅ |
| 30 | `group:settings_updated` | `{ conversationId, settings }` | `http-service.updateGroupSettingsAPI` | ✅ |
| 31 | `poll:new` | `{ conversationId, poll, createdBy }` | `handleCreatePoll` | ✅ |
| 32 | `poll:vote` | `{ conversationId, pollId, poll, votedBy }` | `handleVotePoll` | ✅ |
| 33 | `online_status` | `{ userId, isOnline, lastSeen? }` | `notifyOnlineStatus` (public method) | ✅ |
| 34 | `user_presence` | `{ userId, lastSeen? }` | `notifyUserPresence` (public method) | ✅ |
| 35 | `message:quoted` | `{ conversationId, message, quotedMessageId }` | `handleQuoteMessage` | ✅ |
| 36 | `voice_message` | `{ conversationId, message }` | `handleVoiceMessage` | ✅ |
| 37 | `location_share` | `{ conversationId, userId, location }` | `handleLocationShare` | ✅ |

**Tổng:** 37 listen events | ✅ 37 (tất cả đều có emit từ backend)

---

## 3. Các Event Bổ Sung (Backend Có Sẵn Nhưng Không Trong Bảng Gốc)

| # | Event | Hướng | Payload | Ghi chú |
|---|-------|-------|---------|---------|
| S1 | `group:member_joined` | Server → Client | `{ conversationId, userId, member }` | ⚠️ Có `notifyNewGroup` emit `conversation:created` nhưng KHÔNG có event `group:member_joined` riêng. Thay thế bằng `conversation:created` khi thêm thành viên mới |
| S2 | `poll:closed` | Server → Client | `{ conversationId, pollId }` | ⚠️ Có khai báo constant `SocketEvent.POLL_CLOSED` nhưng KHÔNG có handler emit. Cần hook vào logic đóng poll hết hạn |
| S3 | `message:reaction_summary` | Server → Client | `{ messageId, summary }` | ⚠️ Có `notifyReactionSummary` (public method) nhưng KHÔNG có handler trigger tự động |
| S4 | `message:recall` | Server → Client | `{ conversationId, messageId, recallBy }` | ⚠️ Có `notifyMessageRecall` (public method) nhưng KHÔNG có handler trigger tự động |
| S5 | `message:edit_start` | Server → Client | `{ conversationId, messageId, userId }` | ⚠️ Có `notifyEditStart` (public method) nhưng KHÔNG có handler trigger tự động |
| S6 | `message:edit_end` | Server → Client | `{ conversationId, messageId, userId }` | ⚠️ Có `notifyEditEnd` (public method) nhưng KHÔNG có handler trigger tự động |
| S7 | `message:reaction_summary` | Server → Client | `{ messageId, summary }` | ⚠️ Giống S3 |
| S8 | `markAllSeen` | Client → Server | `{ conversationId }` | ✅ Có `handleMarkAllSeen` (bonus, không trong bảng gốc) |

---

## 4. Chi Tiết Các Event Cần Frontend Hiện Thực

### 4.1 Event Client Emit — Cần hiện thực ở Frontend (39 events)

> **Tất cả 39 events đều đã được backend xử lý.** Frontend chỉ cần emit đúng payload.

#### Event 1–14: Tin nhắn cơ bản

```typescript
// 1. joinGroup — Tham gia room hội thoại
socket.emit("joinGroup", { conversationId: "conv_xxx" }, (res) => {
  // res: { success: boolean, message?: string, error?: string }
});

// 2. leaveGroup — Rời room hội thoại
socket.emit("leaveGroup", { conversationId: "conv_xxx" }, (res) => {
  // res: { success: boolean, error?: string }
});

// 3. sendMessage — Gửi tin nhắn
socket.emit("sendMessage", {
  conversationId: "conv_xxx",
  text: "Xin chào!",
  media: [
    {
      url: "https://cdn.example.com/img.jpg",
      filename: "photo.jpg",
      mimetype: "image/jpeg",
      size: 102400,
      width: 1920,
      height: 1080,
    },
  ],
}, (res) => {
  // res: { success: boolean, messages?: Message[], error?: string }
});

// 4. editMessage — Sửa tin nhắn
socket.emit("editMessage", {
  messageId: "msg_xxx",
  text: "Nội dung đã sửa",
}, (res) => {
  // res: { success: boolean, message?: Message, error?: string }
});

// 5. deleteMessage — Xóa tin nhắn cho mình
socket.emit("deleteMessage", { messageId: "msg_xxx" }, (res) => {
  // res: { success: boolean, error?: string }
});

// 6. deleteMessageForEveryone — Xóa tin nhắn cho mọi người
socket.emit("deleteMessageForEveryone", { messageId: "msg_xxx" }, (res) => {
  // res: { success: boolean, message?: Message, error?: string }
});

// 7. revokeMessage — Thu hồi tin nhắn
socket.emit("revokeMessage", { messageId: "msg_xxx" }, (res) => {
  // res: { success: boolean, message?: Message, error?: string }
});

// 8. addReaction — Thêm reaction
socket.emit("addReaction", {
  messageId: "msg_xxx",
  emoji: "👍",
}, (res) => {
  // res: { success: boolean, reaction?: MessageReaction, error?: string }
});

// 9. removeReaction — Gỡ reaction
socket.emit("removeReaction", {
  messageId: "msg_xxx",
  emoji: "👍", // optional, không truyền = gỡ tất cả reaction của mình
}, (res) => {
  // res: { success: boolean, deletedCount?: number, error?: string }
});

// 10. messageSeen — Đánh dấu đã xem
socket.emit("messageSeen", {
  conversationId: "conv_xxx",
  lastSeenMessageId: "msg_xxx",
}, (res) => {
  // res: { success: boolean, error?: string }
});

// 11. messageDelivered — Đánh dấu đã giao
socket.emit("messageDelivered", {
  conversationId: "conv_xxx",
  lastDeliveredMessageId: "msg_xxx",
}, (res) => {
  // res: { success: boolean, error?: string }
});

// 12. typing:start — Bắt đầu gõ
socket.emit("typing:start", {
  toUserId: "user_xxx",    // cho chat riêng
  // groupId: "conv_xxx",  // cho group
});

// 13. typing:stop — Ngừng gõ
socket.emit("typing:stop", {
  toUserId: "user_xxx",
  // groupId: "conv_xxx",
});

// 14. forwardMessages — Chuyển tiếp tin nhắn
socket.emit("forwardMessages", {
  messageIds: ["msg_a", "msg_b"],
  targetConversationIds: ["conv_1", "conv_2"],
}, (res) => {
  // res: { success: boolean, messages?: Message[], error?: string }
});
```

#### Event 15–21: Hội thoại (pin, archive, mute)

```typescript
// 15. quoteMessage — Trích dẫn tin nhắn
socket.emit("quoteMessage", {
  conversationId: "conv_xxx",
  quotedMessageId: "msg_yyy",
  text: "Tôi đồng ý!",
  media: [], // optional
}, (res) => {
  // res: { success: boolean, message?: Message, error?: string }
});

// 16. pinConversation — Ghim hội thoại
socket.emit("pinConversation", { conversationId: "conv_xxx" }, (res) => {
  // res: { success: boolean, error?: string }
});

// 17. unpinConversation — Bỏ ghim hội thoại
socket.emit("unpinConversation", { conversationId: "conv_xxx" }, (res) => {
  // res: { success: boolean, error?: string }
});

// 18. archiveConversation — Lưu trữ hội thoại
socket.emit("archiveConversation", { conversationId: "conv_xxx" }, (res) => {
  // res: { success: boolean, error?: string }
});

// 19. unarchiveConversation — Bỏ lưu trữ
socket.emit("unarchiveConversation", { conversationId: "conv_xxx" }, (res) => {
  // res: { success: boolean, error?: string }
});

// 20. muteConversation — Tắt thông báo
socket.emit("muteConversation", {
  conversationId: "conv_xxx",
  muteUntil: "2024-01-20T00:00:00Z", // optional
  duration: 3600,                     // optional, giây
}, (res) => {
  // res: { success: boolean, error?: string }
});

// 21. unmuteConversation — Bật thông báo
socket.emit("unmuteConversation", { conversationId: "conv_xxx" }, (res) => {
  // res: { success: boolean, error?: string }
});
```

#### Event 22–33: Tin nhắn đặc biệt & Nhóm

```typescript
// 22. pinMessage — Ghim tin nhắn
socket.emit("pinMessage", { messageId: "msg_xxx" }, (res) => {
  // res: { success: boolean, message?: Message, error?: string }
});

// 23. unpinMessage — Bỏ ghim tin nhắn
socket.emit("unpinMessage", { messageId: "msg_xxx" }, (res) => {
  // res: { success: boolean, message?: Message, error?: string }
});

// 24. addMembers — Thêm thành viên
socket.emit("addMembers", {
  groupId: "conv_xxx",
  memberIds: ["user_a", "user_b"],
}, (res) => {
  // res: { success: boolean, newMembers?: ConversationMember[], error?: string }
});

// 25. removeMember — Xóa thành viên
socket.emit("removeMember", {
  groupId: "conv_xxx",
  targetUserId: "user_yyy",
}, (res) => {
  // res: { success: boolean, error?: string }
});

// 26. setAdmin — Đặt admin
socket.emit("setAdmin", {
  groupId: "conv_xxx",
  targetUserId: "user_yyy",
  isAdmin: true,
}, (res) => {
  // res: { success: boolean, error?: string }
});

// 27. transferOwner — Chuyển quyền trưởng nhóm
socket.emit("transferOwner", {
  groupId: "conv_xxx",
  newOwnerId: "user_yyy",
}, (res) => {
  // res: { success: boolean, error?: string }
});

// 28. approveMember — Duyệt thành viên
socket.emit("approveMember", {
  groupId: "conv_xxx",
  userIdToApprove: "user_yyy",
}, (res) => {
  // res: { success: boolean, member?: ConversationMember, error?: string }
});

// 29. rejectMember — Từ chối thành viên
socket.emit("rejectMember", {
  groupId: "conv_xxx",
  userIdToReject: "user_yyy",
}, (res) => {
  // res: { success: boolean, error?: string }
});

// 30. createPoll — Tạo poll
socket.emit("createPoll", {
  conversationId: "conv_xxx",
  question: "Chọn ngày họp?",
  options: ["Thứ 2", "Thứ 3", "Thứ 4"],
  isMultipleChoice: false,
  allowAddOption: true,
  expiresAt: "2024-01-20T10:00:00Z", // optional
}, (res) => {
  // res: { success: boolean, poll?: Poll, error?: string }
});

// 31. votePoll — Bỏ phiếu
socket.emit("votePoll", {
  pollId: "poll_xxx",
  optionIds: ["opt_001"], // hoặc ["opt_001", "opt_002"] nếu isMultipleChoice
}, (res) => {
  // res: { success: boolean, poll?: Poll, error?: string }
});

// 32. voice_message — Gửi tin nhắn giọng nói
socket.emit("voice_message", {
  conversationId: "conv_xxx",
  mediaUrl: "https://cdn.example.com/voice.ogg",
  duration: 15, // giây, optional
}, (res) => {
  // res: { success: boolean, messages?: Message[], error?: string }
});

// 33. location_share — Chia sẻ vị trí
socket.emit("location_share", {
  conversationId: "conv_xxx",
  latitude: 10.762622,
  longitude: 106.660172,
  accuracy: 10, // mét, optional
}, (res) => {
  // res: { success: boolean, error?: string }
});

// 34. dissolveGroup — Giải tán nhóm
socket.emit("dissolveGroup", { groupId: "conv_xxx" }, (res) => {
  // res: { success: boolean, error?: string }
});
```

#### Event 35–39: Subscription & Status — CHƯA CÓ BACKEND

```typescript
// 35. subscribeConversation — Subscribe realtime ⚠️ BACKEND CHƯA CÓ HANDLER
socket.emit("subscribeConversation", { conversationId: "conv_xxx" }, (res) => {
  // res: { success: boolean, room?: string, timestamp?: number, error?: string }
  // Hiện tại: dùng joinGroup thay thế (joinGroup đã tự join vào group room)
});

// 36. unsubscribeConversation — Unsubscribe ⚠️ BACKEND CHƯA CÓ HANDLER
socket.emit("unsubscribeConversation", { conversationId: "conv_xxx" }, (res) => {
  // res: { success: boolean, error?: string }
  // Hiện tại: dùng leaveGroup thay thế
});

// 37. getOnlineStatus — Lấy trạng thái online 1 user ⚠️ BACKEND CHƯA CÓ HANDLER
socket.emit("getOnlineStatus", { userId: "user_xxx" }, (res) => {
  // res: { userId: string, online: boolean, connectionCount?: number, timestamp?: number, error?: string }
});

// 38. getBatchOnlineStatus — Lấy trạng thái online nhiều user ⚠️ BACKEND CHƯA CÓ HANDLER
socket.emit("getBatchOnlineStatus", { userIds: ["user_a", "user_b"] }, (res) => {
  // res: { statuses: Array<{ userId: string, online: boolean, connectionCount?: number }>, timestamp?: number, error?: string }
});

// 39. ping — Heartbeat ⚠️ BACKEND CHƯA CÓ HANDLER
socket.emit("ping", {}, (res) => {
  // res: { timestamp: number, serverTime: number, latency: number }
});
```

### 4.2 Event Server Emit — Frontend Cần Listen (37 events)

```typescript
// ============================================================
// CONNECTION EVENTS
// ============================================================

// Khi kết nối thành công
socket.on("connected", (data: {
  socketId: string;
  userId: string;
  connectionState: "connected";
  timestamp: number;
  activeConnections: number;
  heartbeatConfig: { interval: number; timeout: number };
}) => {});

// User online
socket.on("user:online", (data: {
  userId: string;
  socketId: string;
  timestamp: number;
}) => {});

// User offline
socket.on("user:offline", (data: {
  userId: string;
  timestamp: number;
  reason: string;
}) => {});

// Pong response từ heartbeat
socket.on("pong", (data: {
  timestamp: number;
  serverTime: number;
  latency: number;
}) => {});

// ============================================================
// MESSAGE EVENTS
// ============================================================

// 1. Tin nhắn mới
socket.on("receiveMessage", (data: {
  message: Message;
  conversationId: string;
}) => {});

// 2. Tin nhắn đã sửa
socket.on("message:edited", (data: {
  conversationId: string;
  message: Message;
}) => {});

// 3. Xóa tin nhắn cho mình
socket.on("message:deleted", (data: {
  conversationId: string;
  messageId: string;
  deletedBy: string;
}) => {});

// 4. Xóa tin nhắn cho mọi người
socket.on("message:deleted_for_everyone", (data: {
  conversationId: string;
  messageId: string;
  deletedBy: string;
}) => {});

// 5. Thu hồi tin nhắn
socket.on("message:revoked", (data: {
  conversationId: string;
  messageId: string;
  revokedBy: string;
}) => {});

// 6. Ghim tin nhắn
socket.on("message:pinned", (data: {
  conversationId: string;
  message: Message;
}) => {});

// 7. Bỏ ghim tin nhắn
socket.on("message:unpinned", (data: {
  conversationId: string;
  message: Message;
}) => {});

// 8. Reaction mới
socket.on("message:reaction", (data: {
  messageId: string;
  reaction: MessageReaction;
}) => {});

// 9. Gỡ reaction
socket.on("message:reaction:remove", (data: {
  messageId: string;
  userId: string;
  emoji?: string;
}) => {});

// 10. Xóa tất cả reactions
socket.on("message:reactions:clear", (data: {
  messageId: string;
  userId: string;
}) => {});

// 35. Trích dẫn tin nhắn
socket.on("message:quoted", (data: {
  conversationId: string;
  message: Message;
  quotedMessageId: string;
}) => {});

// 36. Voice message
socket.on("voice_message", (data: {
  conversationId: string;
  message: Message;
}) => {});

// 37. Chia sẻ vị trí
socket.on("location_share", (data: {
  conversationId: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}) => {});

// ============================================================
// CONVERSATION EVENTS
// ============================================================

// 15. Hội thoại mới được tạo
socket.on("conversation:created", (data: {
  conversation: Conversation;
  systemMessage?: Message;
}) => {});

// 16. Cập nhật hội thoại
socket.on("conversation:updated", (data: {
  conversationId: string;
  data: Partial<Conversation>;
}) => {});

// 17. Thêm thành viên
socket.on("conversation:members_added", (data: {
  conversationId: string;
  newMembers: ConversationMember[];
  addedBy: string;
}) => {});

// 18. Xóa thành viên
socket.on("conversation:member_removed", (data: {
  conversationId: string;
  removedUserId: string;
  removedBy: string;
}) => {});

// 19. Ghim/Bỏ ghim hội thoại
socket.on("conversation:pin_toggled", (data: {
  conversationId: string;
  pinnedBy: string;
  pinned: boolean;
}) => {});

// 20. Thay đổi mute
socket.on("conversation:mute_changed", (data: {
  conversationId: string;
  userId: string;
  mutedBy: string;
  muted: boolean;
  muteUntil?: string;
  duration?: number;
}) => {});

// 21. Lưu trữ/Bỏ lưu trữ
socket.on("conversation:archived_toggled", (data: {
  conversationId: string;
  userId: string;
  archived: boolean;
}) => {});

// ============================================================
// GROUP EVENTS
// ============================================================

// 22. Rời nhóm
socket.on("group:member_left", (data: {
  conversationId: string;
  leftUserId: string;
  leftBy: string;
}) => {});

// 23. Giải tán nhóm
socket.on("group:dissolved", (data: {
  conversationId: string;
  dissolvedBy: string;
}) => {});

// 24. Đổi tên nhóm
socket.on("group:renamed", (data: {
  conversationId: string;
  newName: string;
  renamedBy: string;
}) => {});

// 25. Đổi avatar nhóm
socket.on("group:avatar_changed", (data: {
  conversationId: string;
  avatarUrl: string;
  changedBy: string;
}) => {});

// 26. Thay đổi admin
socket.on("group:admin_changed", (data: {
  conversationId: string;
  targetUserId: string;
  isAdmin: boolean;
  changedBy: string;
}) => {});

// 27. Chuyển quyền
socket.on("group:owner_transferred", (data: {
  conversationId: string;
  oldOwnerId: string;
  newOwnerId: string;
}) => {});

// 28. Duyệt thành viên
socket.on("group:member_approved", (data: {
  conversationId: string;
  userId: string;
  member: ConversationMember;
  approvedBy: string;
}) => {});

// 29. Từ chối thành viên
socket.on("group:member_rejected", (data: {
  conversationId: string;
  userId: string;
  rejectedBy: string;
}) => {});

// 30. Cập nhật cài đặt nhóm
socket.on("group:settings_updated", (data: {
  conversationId: string;
  settings: GroupSettings;
}) => {});

// ============================================================
// TYPING EVENTS
// ============================================================

// 11. Bắt đầu gõ
socket.on("typing:start", (data: {
  userId: string;
  toUserId?: string;  // cho chat riêng
  groupId?: string;   // cho group
}) => {});

// 12. Ngừng gõ
socket.on("typing:stop", (data: {
  userId: string;
  toUserId?: string;
  groupId?: string;
}) => {});

// ============================================================
// READ RECEIPT EVENTS
// ============================================================

// 13. Đã xem
socket.on("messageSeen", (data: {
  conversationId: string;
  userId: string;
  lastSeenMessageId: string;
}) => {});

// 14. Đã giao
socket.on("messageDelivered", (data: {
  conversationId: string;
  userId: string;
  lastDeliveredMessageId: string;
}) => {});

// ============================================================
// POLL EVENTS
// ============================================================

// 31. Poll mới
socket.on("poll:new", (data: {
  conversationId: string;
  poll: Poll;
  createdBy: string;
}) => {});

// 32. Bỏ phiếu
socket.on("poll:vote", (data: {
  conversationId: string;
  pollId: string;
  poll: Poll;
  votedBy: string;
}) => {});

// ============================================================
// ONLINE STATUS / PRESENCE EVENTS
// ============================================================

// 33. Trạng thái online
socket.on("online_status", (data: {
  userId: string;
  isOnline: boolean;
  lastSeen?: string;
}) => {});

// 34. Presence offline
socket.on("user_presence", (data: {
  userId: string;
  lastSeen?: string;
}) => {});
```

---

## 5. Lưu Ý Quan Trọng Cho Frontend

### 5.1 Bug tiềm ẩn: `message:deleted` chỉ emit cho người xóa

Trong `handleDeleteMessage` (socket-service.ts:563–606), event `message:deleted` chỉ emit cho chính user đã xóa:

```typescript
// ❌ HIỆN TẠI (chỉ emit cho người xóa):
this.emitToUser(userId, SocketEvent.MESSAGE_DELETED, { ... });

// ✅ NÊN SỬA (broadcast cho toàn bộ conversation):
this.emitToGroupRoom(message.conversationId, SocketEvent.MESSAGE_DELETED, { ... });
```

Frontend nên lưu ý: event `message:deleted` hiện tại **chỉ nhận được khi chính mình xóa**. Các user khác trong cuộc trò chuyện không nhận được thông báo này.

### 5.2 Events 35–39: Chưa có backend handler

Frontend cần biết 5 events sau **chưa được backend xử lý**:

| Event | Giải pháp tạm thời |
|-------|---------------------|
| `subscribeConversation` | Dùng `joinGroup` thay thế (đã tự join room) |
| `unsubscribeConversation` | Dùng `leaveGroup` thay thế |
| `getOnlineStatus` | Chưa có — dùng REST `GET /conversations/:id/members/online` |
| `getBatchOnlineStatus` | Chưa có — vòng lặp qua REST trên |
| `ping` | Chưa có — dùng heartbeat mặc định của Socket.IO |

### 5.3 Các Public Method trên SocketService (dùng từ gateway/entry)

Backend có các public method để gateway gọi emit manual:

```typescript
// Trong MessagingSocketService:
notifyOnlineStatus(userId, isOnline)
notifyUserPresence(userId, lastSeen)
notifyReactionSummary(conversationId, messageId, summary)
notifyMessageRecall(conversationId, messageId, recallBy)
notifyEditStart(conversationId, messageId, userId)
notifyEditEnd(conversationId, messageId, userId)
notifyVoiceMessage(conversationId, message)
notifyLocationShare(conversationId, userId, location)
```

### 5.4 Room Naming Convention

Backend sử dụng 2 loại room:

| Room | Mục đích | Cách tham gia |
|------|---------|---------------|
| `user:{userId}` | Nhận tin nhắn cá nhân | Tự động khi connect |
| `group:{conversationId}` / `group_room:{conversationId}` | Nhận tin nhắn nhóm | `joinGroup` |

### 5.5 Rate Limiting

Backend có rate limit cho một số event (60s window):

| Event | Limit |
|-------|-------|
| `sendMessage` | 60 lần/phút |
| `typing:start` | 30 lần/phút |
| `addReaction` | 60 lần/phút |
| `editMessage` | 30 lần/phút |
| `deleteMessage` | 30 lần/phút |
| `forwardMessages` | 30 lần/phút |
| `quoteMessage` | 60 lần/phút |

Frontend nên xử lý response `{ success: false, error: "Rate limit exceeded..." }`.

---

## 6. Tóm Tắt

### Client Emit (Frontend → Backend)
- **Đã đủ:** 34/39 events ✅
- **Thiếu:** 5/39 events ❌ (35–39: subscribe/unsubscribe, getOnlineStatus, getBatchOnlineStatus, ping)

### Server Emit (Backend → Frontend)
- **Đã đủ:** 37/37 events ✅ (tất cả đều có emit)

### Cần lưu ý
- ⚠️ `message:deleted` chỉ emit cho người thực hiện (bug tiềm ẩn)
- ⚠️ 5 events subscription/status chưa có backend handler
- ⚠️ 6 events bổ sung có public method nhưng chưa có trigger tự động (poll:closed, message:recall, message:edit_start/end, message:reaction_summary)
