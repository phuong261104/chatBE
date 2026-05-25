# Chat Advanced Messages Live E2E

File test: `tests/chat-advanced-messages.live.e2e.test.ts`

Suite này kiểm lại cùng các nghiệp vụ tin nhắn nâng cao như mock E2E, nhưng chạy qua HTTP routes, Socket.IO `/messages`, repositories DynamoDB thật và dữ liệu được cleanup sau mỗi test.

Luồng chính:
- Gửi tin nhắn bằng canonical HTTP và socket, kiểm tra message được lưu DB, emit `receiveMessage`, TTL tạo `expiresAt/expireAtEpoch` và message hết hạn không còn xuất hiện khi load/search.
- Sửa tin nhắn bằng canonical HTTP và socket, kiểm tra chỉ sửa được trong 30 giây, có `editedAt`, emit `message:edited`, quá hạn bị từ chối.
- Delivered/read dùng HTTP /v1 và socket, kiểm tra `lastDeliveredMessageId`, `lastSeenMessageId`, `lastReadMessageId`, `unreadCount`; marker stale không broadcast và actor tabs cũng nhận state sync.
- Send retry dùng `clientMessageId` không tạo duplicate message hoặc tăng unread lần hai.
- Recall/delete dùng HTTP v1 và socket, kiểm tra tombstone `"Tin nhắn đã được thu hồi"`, message bị revoke toàn cục, delete-for-me chỉ ẩn với người xóa.
- Reply/forward/pin/reaction dùng HTTP v1 fallback và socket tương ứng, kiểm tra quote preview, forwarded metadata, quyền pin private/group, reaction aggregate và remove.

Cách chạy live suite:

```powershell
$env:RUN_LIVE_CHAT_E2E='true'
npm test -- --runInBand tests/chat-advanced-messages.live.e2e.test.ts
```

Nếu không bật `RUN_LIVE_CHAT_E2E=true`, suite này sẽ được skip để tránh ghi dữ liệu vào DB thật ngoài ý muốn.
