# Tài liệu Socket.IO - Hệ thống Chat

Tài liệu này mô tả chi tiết về các Namespaces, Events và Payloads được sử dụng trong hệ thống Socket.IO của dự án để đội ngũ Frontend tích hợp.

## Mục lục
1. [Kết nối và Xác thực cơ bản](#1-kết-nối-và-xác-thực-cơ-bản)
2. [Namespace Mặc định (`/`)](#2-namespace-mặc-định-)
3. [Namespace Messaging (`/messages`)](#3-namespace-messaging-messages)
4. [Namespace Friends (`/friends`)](#4-namespace-friends-friends)

---

## 1. Kết nối và Xác thực cơ bản

Để kết nối với Socket.IO server, Frontend cần truyền token xác thực tại thời điểm kết nối ban đầu thông qua `handshake`.

**Cách truyền token:**
```javascript
const socket = io("YOUR_SERVER_URL", {
  path: "/socket.io", // Mặc định
  auth: {
    token: "YOUR_JWT_TOKEN" // Cung cấp access token tại đây
  },
  // Hoặc dùng query:
  // query: { token: "YOUR_JWT_TOKEN" }
});
```
*Lưu ý:* Việc xác thực này được áp dụng cho toàn bộ các connection kể cả đối với các custom namespace. Mỗi user sẽ được map tự động với `userId` được giải mã từ token.

---

## 2. Namespace Mặc định (`/`)

Sử dụng cho quản lý trạng thái trực tuyến (Online/Offline) của User.

- **Kết nối:** `io("YOUR_SERVER_URL")`

### Events (Client -> Server)

#### `heartbeat`
- **Mô tả:** Frontend gửi sự kiện này định kỳ (VD: mỗi 30s-1m) để báo cho server biết user này vẫn đang hoạt động.
- **Payload:** Không có

### Events (Server -> Client)

#### `user:online`
- **Mô tả:** Server phát đi thông báo khi có một user online (hoặc gửi ping qua heartbeat).
- **Payload:**
  ```typescript
  {
    userId: string;
  }
  ```

#### `user:offline`
- **Mô tả:** Server phát đi thông báo khi một user bị ngắt kết nối khỏi server và offline.
- **Payload:**
  ```typescript
  {
    userId: string;
  }
  ```

---

## 3. Namespace Messaging (`/messages`)

Sử dụng cho tất cả các tính năng liên quan đến chat, nhắn tin, quản lý nhóm và typing.

- **Kết nối:** `io("YOUR_SERVER_URL/messages")`

*Cơ chế Room:* Khi kết nối vào namespace này, connect của người dùng sẽ tự động join vào các room `user:{userId}` và `user_room:{userId}` để nhận message cá nhân.

### Events (Client -> Server)

#### `joinGroup`
- **Mô tả:** Client yêu cầu join vào socket room của một nhóm để bắt đầu nhận các sự kiện realtime của room đó (tin nhắn mới, update member, ...).
- **Payload:**
  ```typescript
  {
    conversationId: string;
  }
  ```
- **Sử dụng Callback (Acknowledgement):**
  ```javascript
  socket.emit("joinGroup", { conversationId: "id_nhom" }, (res) => {
    // res: { success: boolean, message?: string, error?: string }
  });
  ```

#### `leaveGroup`
- **Mô tả:** Client yêu cầu rời socket room của một nhóm hiện tại.
- **Payload:**
  ```typescript
  {
    conversationId: string;
  }
  ```
- **Callback tương tự như `joinGroup`.**

#### `messageSeen`
- **Mô tả:** Client báo cho server rằng user đã đọc các tin nhắn trong một cuộc trò chuyện tính tới `lastSeenMessageId`.
- **Payload:**
  ```typescript
  {
    conversationId: string;
    lastSeenMessageId: string;
  }
  ```
- **Callback để xác nhận:** `(res) => { success: boolean, error?: string }`

#### `messageDelivered`
- **Mô tả:** Client đánh dấu tin nhắn đã được giao thành công tới thiết bị.
- **Payload:**
  ```typescript
  {
    conversationId: string;
    lastDeliveredMessageId: string;
  }
  ```
- **Callback để xác nhận:** `(res) => { success: boolean, error?: string }`

#### `typing:start` & `typing:stop`
- **Mô tả:** Gửi đi khi người dùng bắt đầu/ngừng gõ phím.
- **Payload:** Truyền đúng `toUserId` Dành cho 1-1, TRÁNH truyền cùng lúc với `groupId` nếu chat nhóm.
  ```typescript
  {
    toUserId?: string; // Nếu chat cá nhân
    groupId?: string;  // Nếu chat nhóm
  }
  ```

### Events (Server -> Client)

#### Trạng thái nhắn tin (`messageSeen`, `messageDelivered`)
- Khi một user khác seen/nhận được tin nhắn, client sẽ nhận được các event tương ứng.
- **Payload:**
  ```typescript
  {
    conversationId: string;
    userId: string; // Tên user vừa seen/nhận
    lastSeenMessageId?: string; // Nếu là event messageSeen
    lastDeliveredMessageId?: string; // Nếu là event messageDelivered
  }
  ```

#### Sự kiện Typing (`typing:start`, `typing:stop`)
- Client nhận được khi người khác bắt đầu/ngừng gõ phím.
- **Payload:** Tương tự như tham số gửi đi, có kèm theo id của người đang gõ (`userId`).
  ```typescript
  {
    userId: string;
    toUserId?: string; // Nếu chat cá nhân
    groupId?: string;  // Nếu chat nhóm
  }
  ```

#### Các sự kiện Nhóm & Tính năng mở rộng
- `conversation:created`: Báo cho member khi bị thêm vào vào cuộc trò chuyện mới. Payload là toàn bộ dữ liệu của cuộc trò chuyện (Group Data).
- `conversation:members_added`: Có user mới được thêm vào. Payload: `{ conversationId: string, newMembers: any[] }`.
- `conversation:member_removed`: Có người bị xoá/rời nhóm. Payload: `{ conversationId: string, removedUserId: string }`.
- `conversation:updated`: Cập nhật thông tin hội thoại (tên, avatar...). Payload: `{ conversationId: string, data: any }`.
- `group:admin_changed`: Cập nhật quyền quản trị. Payload: `{ conversationId: string, targetUserId: string, isAdmin: boolean }`.
- `group:owner_transferred`: Chuyển quyền trưởng nhóm. Payload: `{ conversationId: string, oldOwnerId: string, newOwnerId: string }`.
- `group:member_approved`: Phe duyệt yêu cầu tham gia. Payload: `{ conversationId: string, userId: string, member: any }`.
- `group:member_rejected`: Báo bị từ chối vào nhóm. Payload: `{ conversationId: string, userId: string }`.
- `group:settings_updated`: Setting của nhóm thay đổi. Payload: `{ conversationId: string, settings: any }`.

#### Bầu chọn tham khảo (Polls)
- `poll:new`: Có bình chọn mới. Payload: `{ conversationId: string, poll: any }`.
- `poll:vote`: Có người thực hiện vote vào lượt bình chọn. Payload: `{ conversationId: string, pollId: string, userId: string, poll: any }`.

---

## 4. Namespace Friends (`/friends`)

Sử dụng để nhận các realtime notifications liên quan đến kết bạn và lời mời kết bạn (Friend Requests).

- **Kết nối:** `io("YOUR_SERVER_URL/friends")`

### Events (Client -> Server)

#### `ping`
- **Mô tả:** Client gửi để test trạng thái mạng
- **Action:** Server sẽ trả lại event `pong`.

### Events (Server -> Client)

Lưu ý chung: Tất cả Payload trả xuống từ namespace này đều được bọc trong một format Notification chuẩn:
```typescript
interface NotificationPayload {
  type: string;
  data: any;    // Dữ liệu chi tiết của Notification
  timestamp: string; // Thời gian xảy ra Date string
}
```

Các sự kiện bạn có thể lắng nghe:

1. `friend_request:received`: Gửi đến User nhận khi có người yêu cầu kết bạn. Type nội bộ: `FRIEND_REQUEST_RECEIVED`.
2. `friend_request:accepted`: Gửi khi yêu cầu kết bạn đã được phê duyệt. Type nội bộ: `FRIEND_REQUEST_ACCEPTED`.
3. `friend_request:rejected`: Gửi khi yêu cầu kết bạn bị từ chối (tuỳ policy hiển thị). Type nội bộ: `FRIEND_REQUEST_REJECTED`.
4. `friend_request:canceled`: Người gửi huỷ lời mời kết bạn. Type nội bộ: `FRIEND_REQUEST_CANCELED`.
5. `friendship:unfriended`: Bị huỷ kết bạn bởi user khác. Type nội bộ: `UNFRIENDED`.
