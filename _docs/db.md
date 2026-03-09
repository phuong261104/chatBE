---
# 📦 Database Schema (MongoDB – MVP scalable design)
---

# 👤 USER DOMAIN

---

## 1️⃣ USERS

```js
{
  _id: ObjectId,

  // Identity
  email: String,                // unique, sparse
  phone: String,                // unique, sparse
  username: String,             // optional unique

  // Authentication
  password: String,
  salt: String,
  status: "active" | "disabled",
  verified: {
    email: Boolean,
    phone: Boolean
  },

  // Profile
  displayName: String,
  avatarUrl: String,
  bio: String,

  // Privacy
  privacy: {
    searchableByEmail: Boolean,
    searchableByPhone: Boolean,
    searchableByUsername: Boolean
  },

  // Preferences
  settings: {
    notifications: {
      push: Boolean,
      inApp: Boolean
    }
  },

  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 2️⃣ FRIEND_REQUESTS

```js
{
  _id: ObjectId,
  fromUserId: ObjectId,       // Ref: USERS
  toUserId: ObjectId,         // Ref: USERS

  status: "pending" | "accepted" | "rejected" | "canceled",

  createdAt: Date,
  respondedAt: Date
}
```

---

## 3️⃣ FRIENDSHIPS

> Mỗi cặp bạn bè chỉ có **1 record duy nhất**

```js
{
  _id: ObjectId,

  userA: ObjectId,      // min(userId1, userId2)
  userB: ObjectId,      // max(userId1, userId2)

  createdAt: Date
}
```

---

## 4️⃣ BLOCKS

```js
{
  _id: ObjectId,

  blockerId: ObjectId,      // Ref: USERS
  blockedUserId: ObjectId,  // Ref: USERS

  createdAt: Date
}
```

---

# 💬 CHAT CORE DOMAIN

---

## 5️⃣ CONVERSATIONS

> Chỉ lưu metadata + preview
> Không lưu members array để tránh document phình to

```js
{
  _id: ObjectId,

  type: "private" | "group",

  // Private conversation only
  pairKey: String,    // "minUserId:maxUserId" (unique when type=private)

  // Group info
  name: String,
  avatarUrl: String,
  createdBy: ObjectId,

  admins: [ObjectId],     // MVP acceptable (small array)
  membersCount: Number,

  // Preview (denormalized)
  lastMessage: {
    messageId: ObjectId,
    senderId: ObjectId,
    type: "text" | "image" | "file" | "system",
    textPreview: String,
    createdAt: Date
  },

  lastMessageAt: Date,

  createdAt: Date,
  updatedAt: Date
}
```

---

## 6️⃣ CONVERSATION_MEMBERS

> Thay thế:
>
> - members[]
> - USER_CONVERSATIONS
> - unread logic

```js
{
  _id: ObjectId,

  conversationId: ObjectId,   // Ref: CONVERSATIONS
  userId: ObjectId,           // Ref: USERS

  role: "member" | "admin",

  joinedAt: Date,
  leftAt: Date,               // null nếu còn trong group

  // Inbox state
  unreadCount: Number,
  lastReadMessageId: ObjectId,
  lastReadAt: Date,

  muteUntil: Date,            // null nếu không mute
  pinned: Boolean,
  archived: Boolean,

  updatedAt: Date
}
```

---

## 7️⃣ MESSAGES

> Append-only design
> Không dùng readBy[] để tránh scale issue

```js
{
  _id: ObjectId,

  conversationId: ObjectId,   // Ref: CONVERSATIONS
  senderId: ObjectId,         // Ref: USERS

  type: "text" | "image" | "file" | "system",

  text: String,

  media: [
    {
      url: String,
      mediaType: "image" | "file",
      name: String,
      size: Number,
      width: Number,
      height: Number
    }
  ],

  createdAt: Date,

  editedAt: Date,
  deletedAt: Date
}
```

---

# 🔗 Relationship Overview

| From                 | To            | Type        |
| -------------------- | ------------- | ----------- |
| FRIEND_REQUESTS      | USERS         | Many-to-One |
| FRIENDSHIPS          | USERS         | Many-to-One |
| BLOCKS               | USERS         | Many-to-One |
| CONVERSATION_MEMBERS | USERS         | Many-to-One |
| CONVERSATION_MEMBERS | CONVERSATIONS | Many-to-One |
| MESSAGES             | USERS         | Many-to-One |
| MESSAGES             | CONVERSATIONS | Many-to-One |

---

# 🎯 Điểm mạnh của thiết kế này

✔ Không có array phình to trong message
✔ Không có update contention trong conversation
✔ Inbox load nhanh bằng CONVERSATION_MEMBERS
✔ Private chat lookup O(1) bằng pairKey
✔ Scale tốt tới hàng triệu message
