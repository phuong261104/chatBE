# Database Documentation

## Tổng quan

Project hiện tại dùng AWS DynamoDB làm database chính. Redis được dùng cho session, token blacklist, presence và realtime state; Redis không phải nguồn dữ liệu nghiệp vụ lâu dài.

Nguồn sự thật của schema DynamoDB nằm ở:

- `src/share/repository/dynamodb/table-defs.ts`: table, key schema, GSI, TTL và `ALL_TABLES`.
- `src/modules/*/model/*.ts`: Zod model/entity fields.
- `src/modules/*/infras/repository/dynamodb/*.ts`: access pattern và key mapping thực tế.

Tên table runtime được ghép qua `getTableName(TABLE_NAMES.X)` và có thể có prefix từ `DYNAMODB_TABLE_PREFIX`. Ví dụ `users` có thể trở thành `chatbe_dev_users`.

## Quy ước chung

- Billing mode: tất cả table hiện dùng `PAY_PER_REQUEST`.
- Date/time được lưu dạng ISO string trong DynamoDB, sau đó repository map lại về `Date`.
- Các table đơn giản dùng primary key `id`.
- Các table cần truy vấn theo parent dùng composite key `pk`/`sk`.
- Cursor pagination dùng `LastEvaluatedKey` encode base64.
- Script khởi tạo/sync table: `npm run dynamodb:init`.
- Script reset table: `npm run dynamodb:reset`.
- Khi thêm table/index mới, cập nhật `TABLE_NAMES`, table definition, `ALL_TABLES`, repository và tài liệu này.

## Active Tables

Các table đang được khởi tạo bởi `ALL_TABLES`:

| Table | Domain | Primary key | GSI/LSI | Ghi chú |
| --- | --- | --- | --- | --- |
| `users` | User/Auth | `id` | `email-index`, `phone-index`, `username-index` | Hồ sơ, credential hash, privacy, settings |
| `user_avatar_history` | User | `userId`, `createdAt` | `id-index` | Lịch sử avatar theo user |
| `conversations` | Chat | `id` | `pairKey-index` | Metadata private/group conversation |
| `conversation_members` | Chat | `pk`, `sk` | `userId-index`, `id-index`, `userId-lastActivityAt-index` | Inbox state và role member |
| `messages` | Chat | `pk`, `sk` | `id-index`, `clientMessageKey-index` | Message append/query theo conversation, có TTL |
| `message_reactions` | Chat | `pk`, `sk` | Không | Reaction theo message/user/emoji |
| `message_classifications` | Chat/Search | `pk`, `sk` | `GSI1`, `messageId-index` | Media/link classification để tìm kiếm |
| `polls` | Chat | `id` | `conversation-index`, `status-expiresAt-index` | Poll trong group |
| `group_reminders` | Chat | `id` | `conversation-index`, `status-nextNotifyAt-index` | Reminder trong group |
| `group_notes` | Chat | `id` | `conversation-index` | Note trong group |
| `friendships` | Social | `userA`, `userB` | `userA-createdAt-index`, `userB-index` | Một record cho mỗi cặp bạn bè |
| `friend_requests` | Social | `id` | `senderId-index`, `receiverId-index`, `senderId-createdAt-index`, `receiverId-createdAt-index` | Lời mời kết bạn |
| `blocks` | Social | `blockerId`, `blockedUserId` | `blockerId-createdAt-index` | Quan hệ chặn |
| `cloud_items` | My Cloud | `id` | `userId-index`, `userId-type-index`, `userId-isDeleted-index`, `userId-isPinned-index`, `userId-collectionId-index`, `shareToken-index` | File/note/link lưu cá nhân |
| `collections` | My Cloud | `id` | `userId-index`, `userId-parentId-index`, `userId-isDefault-index` | Thư mục/collection |
| `collection_items` | My Cloud | `pk`, `sk` | `collectionId-index`, `itemId-index` | Mapping collection-item |

`stories` và `story_views` đang có trong `TABLE_NAMES`, nhưng chưa có table definition trong `ALL_TABLES`; hiện chưa được auto-init bởi backend.

## User Domain

### `users`

Mục đích: lưu identity, credential hash, profile, privacy và preferences.

Primary key:

- `id` string.

Indexes:

- `email-index`: tìm user theo email.
- `phone-index`: tìm user theo phone.
- `username-index`: tìm user theo username.

Fields chính:

- Identity: `id`, `email`, `phone`, `username`.
- Auth: `password`, `salt`, `status`, `verified.email`, `verified.phone`.
- Profile: `displayName`, `avatarUrl`, `coverUrl`, `birthday`, `gender`, `bio`.
- Privacy: `searchableByEmail`, `searchableByPhone`, `searchableByUsername`, `birthdayVisibility`, `phoneVisibility`, `avatarVisibility`, `showOnline`, `showLastSeen`, `blockMessagesFromStrangers`.
- Settings: `settings.notifications.push`, `settings.notifications.inApp`.
- Audit: `lastLoginAt`, `lastSeen`, `createdAt`, `updatedAt`.

Access patterns:

- Login/search by email, phone, username.
- Fetch profile by `id`.
- Update profile/privacy/avatar by authenticated user.

### `user_avatar_history`

Mục đích: lưu lịch sử avatar để client hiển thị hoặc rollback.

Primary key:

- Partition key: `userId`.
- Sort key: `createdAt`.

Indexes:

- `id-index`: tìm bản ghi lịch sử theo id.

Fields chính:

- `id`, `userId`, `avatarUrl`, `createdAt`.

Access patterns:

- Query latest avatars by `userId`, sort giảm dần theo `createdAt`.

## Chat Domain

### `conversations`

Mục đích: lưu metadata conversation, không lưu danh sách member lớn trong item này.

Primary key:

- `id`.

Indexes:

- `pairKey-index`: lookup private conversation theo cặp user.

Fields chính:

- `type`: `private` hoặc `group`.
- Private: `pairKey`.
- Group: `name`, `avatarUrl`, `createdBy`, `ownerId`, `admins`, `membersCount`, `settings`.
- Preview: `lastMessage`, `lastMessageAt`.
- Audit: `createdAt`, `updatedAt`.

Access patterns:

- Tạo/lấy private conversation O(1) bằng `pairKey`.
- Lấy group info bằng `id`.
- Cập nhật preview khi gửi message mới.

### `conversation_members`

Mục đích: thay thế member array trong conversation, đồng thời lưu inbox state theo user.

Primary key:

- `pk = CONV#{conversationId}`.
- `sk = MEM#{userId}`.

Indexes:

- `userId-index`: lấy tất cả conversation của một user.
- `id-index`: lookup member row theo generated id.
- `userId-lastActivityAt-index`: inbox cursor theo activity mới nhất.

Fields chính:

- Identity: `id`, `conversationId`, `userId`.
- Role/status: `role` (`owner`, `admin`, `member`), `status` (`active`, `pending`, `rejected`).
- Timeline: `joinedAt`, `leftAt`, `updatedAt`, `lastActivityAt`.
- Read state: `unreadCount`, `lastReadMessageId`, `lastReadAt`, `lastReadMessageCreatedAt`, `lastSeenMessageId`, `lastSeenAt`, `lastSeenMessageCreatedAt`, `lastDeliveredMessageId`, `lastDeliveredAt`, `lastDeliveredMessageCreatedAt`.
- User inbox flags: `muteUntil`, `pinned`, `pinnedAt`, `archived`.
- Hidden chat: `hiddenUserIds`, `hidden`, `hiddenAt`, `hiddenPinHash`.

Access patterns:

- Query members of a conversation by `pk`.
- Query user inbox by `userId-lastActivityAt-index`.
- Check membership/role before message, group, poll and utility actions.

### `messages`

Mục đích: lưu message theo conversation theo thứ tự thời gian.

Primary key:

- `pk = CONV#{conversationId}`.
- `sk = MSG#{createdAtIso}#{messageId}`.
- Idempotency reservation rows for send retry use `pk = IDEMP#{conversationId}#{senderId}` and `sk = CLIENT#{clientMessageId}` in the same table. These rows store `messageIds` after the first successful send and expire by `expireAtEpoch`.

Indexes:

- `id-index`: lookup message theo id.
- `clientMessageKey-index`: lookup message đã ghi theo `conversationId#senderId#clientMessageId` để dedupe retry.

TTL:

- `expireAtEpoch` enabled. Dùng cho message có thời hạn.

Fields chính:

- Identity: `id`, `conversationId`, `senderId`, `clientMessageId`.
- Content: `type`, `text`, `media`, `links`, `call`, `profileCardUserId`.
- Utility card metadata: `pollId`, `reminderId`, `systemAction`, `systemRefId`. Message `type=poll` và `type=reminder` là card trong timeline, được hydrate bằng record utility khi load.
- Lifecycle: `messageStatus`, `deletedBy`, `revokedAt`, `deletedForUserIds`, `editedAt`, `deletedAt`, `expiresAt`, `expireAtEpoch`.
- Interaction: `quotedMessageId`, `quotedMessagePreview`, `forwardedFrom`, `forwardedFromMessageId`, `mentions`, `pinned`, `pinnedAt`, `readBy`, `reactions`.
- Audit: `createdAt`.

