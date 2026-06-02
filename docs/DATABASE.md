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

Các table đang được khởi tạo bởi `ALL_TABLES` (xem `src/share/repository/dynamodb/table-defs.ts`):

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
| `group_invite_links` | Chat | `token` | `conversationId-status-index` | Invite link/token cho group |
| `group_blocks` | Chat | `pk`, `sk` | `userId-index`, `blockedBy-index` | User bị chặn khỏi group |

Các table/constant có trong code nhưng chưa được auto-init bởi `ALL_TABLES`:

| Table | Trạng thái trong code | Ghi chú |
| --- | --- | --- |
| `blocks` | Có `BLOCKS_TABLE` và repository/model, nhưng chưa nằm trong `ALL_TABLES` | Repository đang query theo `blockerId`/`blockedUserId`; table phải tồn tại sẵn hoặc cần thêm vào `ALL_TABLES` trước khi auto-init |
| `stories` | Chỉ có trong `TABLE_NAMES` | Chưa có table definition/repository model hiện tại |
| `story_views` | Chỉ có trong `TABLE_NAMES` | Chưa có table definition/repository model hiện tại |

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
- Auth: `password`, `salt`, `tokenVersion`, `status`, `verified.email`, `verified.phone`, `emailVerifiedAt`.
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
- Group settings: `settings.allowSendLink`, `settings.requireApproval`, `settings.allowMemberInvite`, `settings.whoCanSendMessages`, `settings.whoCanAddMembers`, `settings.whoCanUpdateGroupInfo`, `settings.whoCanPinMessages`, `settings.newMemberCanViewHistory`, `settings.utilityPermissions.poll`, `settings.utilityPermissions.reminder`, `settings.utilityPermissions.note`.
- Preview: `lastMessage`, `lastMessageAt`.
- Stored key helper: `pk` được ghi bằng `id` trong repository, không nằm trong public model.
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
- Timeline: `joinedAt`, `leftAt`, `historyVisibleFrom`, `updatedAt`, `lastActivityAt`.
- Read state: `unreadCount`, `lastReadMessageId`, `lastReadAt`, `lastReadMessageCreatedAt`, `lastSeenMessageId`, `lastSeenAt`, `lastSeenMessageCreatedAt`, `lastDeliveredMessageId`, `lastDeliveredAt`, `lastDeliveredMessageCreatedAt`.
- User inbox flags: `muteUntil`, `pinned`, `pinnedAt`, `archived`.
- Hidden chat: `hiddenUserIds`, `hidden`, `hiddenAt`, `hiddenPinHash`, `deletedAt`.
- Personalization: `nickname`, `nicknameUpdatedAt`, `wallpaper`, `wallpaperUpdatedAt`, `wallpaperUrl` (alias response, thực tế lưu bằng `wallpaper`).

Access patterns:

- Query members of a conversation by `pk`.
- Query user inbox by `userId-lastActivityAt-index`.
- Check membership/role before message, group, poll and utility actions.
- Set/remove nickname and wallpaper per member via update on `conversation_members` row.

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

- Identity/key: `pk`, `sk`, `id`, `conversationId`, `senderId`, `clientMessageId`, `clientMessageKey`.
- Content: `type`, `text`, `media`, `links`, `call`, `profileCardUserId`.
- Media item fields: `media[].url`, `media[].mediaType`, `media[].name`, `media[].size`, `media[].width`, `media[].height`, `media[].duration`, `media[].thumbnailUrl`.
- Call metadata fields: `call.callId`, `call.roomName`, `call.callType`, `call.status`, `call.callerId`, `call.calleeIds`, `call.answeredAt`, `call.endedAt`, `call.endedBy`, `call.durationSeconds`, `call.participantOutcomes`.
- Utility card metadata: `pollId`, `reminderId`, `systemAction`, `systemRefId`. Message `type=poll` và `type=reminder` là card trong timeline, được hydrate bằng record utility khi load.
- Lifecycle: `messageStatus`, `deletedBy`, `revokedAt`, `deletedForUserIds`, `editedAt`, `deletedAt`, `expiresAt`, `expireAtEpoch`.
- Interaction/model-only hydrate: `quotedMessageId`, `quotedMessagePreview`, `forwardedFrom`, `forwardedFromMessageId`, `mentions`, `pinned`, `pinnedAt`, `readBy`, `reactions`, `poll`, `reminder`.
- Repository-written helper fields: `GSI1PK`, `GSI1SK` hiện được ghi như sender/time helper attributes, nhưng `messages` không có `GSI1` trong `table-defs.ts`.
- Idempotency reservation row fields: `pk`, `sk`, `conversationId`, `senderId`, `clientMessageId`, `status`, `messageIds`, `createdAt`, `updatedAt`, `expireAtEpoch`.
- Audit: `createdAt`.

Access patterns:

- Load messages in a conversation by `pk` and cursor.
- Lookup/update/revoke/delete by `id-index`.
- Dedupe send retries by direct get on the idempotency reservation key `{conversationId, senderId, clientMessageId}` and fallback lookup through `clientMessageKey-index`.
- Increment unread and update last message after insert.
- Search messages by text content (DynamoDB Query + in-memory text filter), với optional filters: date range (`from`/`to`), senderId filter.

### `message_reactions`

Mục đích: lưu reaction theo message, user và emoji.

Primary key:

- `pk = MSG#{messageId}`.
- `sk = REACT#{userId}#{emoji}`.

Fields chính:

- Key: `pk`, `sk`.
- Model fields: `id`, `messageId`, `userId`, `emoji`, `count`, `createdAt`.
- Hydrated response field: `user.id`, `user.avatarUrl`, `user.displayName`.

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

Classification types (field `type`):

- `image`, `video`, `voice`, `file`, `link`, `sticker`, `gif`.

Access patterns:

- Search media/link by conversation and type (GSI1).
- List all classifications in a conversation (GSI1 với FilterExpression).
- Delete classifications when message is removed.
- Search media by keyword (name/url) — in-memory filter after DynamoDB query.
- Sticker/GIF search via `type` = sticker/gif query.

### `polls`

Mục đích: lưu poll trong group conversation.

Primary key:

- `id`.

Indexes:

- `conversation-index`: list poll theo group.
- `status-expiresAt-index`: worker query poll `active` đã quá hạn để đóng tự động.

Fields chính:

- `id`, `conversationId`, `messageId`, `question`, `options`, `createdBy`.
- Option fields: `options[].id`, `options[].text`, `options[].voteCount`, `options[].votedUserIds`, `options[].addedBy`.
- Settings: `isMultipleChoice`, `allowAddOption`, `allowChangeVote`, `showResultsBeforeClose`, `hideVoters`.
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

### `group_invite_links`

Mục đích: lưu invite link/token cho group, hỗ trợ join group không cần admin add.

Primary key:

- `token` (UUID v4).

Indexes:

- `conversationId-status-index`: tìm active token theo group.

Fields chính:

- `token`, `conversationId`, `status` (`active` | `revoked`), `createdBy`, `revokedBy`, `createdAt`, `revokedAt`, `expiresAt`.

Access patterns:

- Get/create invite link by `token`.
- Query active token by `conversationId`.
- Revoke/regenerate: update status từ `active` sang `revoked` và tạo token mới.
- Token không có trong table = revoked (không query theo `status=revoked` khi tìm active link).

### `group_blocks`

Mục đích: lưu user bị chặn khỏi group, không cho tham gia bằng link hoặc được add lại.

Primary key:

- `pk = GROUP#{conversationId}`.
- `sk = USER#{userId}`.

Indexes:

- `userId-index`: kiểm tra user có bị chặn khỏi group nào không.
- `blockedBy-index`: list user bị chặn bởi một người quản lý.

Fields chính:

- `pk`, `sk`, `conversationId`, `userId`, `blockedBy`, `createdAt`.

Access patterns:

- Check if user is blocked from a group.
- List blocked users in a group (owner/admin).
- Block/unblock a user from group.

Ghi chú:

- Block dùng table riêng, không dùng `conversation_members.status=rejected`.
- Unblock không tự động thêm user lại vào group.

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

- Model fields: `id`, `userA`, `userB`, `status`, `createdAt`.
- Repository-only lifecycle field: `updatedAt` được ghi khi soft delete/restore, nhưng bị loại khỏi entity trong `toEntity` và không có trong `FriendshipSchema`.

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

Ghi chú hiện trạng code:

- Có `BLOCKS_TABLE`, model và repository DynamoDB, nhưng `BLOCKS_TABLE` chưa nằm trong `ALL_TABLES`, nên backend auto-init hiện chưa tự tạo table này.

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
| `group_invite_links.conversationId` | `conversations.id` | Many-to-one |
| `group_invite_links.createdBy` | `users.id` | Many-to-one |
| `group_blocks.conversationId` | `conversations.id` | Many-to-one |
| `group_blocks.userId` | `users.id` | Many-to-one |
| `group_blocks.blockedBy` | `users.id` | Many-to-one |

## Migration and Maintenance Rules

- DynamoDB table definition phải được thay đổi trong code trước, tài liệu cập nhật sau.
- Không đổi key schema của table production nếu chưa có migration/backfill rõ ràng.
- Thêm GSI mới cần kiểm tra `auto-init.ts` có sync được index đó.
- Trường mới trong model nên được repository map date/string nhất quán.
- Các trường query thường xuyên phải có access pattern rõ ràng trước khi thêm.
- Không đưa secret, token mẫu thật hoặc credential AWS vào tài liệu.
