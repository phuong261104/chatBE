# ChatBE Recruiter Demo

Tài liệu này mô tả bộ dữ liệu do `npm run seed:recruiter` tạo ra. Seed dùng
chung một file nguồn là `src/tools/seed-demo.ts`, có thể chạy lại an toàn, khôi
phục profile/mật khẩu cố định và chỉ bổ sung những scenario còn thiếu.

## Chạy seed trên VPS

Sau khi pull code và build lại image:

```bash
cd /opt/chatBE

docker compose \
  --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build

docker compose \
  --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  exec backend npm run seed:recruiter
```

Không ghi mật khẩu demo vào Git. Tất cả tài khoản bên dưới dùng chung giá trị
`DEMO_PASSWORD` trong `.env.production`.

## Tài khoản và trạng thái có sẵn

| Tài khoản | Số điện thoại | Vai trò/scenario |
| --- | --- | --- |
| `user1` | `0910000001` | Tài khoản chính, owner nhóm, có blocked user và nhận message request |
| `user2` | `0910000002` | Bạn của user1, admin nhóm, tài khoản thứ hai để test realtime |
| `user3` | `0910000003` | Member nhóm, dữ liệu AI context, poll và reaction |
| `user4` | `0910000004` | Member nhóm, bạn của user5, dữ liệu media/search |
| `user5` | `0910000005` | Bạn của user4, đang gửi friend request tới user1 |
| `user6` | `0910000006` | Bị user1 chặn |
| `user7` | `0910000007` | Người lạ gửi message request tới user1 |
| `user8` | `0910000008` | Profile riêng tư, ẩn phone/presence và chặn tin từ người lạ |

Email tương ứng là `user1@test.com` đến `user8@test.com`. Frontend hiện đăng
nhập bằng số điện thoại, vì vậy nên đưa cho nhà tuyển dụng hai tài khoản chính:

```text
Tài khoản 1: 0910000001
Tài khoản 2: 0910000002
Mật khẩu   : <giá trị DEMO_PASSWORD bạn đã cấu hình>
```

## Dữ liệu được tạo

- Profile đầy đủ gồm avatar/cover trên MinIO, bio, birthday, gender và các mức
  privacy khác nhau.
- Friendships, một friend request đang chờ, mutual friend, block list và user
  suggestion.
- Ba private conversation, một group `Seed Demo Group`, owner/admin/member.
- Text, keyword tìm kiếm, link, image, file, profile card và Saved Messages.
- Reaction, quote/reply, pinned message, nickname, wallpaper và draft.
- Poll có vote, reminder được pin, group note và invite link.
- Một message request từ người lạ.
- Nội dung hội thoại đủ ngữ cảnh để thử summary, smart reply, smart search và
  task extraction bằng Gemini.

## Checklist kiểm thử khuyến nghị

1. Đăng nhập `user1` ở trình duyệt thường và `user2` ở cửa sổ ẩn danh.
2. Mở private chat user1-user2; kiểm tra typing, online presence, gửi/nhận
   realtime, delivered/read receipt, edit, recall, reaction, quote và pin.
3. Tìm `TUYENDUNG_CHATBE_2026` và `CHATBE_GROUP_FULL_FEATURE`; mở tab
   media/link/file và tải file từ MinIO.
4. Mở `Seed Demo Group`; kiểm tra danh sách member, quyền owner/admin/member,
   poll, vote, reminder, note, invite link và group settings.
5. Trong user1, kiểm tra incoming friend request của user5, message request của
   user7 và block list có user6.
6. Từ user1 thử nhắn user8; backend phải từ chối do privacy. So sánh public
   profile/presence của user2 và user8.
7. Kiểm tra Saved Messages, draft, nickname và wallpaper trong conversation
   user1-user2.
8. Thực hiện audio/video call giữa user1-user2 để kiểm tra LiveKit; kết thúc
   call và kiểm tra call log.
9. Chạy AI summary/smart reply/task extraction trên conversation user1-user3.
10. Upload một ảnh mới qua frontend để xác nhận presigned upload, MinIO public
    URL và CORS qua Cloudflare Tunnel.

Typing, read receipt, call và AI là luồng động nên seed chỉ chuẩn bị người dùng
và ngữ cảnh; nhà tuyển dụng cần thao tác trực tiếp để đánh giá realtime và dịch
vụ cloud còn hoạt động.