Access patterns:

- Load messages in a conversation by `pk` and cursor.
- Lookup/update/revoke/delete by `id-index`.
- Dedupe send retries by direct get on the idempotency reservation key `{conversationId, senderId, clientMessageId}` and fallback lookup through `clientMessageKey-index`.
- Increment unread and update last message after insert.

### `message_reactions`

Mục đích: lưu reaction theo message, user và emoji.

Primary key:

- `pk = MSG#{messageId}`.
- `sk = REACT#{userId}#{emoji}`.

Fields chính:

- `id`, `messageId`, `userId`, `emoji`, `count`, `createdAt`.

Access patterns:

- Query all reactions of a message by `pk`.
- Upsert/remove one reaction by full key.
- Delete all reactions when deleting message for everyone.

### `message_classifications`

Mục đích: lưu classification cho media/link để hỗ trợ search trong conversation.

Primary key:

- `pk = CONV#{conversationId}#{type}`.
- `sk = MSG#{createdAtIso}#{classificationId}`.

Indexes:

- `GSI1`: `GSI1PK = CONV#{conversationId}`, `GSI1SK = {type}#{createdAtIso}#{classificationId}`.
- `messageId-index`: cleanup/find classification theo message.

Fields chính:

- `id`, `conversationId`, `type`, `senderId`, `url`, `name`, `linkUrl`, `messageId`, `createdAt`.

Access patterns:

- Search media/link by conversation and type.
- List all classifications in a conversation.
- Delete classifications when message is removed.

### `polls`

Mục đích: lưu poll trong group conversation.

Primary key:

- `id`.

Indexes:

- `conversation-index`: list poll theo group.
- `status-expiresAt-index`: worker query poll `active` đã quá hạn để đóng tự động.

Fields chính:

- `id`, `conversationId`, `messageId`, `question`, `options`, `createdBy`.
- Settings: `isMultipleChoice`, `allowAddOption`, `showResultsBeforeClose`, `hideVoters`.
- Lifecycle: `status`, `expiresAt`, `closedAt`, `closedBy`.
- Pin/vote: `pinned`, `pinnedAt`, `pinnedBy`, `totalVotes`, `lastVoteActivityAt`, `lastVoteActivityMessageId`, `voteActivityCount`.
- Audit: `createdAt`, `updatedAt`.

### `group_reminders`

Mục đích: reminder trong group.

Primary key:

- `id`.

Indexes:

- `conversation-index`.
- `status-nextNotifyAt-index`: worker query reminder `active` cần phát thông báo.

Fields chính:

- `id`, `conversationId`, `messageId`, `title`, `description`, `remindAt`, `status`, `createdBy`.
- Scheduling: `repeatRule`, `notifyBeforeMinutes`, `nextNotifyAt`, `lastNotifiedAt`.
- Pin: `pinned`, `pinnedAt`, `pinnedBy`.
- Audit: `createdAt`, `updatedAt`.

### `group_notes`

Mục đích: note trong group.

Primary key:

- `id`.

Indexes:

- `conversation-index`.

Fields chính:

