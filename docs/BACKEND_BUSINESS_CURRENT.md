# Tài liệu Nghiệp vụ Backend Hiện tại của ChatBE

Tài liệu này mô tả các nghiệp vụ backend hiện đang được hỗ trợ trong source code ChatBE. Nội dung được viết theo góc nhìn nghiệp vụ để đội sản phẩm, frontend và backend có cùng cách hiểu về hành vi hệ thống.

Nguồn đối chiếu chính là source code trong `src/modules`, test suite trong `tests`, `docs/API_SPEC.md`, `docs/DATABASE.md` và `docs/BE-ARCHITECTURE.md`. Các tài liệu tham khảo Zalo chỉ được dùng làm mẫu bố cục và văn phong, không phải nguồn sự thật cho trạng thái hiện tại của hệ thống.

---

## 1. Tổng quan Backend ChatBE

ChatBE là backend cho ứng dụng chat/social, cung cấp REST API và realtime Socket.IO cho các nhóm nghiệp vụ chính: tài khoản, hồ sơ người dùng, quan hệ bạn bè, chặn người dùng, chat cá nhân, chat nhóm, media, My Cloud, tìm kiếm, cuộc gọi và AI helpers.

Backend dùng server state làm nguồn sự thật. Các thao tác quan trọng như gửi tin nhắn, đánh dấu đã xem, cập nhật unread, quản lý phiên đăng nhập, quyền nhóm và trạng thái cuộc gọi đều được xử lý ở backend trước khi đồng bộ về client.

Các nguyên tắc nghiệp vụ chung:

- Người dùng phải xác thực bằng JWT cho hầu hết API nghiệp vụ.
- Backend không tin `userId` do client gửi để đại diện người dùng hiện tại; người dùng hiện tại lấy từ token.
- Các quyền truy cập chat, nhóm, hồ sơ, presence và search được kiểm tra theo quan hệ bạn bè, block, privacy và membership.
- Realtime event chỉ được phát tới user room hoặc conversation/group members có quyền nhận.
- Redis giữ trạng thái phiên, token blacklist và presence; DynamoDB giữ dữ liệu nghiệp vụ lâu dài.

---

## 2. Tài khoản, Đăng nhập, Phiên và Thiết bị

### 2.1. Đăng ký và đăng nhập

Backend hỗ trợ đăng ký bằng số điện thoại, email tùy chọn, mật khẩu và tên hiển thị. Mật khẩu được hash trước khi lưu. Người dùng có thể đăng nhập bằng email hoặc số điện thoại kèm mật khẩu.

Sau khi đăng ký hoặc đăng nhập hợp lệ, backend tạo access token và refresh token. Access token dùng cho các API protected; refresh token dùng để lấy cặp token mới khi access token hết hạn.

Nếu cấu hình yêu cầu xác minh email, tài khoản chưa xác minh email sẽ bị chặn đăng nhập cho đến khi hoàn tất verify. Backend có các luồng gửi mã xác minh, verify email, quên mật khẩu, xác minh OTP reset password, gửi lại OTP và đặt lại mật khẩu.

### 2.2. Phiên đăng nhập và thiết bị

Mỗi request đăng nhập có thể mang metadata thiết bị như `x-device-id`, `x-device-platform`, `x-display-label`, vị trí gần đúng và `user-agent`. Backend lưu session trong Redis để quản lý trạng thái đăng nhập theo thiết bị.

Nghiệp vụ hiện tại giới hạn mỗi người dùng có tối đa một session `web` và một session `app` đang hoạt động. Khi đăng nhập mới cùng platform, session cũ cùng platform sẽ bị revoke. Điều này bảo vệ tài khoản nhưng vẫn cho phép cùng một user mở nhiều tab/socket trong session web hiện tại.

Người dùng có thể:

- Xem danh sách session đang đăng nhập.
- Đăng xuất session hiện tại.
- Đăng xuất toàn bộ session.
- Revoke một thiết bị cụ thể.

Khi session bị revoke, access token liên quan được đưa vào blacklist để ngăn tiếp tục dùng. Refresh token được rotate sau mỗi lần refresh; nếu refresh token đã dùng bị dùng lại, backend revoke session của thiết bị đó.

### 2.3. Đổi mật khẩu và bảo mật tài khoản

Người dùng đã đăng nhập có thể đổi mật khẩu bằng mật khẩu hiện tại và mật khẩu mới. Với luồng quên mật khẩu, backend gửi OTP, xác minh OTP và cấp quyền đặt lại mật khẩu bằng token tạm.

Các secret như JWT, SMTP, Redis, AWS, LiveKit và Gemini đều lấy từ environment; backend không hardcode credential trong source.

