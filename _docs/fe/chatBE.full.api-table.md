# chatBE API Table (generated)

- Source: src/modules/**/index.ts (router definitions) + postman/chatBE.full.postman_collection.json
- Prefix: /v1 (except /uploads static)

| Group | Method | Path | Auth | Body | Path vars | Handler | Purpose |
|---|---:|---|:---:|---|---|---|---|
| Blocks | GET | /v1/blocks | Yes | none |  | get Blocked Users | Lấy danh sách người dùng đã chặn |
| Blocks | DELETE | /v1/blocks/{{blockedUserId}} | Yes | none | blockedUserId | unblock User | Bỏ chặn người dùng |
| Blocks | POST | /v1/blocks/{{blockedUserId}} | Yes | json | blockedUserId | block User | Chặn người dùng |
| Blocks | GET | /v1/blocks/{{blockedUserId}}/check | Yes | none | blockedUserId | check Block Status | Kiểm tra trạng thái chặn |
| Chat | GET | /v1/conversations | Yes | none |  | get Conversations | Lấy hội thoại |
| Chat | GET | /v1/conversations/{{conversationId}} | Yes | none | conversationId | get Conversation Detail | Lấy hội thoại chi tiết |
| Chat | DELETE | /v1/conversations/{{conversationId}}/archive | Yes | none | conversationId | unarchive Conversation | Bỏ lưu trữ hội thoại |
| Chat | POST | /v1/conversations/{{conversationId}}/archive | Yes | json | conversationId | archive Conversation | Lưu trữ hội thoại |
| Chat | POST | /v1/conversations/{{conversationId}}/delivered | Yes | json | conversationId | mark As Delivered | Đánh dấu đã nhận |
| Chat | GET | /v1/conversations/{{conversationId}}/messages | Yes | none | conversationId | load Messages | Tải tin nhắn |
| Chat | POST | /v1/conversations/{{conversationId}}/messages | Yes | json | conversationId | send Message | Gửi tin nhắn |
| Chat | DELETE | /v1/conversations/{{conversationId}}/mute | Yes | none | conversationId | unmute Conversation | Bật thông báo hội thoại |
| Chat | POST | /v1/conversations/{{conversationId}}/mute | Yes | json | conversationId | mute Conversation | Tắt thông báo hội thoại |
| Chat | DELETE | /v1/conversations/{{conversationId}}/pin-conversation | Yes | none | conversationId | unpin Conversation | Bỏ ghim hội thoại |
| Chat | POST | /v1/conversations/{{conversationId}}/pin-conversation | Yes | json | conversationId | pin Conversation | Ghim hội thoại |
| Chat | GET | /v1/conversations/{{conversationId}}/pinned-messages | Yes | none | conversationId | get Pinned Messages | Lấy đã ghim tin nhắn |
| Chat | POST | /v1/conversations/{{conversationId}}/seen | Yes | json | conversationId | mark As Seen | Đánh dấu đã xem |
| Chat | POST | /v1/conversations/private | Yes | json |  | get Private Conversation | Lấy riêng tư hội thoại |
| Chat | GET | /v1/conversations/unread-count | Yes | none |  | get Total Unread Count | Lấy tổng chưa đọc số lượng |
| Chat | POST | /v1/groups | Yes | json |  | create Group | Tạo nhóm |
| Chat | PUT | /v1/groups/{{groupId}} | Yes | json | groupId | update Group | Cập nhật nhóm |
| Chat | GET | /v1/groups/{{groupId}}/info | Yes | none | groupId | get Group Info | Lấy nhóm info |
| Chat | POST | /v1/groups/{{groupId}}/leave | Yes | json | groupId | leave Group | Rời nhóm |
| Chat | GET | /v1/groups/{{groupId}}/members | Yes | none | groupId | get Group Members | Lấy nhóm thành viên |
| Chat | POST | /v1/groups/{{groupId}}/members | Yes | json | groupId | add Members | Thêm thành viên |
| Chat | DELETE | /v1/groups/{{groupId}}/members/{{userId}} | Yes | none | groupId, userId | remove Member | Xoá thành viên |
| Chat | PATCH | /v1/groups/{{groupId}}/members/{{userId}}/approve | Yes | json | groupId, userId | approve Member | Duyệt thành viên |
| Chat | PATCH | /v1/groups/{{groupId}}/members/{{userId}}/reject | Yes | json | groupId, userId | reject Member | Từ chối thành viên |
| Chat | GET | /v1/groups/{{groupId}}/members/pending | Yes | none | groupId | get Pending Members | Lấy pending thành viên |
| Chat | GET | /v1/groups/{{groupId}}/polls | Yes | none | groupId | get Polls | Lấy bình chọn |
| Chat | POST | /v1/groups/{{groupId}}/polls | Yes | json | groupId | create Poll | Tạo bình chọn |
| Chat | GET | /v1/groups/{{groupId}}/polls/{{pollId}}/results | Yes | none | groupId, pollId | get Poll Results | Lấy bình chọn kết quả |
| Chat | POST | /v1/groups/{{groupId}}/polls/{{pollId}}/vote | Yes | json | groupId, pollId | vote Poll | Bình chọn bình chọn |
| Chat | POST | /v1/groups/{{groupId}}/set-admin | Yes | json | groupId | set Admin | Thiết lập quản trị |
| Chat | PATCH | /v1/groups/{{groupId}}/settings | Yes | json | groupId | update Group Settings | Cập nhật nhóm cài đặt |
| Chat | POST | /v1/groups/{{groupId}}/transfer-owner | Yes | json | groupId | transfer Owner | Chuyển chủ nhóm |
| Chat | PUT | /v1/messages/{{messageId}} | Yes | json | messageId | edit Message | Chỉnh sửa tin nhắn |
| Chat | POST | /v1/messages/{{messageId}}/delete | Yes | json | messageId | delete Message For Me | Xoá tin nhắn for me |
| Chat | DELETE | /v1/messages/{{messageId}}/pin | Yes | none | messageId | unpin Message | Bỏ ghim tin nhắn |
| Chat | POST | /v1/messages/{{messageId}}/pin | Yes | json | messageId | pin Message | Ghim tin nhắn |
| Chat | POST | /v1/messages/{{messageId}}/quote | Yes | json | messageId | quote Message | Trích dẫn tin nhắn |
| Chat | DELETE | /v1/messages/{{messageId}}/react | Yes | none | messageId | remove Reaction | Xoá cảm xúc |
| Chat | POST | /v1/messages/{{messageId}}/react | Yes | json | messageId | add Reaction | Thêm cảm xúc |
| Chat | DELETE | /v1/messages/{{messageId}}/reactions | Yes | none | messageId | remove All Reactions | Xoá all cảm xúc |
| Chat | GET | /v1/messages/{{messageId}}/reactions | Yes | none | messageId | get Reactions | Lấy cảm xúc |
| Chat | POST | /v1/messages/{{messageId}}/revoke | Yes | json | messageId | revoke Message | Thu hồi tin nhắn |
| Chat | POST | /v1/messages/forward | Yes | json |  | forward Messages | Chuyển tiếp tin nhắn |
| Friend Requests | POST | /v1/friend-requests/{{receiverId}} | Yes | json | receiverId | send Friend Request | Gửi bạn bè lời mời |
| Friend Requests | DELETE | /v1/friend-requests/{{requestId}} | Yes | none | requestId | cancel Friend Request | Huỷ bạn bè lời mời |
| Friend Requests | PATCH | /v1/friend-requests/{{requestId}} | Yes | json | requestId | update Friend Request Status | Cập nhật bạn bè lời mời trạng thái |
| Friend Requests | GET | /v1/friend-requests/received | Yes | none |  | get Received Requests | Lấy received lời mời |
| Friend Requests | GET | /v1/friend-requests/sent | Yes | none |  | get Sent Requests | Lấy sent lời mời |
| Friendships | GET | /v1/friendships | Yes | none |  | get Friends List | Lấy bạn bè list |
| Friendships | DELETE | /v1/friendships/{{friendId}} | Yes | none | friendId | unfriend | Huỷ kết bạn |
| Friendships | GET | /v1/friendships/{{friendId}}/check | Yes | none | friendId | check Friendship | Kiểm tra bạn bè |
| Friendships | GET | /v1/users/{{id}}/mutual-friends | Yes | none | id | get Mutual Friends | Lấy mutual bạn bè |
| Friendships | GET | /v1/users/{{id}}/suggestions | Yes | none | id | get Friend Suggestions | Lấy bạn bè suggestions |
| Media | DELETE | /v1/media/{{filename}} | Yes | none | filename | delete | Xoá |
| Media | POST | /v1/media/upload | Yes | form-data |  | upload Single | Tải lên single |
| Media | POST | /v1/media/upload-multiple | Yes | form-data |  | upload Multiple | Tải lên multiple |
| My Cloud | GET | /v1/my-cloud | Yes | none |  | get Items | Lấy items |
| My Cloud | POST | /v1/my-cloud | Yes | json |  | create Item | Tạo item |
| My Cloud | DELETE | /v1/my-cloud/{{id}} | Yes | none | id | delete Item | Xoá item |
| Search | GET | /v1/search | Yes | none |  | global Search | global search |
| Static | GET | /uploads/{{path}} | No | none | path | express.static(uploads) | Truy cập file tĩnh trong thư mục uploads |
| User | POST | /v1/auth/login | No | json |  | login | Đăng nhập |
| User | POST | /v1/auth/register | No | json |  | register | Đăng ký |
| User | GET | /v1/profile | Yes | none |  | profile | Hồ sơ |
| User | PATCH | /v1/profile | Yes | json |  | update Profile | Cập nhật profile |
| User | POST | /v1/rpc/introspect | No | json |  | introspect | Introspect token |
| User | GET | /v1/users | No | none |  | list | Lấy danh sách |
| User | POST | /v1/users | Yes | json |  | create | Tạo |
| User | DELETE | /v1/users/{{id}} | Yes | none | id | delete | Xoá |
| User | GET | /v1/users/{{id}} | No | none | id | get Detail | Lấy chi tiết |
| User | PATCH | /v1/users/{{id}} | Yes | json | id | update | Cập nhật |
| User | GET | /v1/users/{{id}}/presence | Yes | none | id | get Presence | Lấy trạng thái online |
| User | GET | /v1/users/search | Yes | none |  | search By Phone | Tìm kiếm by phone |

## Notes
- Auth=Yes nghĩa là request có header `Authorization: Bearer {{accessToken}}` trong collection.
- Body=json là raw JSON placeholder; bạn cần điền đúng schema theo usecase.
