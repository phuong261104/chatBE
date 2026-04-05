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
  phone: String,                // unique, sparse (format: +?[0-9]{8,15})
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
  lastSeen: Date,
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
  respondedAt: Date           // optional
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
  pairKey: String,      // "minUserId:maxUserId" (unique when type=private)

  // Group info
  name: String,
  avatarUrl: String,
  createdBy: ObjectId,  // Ref: USERS
  ownerId: ObjectId,    // Ref: USERS
  admins: [ObjectId],   // MVP acceptable (small array)
  membersCount: Number,

  // Group settings
  settings: {
    allowSendLink: Boolean,       // default: true
    requireApproval: Boolean,     // default: false
    allowMemberInvite: Boolean    // default: true
  },

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

  conversationId: ObjectId,     // Ref: CONVERSATIONS
  userId: ObjectId,             // Ref: USERS

  role: "member" | "admin",
  status: "active" | "pending" | "rejected",  // default: active

  joinedAt: Date,
  leftAt: Date,                     // null nếu còn trong group

  // Inbox state
  unreadCount: Number,              // default: 0
  lastReadMessageId: ObjectId,
  lastReadAt: Date,
  lastSeenMessageId: ObjectId,
  lastDeliveredMessageId: ObjectId,

  muteUntil: Date,                  // null nếu không mute
  pinned: Boolean,                  // default: false
  archived: Boolean,                // default: false

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

  deletedForUserIds: [ObjectId],    // deleted chỉ với user cụ thể

  // Quote / Reply
  quotedMessageId: ObjectId,
  quotedMessagePreview: String,

  // Pin
  pinned: Boolean,                  // default: false
  pinnedAt: Date,

  createdAt: Date,
  editedAt: Date,
  deletedAt: Date
}
```

---

## 8️⃣ MESSAGE_REACTIONS

```js
{
  _id: ObjectId,

  messageId: ObjectId,    // Ref: MESSAGES
  userId: ObjectId,       // Ref: USERS
  emoji: String,
  count: Number,          // default: 1

  createdAt: Date
}
```

---

## 9️⃣ POLLS

```js
{
  _id: ObjectId,

  conversationId: ObjectId,   // Ref: CONVERSATIONS
  createdBy: ObjectId,        // Ref: USERS
  question: String,

  options: [
    {
      id: String,
      text: String,
      voteCount: Number,          // default: 0
      votedUserIds: [ObjectId]    // Ref: USERS
    }
  ],

  isMultipleChoice: Boolean,    // default: false
  allowAddOption: Boolean,      // default: false
  totalVotes: Number,           // default: 0
  expiresAt: Date,

  createdAt: Date,
  updatedAt: Date
}
```

---

# 📰 SOCIAL DOMAIN

---

## 🔟 POSTS

```js
{
  _id: ObjectId,

  authorId: ObjectId,         // Ref: USERS
  content: String,

  media: [
    {
      url: String,
      type: "image" | "video",
      thumbnail: String       // optional, for video
    }
  ],

  privacy: "public" | "friends" | "private",

  reactionsCount: Number,
  commentsCount: Number,
  sharesCount: Number,

  sharedPostId: ObjectId,     // Ref: POSTS (optional, for shared post)

  createdAt: Date,
  updatedAt: Date
}
```

---

## 1️⃣1️⃣ POST_REACTIONS

```js
{
  _id: ObjectId,

  postId: ObjectId,   // Ref: POSTS
  userId: ObjectId,   // Ref: USERS
  emoji: "like" | "love" | "haha" | "wow" | "sad" | "angry",

  createdAt: Date
}
```

---

## 1️⃣2️⃣ POST_COMMENTS

```js
{
  _id: ObjectId,

  postId: ObjectId,   // Ref: POSTS
  userId: ObjectId,   // Ref: USERS
  content: String,

  createdAt: Date,
  updatedAt: Date
}
```

---

## 1️⃣3️⃣ STORIES

```js
{
  _id: ObjectId,

  authorId: ObjectId,         // Ref: USERS
  type: "image" | "video" | "text",

  content: String,            // optional, for text stories
  mediaUrl: String,           // optional, for image/video stories
  backgroundColor: String,    // optional
  textStyle: String,          // optional

  viewersCount: Number,
  expiresAt: Date,            // tự động hết hạn sau 24h

  createdAt: Date
}
```

---

## 1️⃣4️⃣ STORY_VIEWS

```js
{
  _id: ObjectId,

  storyId: ObjectId,  // Ref: STORIES
  userId: ObjectId,   // Ref: USERS

  viewedAt: Date
}
```

---

# ☁️ MY CLOUD DOMAIN

---

## 1️⃣5️⃣ CLOUD_ITEMS

```js
{
  _id: ObjectId,

  userId: ObjectId,   // Ref: USERS
  type: "file" | "note",

  title: String,
  content: String,    // optional, cho note

  // File metadata
  fileUrl: String,
  fileName: String,
  fileSize: Number,
  mimetype: String,

  createdAt: Date,
  updatedAt: Date
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
| MESSAGE_REACTIONS    | MESSAGES      | Many-to-One |
| MESSAGE_REACTIONS    | USERS         | Many-to-One |
| POLLS                | CONVERSATIONS | Many-to-One |
| POLLS                | USERS         | Many-to-One |
| POSTS                | USERS         | Many-to-One |
| POST_REACTIONS       | POSTS         | Many-to-One |
| POST_REACTIONS       | USERS         | Many-to-One |
| POST_COMMENTS        | POSTS         | Many-to-One |
| POST_COMMENTS        | USERS         | Many-to-One |
| STORIES              | USERS         | Many-to-One |
| STORY_VIEWS          | STORIES       | Many-to-One |
| STORY_VIEWS          | USERS         | Many-to-One |
| CLOUD_ITEMS          | USERS         | Many-to-One |

---

# 🎯 Điểm mạnh của thiết kế này

✔ Không có array phình to trong message
✔ Không có update contention trong conversation
✔ Inbox load nhanh bằng CONVERSATION_MEMBERS
✔ Private chat lookup O(1) bằng pairKey
✔ Scale tốt tới hàng triệu message
✔ Story tự hết hạn qua expiresAt (TTL index)
✔ Poll vote không race condition qua votedUserIds
✔ Cloud items tách riêng giữa note và file