---

## 3. Hồ sơ Cá nhân, Quyền riêng tư và Presence

### 3.1. Hồ sơ cá nhân

Backend quản lý hồ sơ người dùng gồm tên hiển thị, avatar, cover, ngày sinh, giới tính, bio, email, số điện thoại và username. Người dùng có API để xem/cập nhật hồ sơ của chính mình và xem public profile của người khác theo quyền riêng tư.

Khi avatar thay đổi, backend có khả năng lưu lịch sử avatar để client hiển thị lại hoặc dùng cho trải nghiệm hồ sơ.

### 3.2. Quyền riêng tư

Người dùng có thể cấu hình các quyền riêng tư chính:

- Cho phép tìm kiếm bằng email, số điện thoại hoặc username.
- Quyền xem ngày sinh, số điện thoại và avatar: mọi người, bạn bè hoặc chỉ mình tôi.
- Hiển thị online và last seen.
- Chặn tin nhắn từ người lạ.

Khi người khác tìm kiếm hoặc xem hồ sơ, backend áp dụng privacy theo quan hệ giữa viewer và target. Người không đủ quyền sẽ không thấy các trường bị ẩn.

### 3.3. Presence và last seen

Presence thể hiện trạng thái online/offline và last seen. Backend cập nhật trạng thái dựa trên socket connection, heartbeat và lần socket cuối cùng của user rời hệ thống.

Presence response tôn trọng privacy. Nếu người dùng tắt hiển thị online hoặc last seen, người khác không được xem các thông tin này theo chính sách hiện tại.

---

## 4. Quan hệ Người dùng

### 4.1. Lời mời kết bạn

Backend hỗ trợ gửi, nhận, chấp nhận, từ chối, hủy và xóa lời mời kết bạn. Lời mời có các trạng thái chính: `pending`, `accepted`, `rejected`, `canceled`.

Người dùng có thể xem danh sách lời mời đã nhận, đã gửi, kiểm tra trạng thái lời mời với một user cụ thể và đếm số lời mời đang chờ.

Khi lời mời được chấp nhận, backend tạo quan hệ bạn bè giữa hai người dùng. Các thao tác social có thể phát realtime notification để client cập nhật ngay.

### 4.2. Danh sách bạn bè

Quan hệ bạn bè được lưu theo cặp user chuẩn hóa. Backend hỗ trợ:

- Xem danh sách bạn bè.
- Đếm số bạn bè.
- Tìm kiếm trong danh sách bạn bè.
- Kiểm tra hai user có phải bạn bè hay không.
- Xem bạn chung.
- Gợi ý bạn bè.
- Hủy kết bạn.

Gợi ý bạn bè hiện dựa trên dữ liệu social/chat hiện có như bạn chung hoặc tương tác nhóm, theo các usecase và test hiện tại.

### 4.3. Chặn người dùng

Người dùng có thể block hoặc unblock người khác. Khi quan hệ block tồn tại, backend áp dụng nó vào các luồng nhạy cảm:

- Không cho gửi tin nhắn private khi một trong hai phía đã block phía còn lại.
- Không cho tạo cuộc trò chuyện private hợp lệ nếu vi phạm block policy.
- Không hiển thị hoặc hạn chế một số dữ liệu hồ sơ/presence tùy ngữ cảnh.
- Không cho gửi profile card khi profile bị ẩn bởi quan hệ block.

Người dùng có thể xem danh sách người đã chặn và kiểm tra trạng thái block với một user cụ thể.

---

## 5. Chat Cá nhân, Chat Nhóm và Hộp thoại

### 5.1. Chat 1-1

Cuộc trò chuyện 1-1 được xác định bằng cặp user chuẩn hóa. Khi cần gửi tin hoặc mở private conversation, backend tìm conversation hiện có bằng cặp user; nếu chưa có và policy cho phép, backend tạo conversation mới.

Điều kiện chính để chat 1-1 hợp lệ:

- Cả hai user đang active.
- Không có quan hệ block hai chiều.
- Nếu người nhận bật chặn tin nhắn từ người lạ và hai bên chưa là bạn bè, backend không cho gửi tin trực tiếp.
- Nếu người nhận cho phép tin nhắn từ người lạ, tin nhắn có thể đi vào luồng message request/stranger conversation trước khi được chấp nhận.

### 5.2. Message request và stranger conversation

Khi người gửi chưa là bạn của người nhận, backend có thể tạo conversation ở trạng thái chờ. Người nhận có thể xem danh sách message requests và quyết định accept hoặc reject.

