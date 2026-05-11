# Socket.IO Reference — Friend & Block Namespaces

Tài liệu này mô tả chi tiết các Namespace, Events và Payloads cho hệ thống **Friends** và **Blocks**, giúp Frontend tích hợp dễ dàng.

---

## Mục lục

1. [Namespace `/friends`](#1-namespace-friends)
   - [Kết nối và xác thực](#11-kết-nối-và-xác-thực)
   - [Server → Client Events](#12-server--client-events)
   - [Client → Server Events](#13-client--server-events)
2. [Namespace `/blocks`](#2-namespace-blocks)
   - [Kết nối và xác thực](#21-kết-nối-và-xác-thực)
   - [Server → Client Events](#22-server--client-events)
   - [Client → Server Events](#23-client--server-events)
3. [Ví dụ Code đầy đủ](#3-ví-dụ-code-đầy-đủ)

---

## 1. Namespace `/friends`

### 1.1 Kết nối và xác thực

```javascript
import { io } from "socket.io-client";

const friendsSocket = io("YOUR_SERVER_URL/friends", {
  auth: {
    token: "YOUR_JWT_TOKEN"
  },
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

friendsSocket.on("connect", () => {
  console.log("Đã kết nối namespace /friends");
});

friendsSocket.on("disconnect", (reason) => {
  console.log("Mất kết nối:", reason);
});

friendsSocket.on("connect_error", (error) => {
  console.error("Lỗi kết nối:", error.message);
});
```

**Quy tắc xác thực:**

- JWT Token phải được truyền trong `auth.token` khi kết nối
- Token được giải mã để lấy `userId` từ claim `sub`
- Nếu token hết hạn hoặc không hợp lệ, connection sẽ bị reject

---

### 1.2 Server → Client Events

#### 1. `friend_request:received` — Nhận lời mời kết bạn

**Khi nào nhận được:**
- Khi có người gửi lời mời kết bạn đến user hiện tại

**Payload:**
```typescript
{
  type: "FRIEND_REQUEST_RECEIVED";
  data: {
    requestId: string;    // ID của lời mời kết bạn
    fromUserId: string;  // ID người gửi lời mời
    toUserId: string;    // ID người nhận (= user hiện tại)
  };
  timestamp: Date;
}
```

**Ví dụ:**
```javascript
friendsSocket.on("friend_request:received", (payload) => {
  console.log("Nhận lời mời kết bạn từ:", payload.data.fromUserId);
  console.log("Request ID:", payload.data.requestId);
  console.log("Thời gian:", payload.timestamp);
});
```

---

#### 2. `friend_request:accepted` — Lời mời được chấp nhận

**Khi nào nhận được:**
- Khi lời mời kết bạn mà user gửi được người nhận chấp nhận

**Payload:**
```typescript
{
  type: "FRIEND_REQUEST_ACCEPTED";
  data: {
    requestId: string;    // ID của lời mời kết bạn
    acceptedBy: string;   // ID người chấp nhận
    fromUserId: string;   // ID người gửi lời mời
    toUserId: string;     // ID người nhận lời mời
  };
  timestamp: Date;
}
```

**Ví dụ:**
```javascript
friendsSocket.on("friend_request:accepted", (payload) => {
  console.log("Lời mời kết bạn đã được chấp nhận bởi:", payload.data.acceptedBy);
  console.log("Từ user:", payload.data.fromUserId);
});
```

---

#### 3. `friend_request:rejected` — Lời mời bị từ chối

**Khi nào nhận được:**
- Khi lời mời kết bạn mà user gửi bị người nhận từ chối

**Payload:**
```typescript
{
  type: "FRIEND_REQUEST_REJECTED";
  data: {
    requestId: string;     // ID của lời mời kết bạn
    rejectedBy: string;    // ID người từ chối
    fromUserId: string;   // ID người gửi lời mời
    toUserId: string;      // ID người nhận lời mời
  };
  timestamp: Date;
}
```

**Ví dụ:**
```javascript
friendsSocket.on("friend_request:rejected", (payload) => {
  console.log("Lời mời kết bạn bị từ chối bởi:", payload.data.rejectedBy);
});
```

---

#### 4. `friend_request:canceled` — Lời mời bị thu hồi

**Khi nào nhận được:**
- Khi người gửi thu hồi lời mời kết bạn đã gửi cho user hiện tại

**Payload:**
```typescript
{
  type: "FRIEND_REQUEST_CANCELED";
  data: {
    requestId: string;    // ID của lời mời kết bạn
    canceledBy: string;   // ID người thu hồi
    fromUserId: string;   // ID người gửi lời mời
    toUserId: string;      // ID người nhận lời mời
  };
  timestamp: Date;
}
```

**Ví dụ:**
```javascript
friendsSocket.on("friend_request:canceled", (payload) => {
  console.log("Lời mời kết bạn đã bị thu hồi bởi:", payload.data.canceledBy);
});
```

---

#### 5. `friendship:unfriended` — Bị hủy kết bạn

**Khi nào nhận được:**
- Khi một người bạn hủy kết bạn với user hiện tại

**Payload:**
```typescript
{
  type: "UNFRIENDED";
  data: {
    unfriendedBy: string;  // ID người hủy kết bạn
  };
  timestamp: Date;
}
```

**Ví dụ:**
```javascript
friendsSocket.on("friendship:unfriended", (payload) => {
  console.log("Bạn đã bị hủy kết bạn bởi:", payload.data.unfriendedBy);
});
```

---

#### 6. `block:detected` — Phát hiện block

**Khi nào nhận được:**
- Khi user bị block hoặc bị ai đó block

**Payload:**
```typescript
{
  type: "BLOCK_DETECTED";
  data: {
    direction: "BLOCKING" | "BLOCKED_BY";
    blockedUserId?: string;  // ID người bị block (khi direction = "BLOCKING")
    blockerId?: string;     // ID người block (khi direction = "BLOCKED_BY")
  };
  timestamp: Date;
}
```

**Ví dụ:**
```javascript
friendsSocket.on("block:detected", (payload) => {
  if (payload.data.direction === "BLOCKING") {
    console.log("Bạn đã block:", payload.data.blockedUserId);
  } else {
    console.log("Bạn bị block bởi:", payload.data.blockerId);
  }
});
```

---

### 1.3 Client → Server Events

#### 1. `ping` — Heartbeat

**Mục đích:** Duy trì kết nối, phát hiện kết nối chết

**Payload:** Không cần payload

**Server response:** Server sẽ emit `pong` về cho client

**Ví dụ:**
```javascript
// Gửi ping mỗi 30 giây
setInterval(() => {
  friendsSocket.emit("ping");
}, 30000);

friendsSocket.on("pong", () => {
  console.log("Heartbeat OK");
});
```

---

## 2. Namespace `/blocks`

### 2.1 Kết nối và xác thực

```javascript
import { io } from "socket.io-client";

const blocksSocket = io("YOUR_SERVER_URL/blocks", {
  auth: {
    token: "YOUR_JWT_TOKEN"
  },
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

blocksSocket.on("connect", () => {
  console.log("Đã kết nối namespace /blocks");
});

blocksSocket.on("disconnect", (reason) => {
  console.log("Mất kết nối:", reason);
});

blocksSocket.on("connect_error", (error) => {
  console.error("Lỗi kết nối:", error.message);
});
```

**Quy tắc xác thực:**

- JWT Token phải được truyền trong `auth.token` khi kết nối
- Token được giải mã để lấy `userId` từ claim `sub`
- Nếu token hết hạn hoặc không hợp lệ, connection sẽ bị reject

---

### 2.2 Server → Client Events

#### 1. `block:blocked` — Bị ai đó chặn

**Khi nào nhận được:**
- Khi có người chặn (block) user hiện tại

**Payload:**
```typescript
{
  type: "USER_BLOCKED";
  data: {
    blockedBy: string;  // ID người đã chặn user hiện tại
  };
  timestamp: Date;
}
```

**Ví dụ:**
```javascript
blocksSocket.on("block:blocked", (payload) => {
  console.log("Bạn đã bị chặn bởi:", payload.data.blockedBy);
});
```

---

#### 2. `block:unblocked` — Được bỏ chặn

**Khi nào nhận được:**
- Khi người đã chặn user trước đó bỏ chặn (unblock) user hiện tại

**Payload:**
```typescript
{
  type: "USER_UNBLOCKED";
  data: {
    unblockedBy: string;  // ID người đã bỏ chặn user hiện tại
  };
  timestamp: Date;
}
```

**Ví dụ:**
```javascript
blocksSocket.on("block:unblocked", (payload) => {
  console.log("Bạn đã được bỏ chặn bởi:", payload.data.unblockedBy);
});
```

---

### 2.3 Client → Server Events

#### 1. `ping` — Heartbeat

**Mục đích:** Duy trì kết nối, phát hiện kết nối chết

**Payload:** Không cần payload

**Server response:** Server sẽ emit `pong` về cho client

**Ví dụ:**
```javascript
// Gửi ping mỗi 30 giây
setInterval(() => {
  blocksSocket.emit("ping");
}, 30000);

blocksSocket.on("pong", () => {
  console.log("Heartbeat OK");
});
```

---

## 3. Ví dụ Code đầy đủ

### 3.1 Friends Socket Service

```javascript
import { io } from "socket.io-client";

class FriendsSocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    this.socket = io("YOUR_SERVER_URL/friends", {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("Đã kết nối /friends");
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Mất kết nối /friends:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("Lỗi kết nối /friends:", error.message);
    });

    // Thiết lập heartbeat
    this.startHeartbeat();

    // Thiết lập listeners
    this.setupListeners();
  }

  setupListeners() {
    // Lời mời kết bạn
    this.socket.on("friend_request:received", (payload) => {
      console.log("Nhận lời mời kết bạn từ:", payload.data.fromUserId);
      // Cập nhật UI: hiển thị thông báo, badge, danh sách lời mời
    });

    // Lời mời được chấp nhận
    this.socket.on("friend_request:accepted", (payload) => {
      console.log("Lời mời được chấp nhận bởi:", payload.data.acceptedBy);
      // Cập nhật UI: thêm bạn mới vào danh sách, thông báo thành công
    });

    // Lời mời bị từ chối
    this.socket.on("friend_request:rejected", (payload) => {
      console.log("Lời mời bị từ chối bởi:", payload.data.rejectedBy);
      // Cập nhật UI: thông báo bị từ chối
    });

    // Lời mời bị thu hồi
    this.socket.on("friend_request:canceled", (payload) => {
      console.log("Lời mời bị thu hồi bởi:", payload.data.canceledBy);
      // Cập nhật UI: xóa lời mời khỏi danh sách
    });

    // Bị hủy kết bạn
    this.socket.on("friendship:unfriended", (payload) => {
      console.log("Bị hủy kết bạn bởi:", payload.data.unfriendedBy);
      // Cập nhật UI: xóa bạn khỏi danh sách, hiển thị thông báo
    });

    // Phát hiện block
    this.socket.on("block:detected", (payload) => {
      const { direction, blockedUserId, blockerId } = payload.data;
      if (direction === "BLOCKING") {
        console.log("Bạn đã block:", blockedUserId);
        // Cập nhật UI
      } else {
        console.log("Bạn bị block bởi:", blockerId);
        // Cập nhật UI: hiển thị thông báo bị block
      }
    });
  }

  startHeartbeat() {
    setInterval(() => {
      this.socket?.emit("ping");
    }, 30000);

    this.socket?.on("pong", () => {
      // Heartbeat OK
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

// Sử dụng
const friendsService = new FriendsSocketService();
friendsService.connect("jwt-token-here");
```

### 3.2 Blocks Socket Service

```javascript
import { io } from "socket.io-client";

class BlocksSocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    this.socket = io("YOUR_SERVER_URL/blocks", {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("Đã kết nối /blocks");
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Mất kết nối /blocks:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("Lỗi kết nối /blocks:", error.message);
    });

    this.startHeartbeat();
    this.setupListeners();
  }

  setupListeners() {
    // Bị chặn
    this.socket.on("block:blocked", (payload) => {
      console.log("Bạn đã bị chặn bởi:", payload.data.blockedBy);
      // Cập nhật UI: hiển thị thông báo, vô hiệu hóa tính năng nhắn tin với người này
    });

    // Được bỏ chặn
    this.socket.on("block:unblocked", (payload) => {
      console.log("Bạn đã được bỏ chặn bởi:", payload.data.unblockedBy);
      // Cập nhật UI: cho phép nhắn tin lại với người này
    });
  }

  startHeartbeat() {
    setInterval(() => {
      this.socket?.emit("ping");
    }, 30000);

    this.socket?.on("pong", () => {
      // Heartbeat OK
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

// Sử dụng
const blocksService = new BlocksSocketService();
blocksService.connect("jwt-token-here");
```

---

## Tóm tắt Events

### Namespace `/friends`

| # | Event | Direction | Mô tả |
|---|-------|-----------|--------|
| 1 | `friend_request:received` | Server → Client | Nhận lời mời kết bạn |
| 2 | `friend_request:accepted` | Server → Client | Lời mời được chấp nhận |
| 3 | `friend_request:rejected` | Server → Client | Lời mời bị từ chối |
| 4 | `friend_request:canceled` | Server → Client | Lời mời bị thu hồi |
| 5 | `friendship:unfriended` | Server → Client | Bị hủy kết bạn |
| 6 | `block:detected` | Server → Client | Phát hiện block |
| 7 | `ping` | Client → Server | Heartbeat |

### Namespace `/blocks`

| # | Event | Direction | Mô tả |
|---|-------|-----------|--------|
| 1 | `block:blocked` | Server → Client | Bị ai đó chặn |
| 2 | `block:unblocked` | Server → Client | Được bỏ chặn |
| 3 | `ping` | Client → Server | Heartbeat |
