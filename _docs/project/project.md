# BRD — MVP Ứng dụng mạng xã hội/chat kiểu Zalo

## 1) Tổng quan

### 1.1 Mục tiêu

Xây dựng **MVP** cho một ứng dụng mạng xã hội/chat kiểu Zalo để:

- Cho phép người dùng **đăng ký/đăng nhập**, **kết nối bạn bè**, **nhắn tin 1-1**, **tạo nhóm chat**, **chia sẻ media cơ bản**.
- Đo lường mức độ “dùng được” và nhu cầu cốt lõi trước khi mở rộng sang tính năng nâng cao.

### 1.2 Phạm vi MVP (In-scope)

- Tài khoản người dùng + hồ sơ cơ bản
- Danh bạ/bạn bè (kết bạn, chấp nhận, chặn)
- Chat 1-1
- Chat nhóm cơ bản
- Thông báo (push/in-app) cho tin nhắn & lời mời kết bạn
- Cài đặt cơ bản (đăng xuất, đổi mật khẩu, quyền riêng tư tối thiểu)

### 1.3 Ngoài phạm vi (Out-of-scope) cho MVP

- Gọi thoại/video
- Newsfeed/Timeline công khai, nhóm cộng đồng, trang cá nhân dạng mạng xã hội đầy đủ
- Ví điện tử/thanh toán, OA/Doanh nghiệp, mini app
- Sticker store, theme nâng cao
- Tìm bạn quanh đây, stories, live stream

---

## 2) Người dùng mục tiêu & giả định

### 2.1 Persona chính

- Người dùng phổ thông cần **nhắn tin nhanh**, tạo nhóm lớp/nhóm công việc nhỏ
- Nhóm bạn bè/gia đình cần **chat nhóm** + gửi ảnh

### 2.2 Giả định

- Người dùng có số điện thoại/email để đăng ký
- Ưu tiên trải nghiệm: **nhắn tin ổn định**, “vào là chat được”

---

## 3) Danh sách tính năng cốt lõi (Core Features)

### 3.1 Onboarding & Tài khoản

- Đăng ký tài khoản (email/số điện thoại)
- Đăng nhập/đăng xuất
- Quên mật khẩu/đặt lại mật khẩu
- Xác thực cơ bản (OTP nếu dùng số điện thoại — tùy chọn, có thể mock trong MVP)

### 3.2 Hồ sơ người dùng (Profile)

- Xem/sửa hồ sơ: ảnh đại diện, tên hiển thị, mô tả ngắn
- Trạng thái online (tối thiểu: online/offline)

### 3.3 Kết nối bạn bè & Danh bạ

- Tìm kiếm người dùng theo số điện thoại/email/username
- Gửi lời mời kết bạn
- Chấp nhận/từ chối lời mời
- Danh sách bạn bè
- Chặn người dùng (block) + bỏ chặn

### 3.4 Chat 1-1

- Danh sách cuộc trò chuyện (conversation list)
- Gửi/nhận tin nhắn real-time (text)
- Đã gửi/đã nhận/đã xem (tối thiểu: delivered/seen)
- Gửi ảnh (tối thiểu 1 ảnh/lần), gửi file (tùy chọn)
- Thu hồi tin nhắn (optional cho MVP; có thể để backlog)

### 3.5 Chat nhóm

- Tạo nhóm từ danh sách bạn bè
- Thêm/xoá thành viên (admin)
- Đổi tên nhóm, ảnh nhóm
- Nhắn tin text/ảnh tương tự 1-1
- Rời nhóm

### 3.6 Thông báo

- Thông báo có tin nhắn mới
- Thông báo lời mời kết bạn
- Badge/số lượng chưa đọc theo cuộc trò chuyện

### 3.7 Cài đặt & Quyền riêng tư tối thiểu

- Đổi mật khẩu
- Tắt/bật thông báo
- Quyền riêng tư tối thiểu: ai có thể tìm thấy bạn (email/sđt) (optional)

---

## 4) User Stories (Main Stories)

> Format: **As a [vai trò], I want [mục tiêu], so that [lợi ích].**

### 4.1 Đăng ký/Đăng nhập

1. **As a người dùng mới**, tôi muốn **đăng ký tài khoản bằng số điện thoại/email**, để **bắt đầu sử dụng ứng dụng**.
2. **As a người dùng**, tôi muốn **đăng nhập**, để **truy cập danh bạ và tin nhắn của mình**.
3. **As a người dùng**, tôi muốn **quên mật khẩu và đặt lại**, để **khôi phục tài khoản khi bị quên**.