Sau khi request được accept, cuộc trò chuyện tiếp tục như một conversation bình thường. Nếu bị reject, backend không coi đây là một hội thoại active giữa hai người cho luồng chat thông thường.

### 5.3. Chat nhóm

Group conversation có metadata riêng như tên nhóm, avatar, người tạo, owner, admins, số lượng thành viên và settings. Danh sách thành viên không nằm trực tiếp trong conversation item mà được quản lý bằng member state riêng để hỗ trợ inbox, role, trạng thái rời nhóm, pending approval và unread.

Khi tạo nhóm, người tạo là owner. Thành viên có role `owner`, `admin` hoặc `member`; status có thể là `active`, `pending` hoặc `rejected`.

### 5.4. Hộp thoại, pin, mute, archive và hidden chat

Mỗi user có state riêng cho từng conversation:

- `unreadCount` để hiển thị số tin chưa đọc.
- `lastActivityAt` để sắp xếp inbox.
- `pinned` và `pinnedAt` để ghim hội thoại.
- `muteUntil` để tắt thông báo theo thời gian.
- `archived` để lưu trữ khỏi danh sách chính.
- `hidden`, `hiddenAt`, `hiddenPinHash` để ẩn hội thoại bằng PIN.

Hidden conversation không xuất hiện trong danh sách mặc định cho đến khi user unlock hoặc unhide bằng PIN hợp lệ.

---

## 6. Vòng đời Tin nhắn

### 6.1. Gửi và nhận tin nhắn

Backend hỗ trợ các loại tin nhắn: text, image, file, link, video, voice, sticker, GIF, call, system và profile card. Tin nhắn có thể đi qua HTTP hoặc Socket.IO, nhưng đều phải qua cùng business rules về membership, block, stranger policy và group settings.

Khi gửi tin thành công, backend:

- Tạo message trong timeline của conversation.
- Cập nhật last message của conversation.
- Cập nhật unread/activity của từng member.
- Classify media/link để phục vụ tìm kiếm.
- Emit realtime `receiveMessage` tới tất cả user room của các member, bao gồm cả sender.

Với nhiều tab cùng user, các tab cùng join user room nên cùng nhận message. Frontend vẫn nên dedupe theo `message.id`.

### 6.2. Idempotency khi gửi tin

Client có thể gửi `clientMessageId` khi gửi tin. Backend dedupe theo bộ `{conversationId, senderId, clientMessageId}` để retry không tạo duplicate message và không tăng unread lần hai.

Nếu retry xảy ra sau khi message đã được tạo, backend trả lại message đã có hoặc tìm lại bằng key idempotency. Đây là lớp bảo vệ backend cho trường hợp mạng chập chờn, client retry hoặc hai tab gửi lại cùng request.

### 6.3. Delivered, seen/read và unread

Backend lưu trạng thái đọc/nhận theo từng member trong conversation. Các marker chính gồm:

- `lastDeliveredMessageId`, `lastDeliveredAt`.
- `lastSeenMessageId`, `lastSeenAt`.
- `lastReadMessageId`, `lastReadAt`.
- `unreadCount`.

Marker được cập nhật theo hướng monotonic: nếu một tab gửi marker cũ hơn sau khi tab khác đã đánh dấu mới hơn, backend không hạ state và không phát stale event. Khi marker tiến lên, backend phát event để các member liên quan và các tab khác của chính actor cùng đồng bộ unread/read marker.

Khi gửi tin mới, unread của recipient được tăng bằng update atomic để tránh mất cập nhật khi có nhiều request gửi đồng thời.

### 6.4. Sửa, thu hồi và xóa tin nhắn

Backend hỗ trợ sửa tin nhắn trong cửa sổ thời gian được usecase kiểm soát. Với luồng canonical hiện tại, test xác nhận edit trong 30 giây được chấp nhận và edit quá hạn bị từ chối.

Các hành động quản lý tin nhắn:

- Delete for me: chỉ ẩn/xóa ở phía user hiện tại bằng `deletedForUserIds`.
- Revoke/recall: thu hồi tin nhắn theo điều kiện thời gian/quyền, cập nhật trạng thái revoked và phát realtime event.
- Delete for everyone: xóa theo nghĩa tombstone/toàn cuộc trò chuyện, đồng bộ tới các member.
- Bulk delete: xóa nhiều tin cho user hiện tại trong một conversation.

System message và message không còn active bị chặn ở các hành động không phù hợp như forward, quote hoặc react.

### 6.5. Forward, quote, reaction và pin

Người dùng có thể forward tin nhắn sang conversation khác nếu message hợp lệ. Khi forward text chứa link, backend có thể phân loại thành link message để hỗ trợ search media/link.