- `id`, `conversationId`, `title`, `content`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`.

## Social Domain

### `friendships`

Mục đích: lưu quan hệ bạn bè. Mỗi cặp user chỉ có một record chuẩn hóa theo thứ tự sort.

Primary key:

- Partition key: `userA`.
- Sort key: `userB`.

Indexes:

- `userA-createdAt-index`: list friend khi user nằm ở `userA`.
- `userB-index`: list friend khi user nằm ở `userB`.

Fields chính:

- `id`, `userA`, `userB`, `status`, `createdAt`, `updatedAt`.

Access patterns:

- Check friendship bằng pair sorted `userA/userB`.
- List friends bằng query hai hướng `userA` và `userB`.
- Unfriend dùng soft delete status.

### `friend_requests`

Mục đích: lưu lời mời kết bạn và trạng thái phản hồi.

Primary key:

- `id`.

Indexes:

- `senderId-index`, `receiverId-index`.
- `senderId-createdAt-index`, `receiverId-createdAt-index` cho cursor list.

Fields chính:

- `id`, `fromUserId`, `toUserId`, `senderId`, `receiverId`, `status`, `createdAt`, `respondedAt`.

Ghi chú mapping:

- Model domain dùng `fromUserId`/`toUserId`.
- Repository cũng lưu `senderId`/`receiverId` để phục vụ GSI hiện có.

### `blocks`

Mục đích: lưu quan hệ user chặn user khác.

Primary key:

- Partition key: `blockerId`.
- Sort key: `blockedUserId`.

Indexes:

- `blockerId-createdAt-index`: list blocked users theo thời gian.

Fields chính:

- `id`, `blockerId`, `blockedUserId`, `createdAt`.

Access patterns:

- Check block bằng cặp `blockerId/blockedUserId`.
- List users đã chặn theo `blockerId`.

## My Cloud Domain

### `cloud_items`

Mục đích: lưu tài liệu cá nhân, file, image, video, voice, link và note.

Primary key:

- `id`.

Indexes:

- `userId-index`.
- `userId-type-index`.
- `userId-isDeleted-index`.
- `userId-isPinned-index`.
- `userId-collectionId-index`.
- `shareToken-index`.

Fields chính:

- Identity: `id`, `userId`, `collectionId`.
- Content: `type`, `title`, `content`, `fileUrl`, `fileName`, `fileSize`, `mimetype`, `thumbnailUrl`.
- State: `isPinned`, `isDeleted`, `deletedAt`, `shareToken`, `shareExpiresAt`.
- Audit: `createdAt`, `updatedAt`.

Access patterns:

- List cloud items by user.
- Filter by type, deleted state, pinned state, collection.
- Resolve public/shared item by `shareToken`.

### `collections`

Mục đích: lưu folder/collection trong My Cloud.

Primary key:

- `id`.

Indexes:

- `userId-index`.
- `userId-parentId-index`.
- `userId-isDefault-index`.

Fields chính:

- `id`, `userId`, `name`, `description`, `color`, `icon`, `coverImageUrl`, `parentId`, `isDefault`, `isDeleted`, `itemCount`, `createdAt`, `updatedAt`.

Access patterns:

- List collections by user.
- List child collections by parent.
- Ensure/get default collection.

### `collection_items`

Mục đích: mapping nhiều-nhiều giữa collection và cloud item.

Primary key:

- `pk = COLLECTION#{collectionId}`.
- `sk = ITEM#{itemId}`.

Indexes:

- `collectionId-index`.
- `itemId-index`.

Fields chính:

- `id`, `collectionId`, `itemId`, `userId`, `addedAt`.

Access patterns:

- List items trong collection.
- Tìm/remove mapping theo item.

## Redis Data

Redis được khởi tạo qua `RedisClient.init(REDIS_URL)` trong `src/index.ts`.

Các nhóm dữ liệu chính:

- Auth session store: refresh token/session metadata theo device.
- Token blacklist: access/refresh token đã revoke.
- Presence: socket online/offline, heartbeat và last seen.
- Socket/pubsub state phụ trợ cho realtime.

Redis chạy trong Docker cùng backend với service name `redis`; host dev có thể dùng `redis://localhost:6379`.

## Relationship Overview

| From | To | Loại quan hệ |
| --- | --- | --- |
| `user_avatar_history.userId` | `users.id` | Many-to-one |
| `conversations.createdBy/ownerId/admins` | `users.id` | Many-to-one / denormalized list |
| `conversation_members.conversationId` | `conversations.id` | Many-to-one |
| `conversation_members.userId` | `users.id` | Many-to-one |
| `messages.conversationId` | `conversations.id` | Many-to-one |
| `messages.senderId` | `users.id` | Many-to-one |
| `message_reactions.messageId` | `messages.id` | Many-to-one |
| `message_reactions.userId` | `users.id` | Many-to-one |
| `message_classifications.messageId` | `messages.id` | Many-to-one |
| `polls.conversationId` | `conversations.id` | Many-to-one |
| `group_reminders.conversationId` | `conversations.id` | Many-to-one |
| `group_notes.conversationId` | `conversations.id` | Many-to-one |
| `friendships.userA/userB` | `users.id` | Pair relationship |
| `friend_requests.fromUserId/toUserId` | `users.id` | Many-to-one |
| `blocks.blockerId/blockedUserId` | `users.id` | Pair relationship |
| `cloud_items.userId` | `users.id` | Many-to-one |
| `cloud_items.collectionId` | `collections.id` | Many-to-one |
| `collections.userId` | `users.id` | Many-to-one |
| `collection_items.collectionId` | `collections.id` | Many-to-one |
| `collection_items.itemId` | `cloud_items.id` | Many-to-one |

## Migration and Maintenance Rules

- DynamoDB table definition phải được thay đổi trong code trước, tài liệu cập nhật sau.
- Không đổi key schema của table production nếu chưa có migration/backfill rõ ràng.
- Thêm GSI mới cần kiểm tra `auto-init.ts` có sync được index đó.
- Trường mới trong model nên được repository map date/string nhất quán.
- Các trường query thường xuyên phải có access pattern rõ ràng trước khi thêm.
- Không đưa secret, token mẫu thật hoặc credential AWS vào tài liệu.