### 4.2 Thiết lập hồ sơ

4. **As a người dùng**, tôi muốn **cập nhật tên hiển thị và ảnh đại diện**, để **bạn bè dễ nhận ra tôi**.
5. **As a người dùng**, tôi muốn **xem hồ sơ người khác**, để **xác nhận đúng người trước khi kết bạn**.

### 4.3 Kết bạn & quản lý bạn bè

6. **As a người dùng**, tôi muốn **tìm kiếm người khác bằng số điện thoại/email/username**, để **kết nối nhanh**.
7. **As a người dùng**, tôi muốn **gửi lời mời kết bạn**, để **có thể nhắn tin với họ**.
8. **As a người dùng**, tôi muốn **chấp nhận/từ chối lời mời kết bạn**, để **quản lý danh sách bạn bè của mình**.
9. **As a người dùng**, tôi muốn **xem danh sách bạn bè**, để **bắt đầu chat nhanh**.
10. **As a người dùng**, tôi muốn **chặn một người**, để **không nhận tin nhắn/lời mời từ họ**.

### 4.4 Chat 1-1

11. **As a người dùng**, tôi muốn **bắt đầu cuộc trò chuyện 1-1 với bạn bè**, để **trao đổi trực tiếp**.
12. **As a người dùng**, tôi muốn **gửi tin nhắn văn bản**, để **liên lạc nhanh**.
13. **As a người dùng**, tôi muốn **nhận tin nhắn real-time**, để **trò chuyện liền mạch**.
14. **As a người dùng**, tôi muốn **xem trạng thái đã xem/đã nhận**, để **biết tin nhắn có được đọc chưa**.
15. **As a người dùng**, tôi muốn **gửi ảnh**, để **chia sẻ nội dung trực quan**.
16. **As a người dùng**, tôi muốn **xem danh sách cuộc trò chuyện và tin nhắn chưa đọc**, để **không bỏ lỡ thông tin**.

### 4.5 Chat nhóm

17. **As a người dùng**, tôi muốn **tạo nhóm chat từ danh sách bạn bè**, để **trò chuyện với nhiều người**.
18. **As a admin nhóm**, tôi muốn **thêm/xoá thành viên**, để **quản lý nhóm**.
19. **As a người dùng**, tôi muốn **đổi tên nhóm/ảnh nhóm**, để **nhận diện nhóm dễ hơn**.
20. **As a người dùng**, tôi muốn **rời nhóm**, để **không còn nhận tin nhắn từ nhóm đó**.

### 4.6 Thông báo

21. **As a người dùng**, tôi muốn **nhận thông báo khi có tin nhắn mới**, để **phản hồi kịp thời**.
22. **As a người dùng**, tôi muốn **nhận thông báo khi có lời mời kết bạn**, để **xử lý yêu cầu kết nối**.
23. **As a người dùng**, tôi muốn **tắt/bật thông báo**, để **kiểm soát sự gián đoạn**.

---

## 5) Tiêu chí thành công (Success Metrics) — gợi ý cho MVP

- Activation: % người đăng ký xong và gửi tin nhắn đầu tiên trong 24h
- Messaging: số tin nhắn/người/ngày, % người dùng quay lại D1/D7
- Social graph: số lời mời kết bạn gửi/accept rate
- Reliability: tỉ lệ gửi tin thành công, độ trễ nhận tin (p95)

---

## 6) Yêu cầu phi chức năng (Non-functional) — mức tối thiểu

- Bảo mật: mã hoá truyền tải (HTTPS), hash mật khẩu
- Hiệu năng: chat real-time ổn định cho nhóm nhỏ (<=50 thành viên)
- Tin cậy: không mất tin nhắn; retry cơ bản khi mất kết nối
- Logging & monitoring: ghi nhận lỗi gửi/nhận tin, đăng nhập, upload ảnh

---

## 7) Backlog ưu tiên sau MVP (tham khảo)

- Gọi thoại/video
- Đồng bộ danh bạ tự động + gợi ý kết bạn
- Tin nhắn thoại, sticker
- Thu hồi tin nhắn, ghim tin nhắn
- Story/Newsfeed, page/official account
- Multi-device sync đầy đủ