Quote/reply lưu tham chiếu tới message gốc và preview ổn định theo loại message. Reaction được lưu theo message/user/emoji, có thể thêm, xóa hoặc clear toàn bộ reactions khi có quyền. Pin message được hỗ trợ cho private và group theo rule quyền hiện tại; private cho phép cả hai bên pin, group phụ thuộc role/permission.

### 6.6. Tin nhắn có thời hạn và phân loại nội dung

Message có thể có `expiresAt` và TTL DynamoDB để tự hết hạn. Khi load/search, backend lọc các tin đã hết hạn, đã revoked hoặc đã bị delete-for-me tùy ngữ cảnh.

Media và link được classify riêng để hỗ trợ tìm kiếm theo ảnh, video, voice, file và link trong conversation.

---

## 7. Quản trị Nhóm

### 7.1. Vai trò và quyền nhóm

Nhóm có ba vai trò chính:

- Owner: quyền cao nhất trong nhóm.
- Admin: quyền quản trị theo phạm vi được phép.
- Member: quyền thành viên thông thường.

Backend kiểm tra role trước các thao tác nhạy cảm như thêm/xóa thành viên, set admin, chuyển owner, cập nhật thông tin nhóm, cập nhật settings, duyệt thành viên, giải tán nhóm, quản lý poll/reminder/note và pin.

### 7.2. Thêm, xóa, rời nhóm và duyệt thành viên

Group settings điều khiển ai được thêm thành viên và việc thêm thành viên có cần duyệt hay không. Nếu `requireApproval` bật, thành viên mới có thể ở trạng thái `pending` cho đến khi owner/admin approve. Pending member có thể bị reject.

Thành viên có thể rời nhóm. Khi owner rời nhóm, backend tự chuyển owner cho admin/thành viên phù hợp theo rule hiện tại để nhóm không bị thiếu chủ sở hữu.

Admin/owner có thể xóa thành viên nếu đủ quyền. Khi thành viên rời hoặc bị xóa, backend cập nhật member state và phát event realtime cho nhóm.

### 7.3. Cài đặt nhóm

Group settings hiện hỗ trợ:

- Cho phép hoặc chặn gửi link.
- Bật/tắt yêu cầu duyệt thành viên.
- Cho phép member invite.
- Quy định ai được gửi tin: tất cả hoặc admin.
- Quy định ai được thêm thành viên: tất cả hoặc admin.
- Quyền tạo/quản lý poll, reminder và note: tất cả hoặc admin.

Nếu nhóm đặt chế độ chỉ admin được gửi tin, member thường không gửi được message. Nếu nhóm chặn link, link message bị từ chối.

### 7.4. Thông tin nhóm và giải tán nhóm

Backend hỗ trợ xem/cập nhật thông tin nhóm, bao gồm các metadata như tên và avatar theo source hiện tại. Owner/admin có thể thực hiện thay đổi nếu đủ quyền. Nhóm có thể bị giải tán theo thao tác quản trị, sau đó backend đồng bộ realtime cho các member liên quan.

---

## 8. Tiện ích Nhóm

### 8.1. Poll

Poll thuộc về group conversation. Poll có câu hỏi, danh sách lựa chọn, người tạo, trạng thái active/closed, số vote, cấu hình chọn một hoặc nhiều lựa chọn, cho phép thêm option, hiển thị hoặc ẩn kết quả trước khi đóng.

Người dùng có quyền có thể:

- Tạo poll.
- Xem danh sách poll trong nhóm.
- Vote poll.
- Khóa/đóng poll.
- Pin/unpin poll.
- Xem kết quả poll.

Khi poll ẩn kết quả trước khi đóng, member thường chỉ thấy kết quả phù hợp với rule; manager hoặc sau khi poll đóng có thể xem đầy đủ.

### 8.2. Reminder

Reminder trong nhóm có title, description, thời điểm nhắc, status và người tạo. Backend hỗ trợ list, create, update và delete reminder theo quyền utility của nhóm.

### 8.3. Note

Note trong nhóm có title, content, người tạo và người cập nhật. Backend hỗ trợ list, create, update và delete note theo quyền utility của nhóm.

Các thay đổi poll/reminder/note có realtime event để client trong nhóm cập nhật.

---

## 9. Media, My Cloud và My Document

### 9.1. Media upload

Backend hỗ trợ hai hướng upload:

- Upload file qua backend bằng multipart.
- Request presigned URL để client upload trực tiếp lên S3-compatible storage, sau đó confirm metadata.

Media có thể được dùng làm attachment trong tin nhắn hoặc lưu vào My Cloud. Backend có cấu hình giới hạn dung lượng, MIME type và storage local/cloud theo environment.

### 9.2. My Cloud

My Cloud là kho lưu cá nhân cho file, image, video, voice, link và note. Người dùng có thể:

- Tạo/list/search item.
- Upload file vào My Cloud.
- Pin/unpin item.
- Soft delete, restore, permanent delete.
- Batch delete và empty trash.
- Share item bằng share token.
- Forward item vào chat.
- Xem thống kê.

Item có thể thuộc collection. Backend hỗ trợ tạo/list/cập nhật/xóa collection, thêm item vào collection và gỡ item khỏi collection.

### 9.3. My Document

My Document được thể hiện như một luồng lưu message vào không gian cá nhân. Người dùng có thể lưu các message đã chọn, đặc biệt file và link, vào My Cloud/My Document. Conversation My Document có rule sắp xếp riêng trong inbox: khi unpinned vẫn được ưu tiên cao hơn conversation thường, và khi pinned thì sắp xếp theo `pinnedAt` cùng các conversation pinned khác.

---

## 10. Tìm kiếm

Backend có search theo nhiều phạm vi:

- Tìm user theo display name, username và phone, có áp dụng privacy.
- Tìm message trong private/group conversation, có context, date range và visibility filter.
- Tìm media/link theo conversation và loại nội dung.
- Tìm group theo tên nhóm hoặc thành viên active.
- Global message search có cursor ổn định.
- Tìm trong My Cloud.

Search tôn trọng block, privacy, membership, hidden cutoff, revoked/expired/deleted-for-me message và quyền nhìn thấy dữ liệu.

---

## 11. Cuộc gọi

Backend hỗ trợ cuộc gọi audio/video qua LiveKit Cloud. Call gắn với một conversation và có thể là private hoặc group.

Luồng chính:

- Caller tạo call với conversation, loại call và danh sách callee.
- Backend tạo room LiveKit, call session runtime và mời người nhận.
- Người nhận có thể join, reject, leave hoặc bị mark missed.
- Backend chặn trường hợp conversation đã có call active.
- Người dùng đang ở call khác được đánh dấu busy.
- Private call có callee busy sẽ kết thúc theo trạng thái missed.
- Group call vẫn có thể tiếp tục với người available dù một số người busy.
- Khi không ai join trước timeout, call chuyển missed.
- Khi call kết thúc, backend có thể ghi call message vào chat log với trạng thái completed, missed, rejected hoặc cancelled.

Call session hiện là runtime memory service; call log trong chat là dữ liệu bền vững hơn cho lịch sử tin nhắn.

---

## 12. AI Helpers

Backend có nhóm AI route được bảo vệ bằng auth, dùng Google Gemini làm provider. Các nghiệp vụ hiện hỗ trợ:

- Tóm tắt nội dung.
- Gợi ý trả lời thông minh.
- Điều chỉnh giọng văn.
- Dịch văn bản.
- Detect language.

AI helpers phục vụ trải nghiệm chat nhưng không thay thế business rule chính của chat. Provider, model, token limit và temperature lấy từ environment.

---

## 13. Đồng bộ Realtime và Multi-tab

Socket.IO là kênh realtime chính. Sau khi socket xác thực thành công, backend quản lý user room, conversation subscription, heartbeat, presence và các event nghiệp vụ.

Các nhóm event realtime chính:

- Tin nhắn mới, sửa, xóa, thu hồi, delete-for-everyone.
- Delivered/seen/read state và unread sync.
- Reaction, quote, pin/unpin.
- Group member, role, owner, settings, dissolve.
- Poll, reminder, note.
- Presence và online status.
- Friend request/block notification.
- Call incoming/ringing/answered/rejected/ended/missed.

Đối với multi-tab trên cùng thiết bị hoặc cùng user, backend giữ mô hình một user có nhiều socket/tab. Các tab cùng user nhận event qua `user:{userId}`. Khi chính user gửi tin hoặc đánh dấu seen/delivered, các tab còn lại cũng nhận state mới để UI không bị lệch unread/read marker.

---

## 14. Ghi chú sử dụng tài liệu

Tài liệu này mô tả trạng thái backend hiện tại ở mức nghiệp vụ. Khi cần chi tiết endpoint, request/response hoặc schema, dùng `docs/API_SPEC.md` và Swagger. Khi cần chi tiết persistence, dùng `docs/DATABASE.md`. Khi cần hiểu luồng runtime, module setup hoặc deployment, dùng `docs/BE-ARCHITECTURE.md`.

Nếu source code, test và tài liệu cũ có khác biệt, ưu tiên source code và test hiện tại.
