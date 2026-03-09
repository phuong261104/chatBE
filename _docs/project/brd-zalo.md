# BRD — MVP Ứng dụng mạng xã hội/chat kiểu Zalo

**Document Version:** v0.1  
**Prepared by:** (Điền tên BA/PM)  
**Project:** MVP Ứng dụng chat + kết nối bạn bè (Zalo-like)

---

## 1. Executive Summary

Dự án nhằm xây dựng **MVP** cho một ứng dụng chat/mạng xã hội kiểu Zalo, tập trung vào các nhu cầu cốt lõi: **đăng ký/đăng nhập**, **thiết lập hồ sơ cơ bản**, **kết bạn & danh bạ**, **nhắn tin 1-1**, **chat nhóm**, và **chia sẻ media cơ bản**, kèm **thông báo** (in-app/push) để đảm bảo người dùng không bỏ lỡ tin nhắn hoặc lời mời kết bạn.

Mục tiêu kinh doanh của MVP là kiểm chứng nhanh mức độ “dùng được” của trải nghiệm nhắn tin và kết nối, qua các chỉ số như: tỷ lệ kích hoạt (đăng ký xong và gửi tin đầu tiên), tần suất nhắn tin/ngày, tỷ lệ quay lại (D1/D7), tỷ lệ chấp nhận lời mời kết bạn, độ tin cậy và độ trễ của hệ thống nhắn tin.

MVP sẽ **không** bao gồm các tính năng nâng cao như gọi thoại/video, newsfeed/timeline công khai, thanh toán/mini app, stories/livestream, cửa hàng sticker/theme nâng cao… nhằm tránh mở rộng phạm vi quá sớm. Dự án hướng đến một phiên bản đủ dùng để thử nghiệm với nhóm người dùng nhỏ trước, thu thập phản hồi và dữ liệu, từ đó ưu tiên phát triển các tính năng giai đoạn tiếp theo.

---

## 2. Project Objectives

Các mục tiêu theo hướng SMART (có thể đo lường, khả thi, liên quan và có mốc thời gian):

1. **O1 — Ra mắt MVP khả dụng:** Phát hành MVP có đầy đủ các luồng: tài khoản, hồ sơ, kết bạn, chat 1-1, chat nhóm, thông báo, cài đặt cơ bản.
2. **O2 — Tối ưu “vào là chat được”:** Người dùng mới hoàn tất đăng ký/đăng nhập và gửi tin nhắn đầu tiên trong một phiên sử dụng.
3. **O3 — Xác nhận nhu cầu chat & kết nối:** Có đủ dữ liệu về hành vi nhắn tin và kết bạn để đánh giá product-market fit bước đầu.
4. **O4 — Đảm bảo độ tin cậy tối thiểu:** Tin nhắn không bị mất, có cơ chế retry cơ bản khi mất kết nối, có theo dõi lỗi & logging.

---

## 3. Project Scope

### 3.1 In Scope (Phạm vi MVP)

- **Tài khoản & onboarding:** đăng ký/đăng nhập/đăng xuất, quên mật khẩu/đặt lại, xác thực cơ bản (OTP tùy chọn / mock).
- **Hồ sơ cơ bản:** ảnh đại diện, tên hiển thị, mô tả ngắn; trạng thái online tối thiểu (online/offline).
- **Danh bạ & bạn bè:** tìm kiếm người dùng (sđt/email/username), gửi lời mời, chấp nhận/từ chối, danh sách bạn bè, chặn/bỏ chặn.
- **Chat 1-1:** danh sách hội thoại, nhắn tin real-time (text), trạng thái delivered/seen, gửi ảnh tối thiểu.
- **Chat nhóm:** tạo nhóm, thêm/xóa thành viên (admin), đổi tên/ảnh nhóm, nhắn text/ảnh, rời nhóm.
- **Thông báo:** tin nhắn mới, lời mời kết bạn, badge số chưa đọc theo hội thoại.
- **Cài đặt cơ bản:** đổi mật khẩu, bật/tắt thông báo, quyền riêng tư tối thiểu (ai có thể tìm thấy bạn) — tùy chọn.

### 3.2 Out of Scope (Ngoài phạm vi MVP)

- Gọi thoại/video
- Newsfeed/Timeline công khai, nhóm cộng đồng, trang cá nhân dạng mạng xã hội đầy đủ
- Ví điện tử/thanh toán, OA/doanh nghiệp, mini app
- Sticker store, theme nâng cao
- Tìm bạn quanh đây, stories, live stream
- Multi-device sync đầy đủ (chỉ ưu tiên mức tối thiểu phục vụ MVP)

---

## 4. Business Requirements

> Định dạng: “**Doanh nghiệp cần có khả năng…**” (tập trung vào _cái gì cần đạt_, không mô tả _cách triển khai kỹ thuật_).

### 4.1 Business Process Overview

**Quy trình chính (To-be) trong MVP**

1. **Onboarding**
   - Người dùng mở app → đăng ký (email/sđt) hoặc đăng nhập
   - Nếu quên mật khẩu → yêu cầu đặt lại → đăng nhập thành công
   - Thiết lập hồ sơ cơ bản (tên/ảnh) → bắt đầu kết nối/chat

2. **Kết bạn**
   - Người dùng tìm kiếm theo sđt/email/username → xem hồ sơ → gửi lời mời
   - Người nhận nhận thông báo → chấp nhận/từ chối
   - Nếu chấp nhận → trở thành bạn bè → có thể chat 1-1

3. **Chat 1-1**
   - Người dùng chọn bạn trong danh sách → mở hội thoại → gửi tin nhắn
   - Người nhận nhận tin real-time + thông báo (nếu bật)
   - Trạng thái tin nhắn: đã nhận/đã xem

4. **Chat nhóm**
   - Người dùng tạo nhóm từ danh sách bạn bè → đặt tên/ảnh nhóm
   - Admin thêm/xóa thành viên → mọi người chat text/ảnh
   - Thành viên có thể rời nhóm

5. **Thông báo**
   - Tin nhắn mới / lời mời kết bạn → thông báo push/in-app
   - Badge chưa đọc cập nhật theo hội thoại

### 4.2 Stakeholder Analysis

| Nhóm stakeholder             | Vai trò                      | Nhu cầu/quan tâm chính                                  | Mức ảnh hưởng |
| ---------------------------- | ---------------------------- | ------------------------------------------------------- | ------------- |
| Người dùng cuối              | Người sử dụng app            | Chat nhanh, ổn định, dễ tìm bạn, không bỏ lỡ tin        | Rất cao       |
| Product Owner/PM             | Quyết định phạm vi & ưu tiên | Ra MVP đúng scope, đo được chỉ số                       | Rất cao       |
| Customer Support (CS)        | Hỗ trợ người dùng            | Có thông tin lỗi, luồng khôi phục tài khoản             | Trung bình    |
| Dev team                     | Xây dựng hệ thống            | Requirement rõ ràng, ưu tiên rủi ro (real-time, upload) | Cao           |
| QA                           | Kiểm thử                     | Tiêu chí chấp nhận rõ, luồng end-to-end                 | Cao           |
| Ops/Monitoring               | Vận hành                     | Logging, theo dõi lỗi, cảnh báo sự cố                   | Trung bình    |
| Security/Compliance (nếu có) | Đảm bảo an toàn              | Mật khẩu, quyền riêng tư, dữ liệu người dùng            | Trung bình    |

### 4.3 Key Performance Indicators (KPIs)

**Nhóm KPI chính cho MVP**

- **Activation**
  - % người dùng hoàn tất đăng ký/đăng nhập và **gửi tin nhắn đầu tiên trong 24h**
- **Messaging**
  - Số tin nhắn/người/ngày
  - **Retention D1/D7** (tỷ lệ quay lại ngày 1/ngày 7)
- **Social graph**
  - Số lời mời kết bạn gửi/người
  - **Accept rate** (tỷ lệ chấp nhận lời mời)
- **Reliability**
  - Tỷ lệ gửi tin thành công
  - Độ trễ nhận tin (p95)
  - Tỷ lệ lỗi upload ảnh / tỷ lệ thất bại thông báo

> Gợi ý vận hành KPI: đo theo cohort tuần, theo nền tảng (web/mobile), và theo phiên bản app.

### 4.4 Business Requirements List (BR)

**BR-001 — Quản lý tài khoản người dùng**  
Doanh nghiệp cần có khả năng cho người dùng **đăng ký/đăng nhập/đăng xuất**, và **khôi phục tài khoản khi quên mật khẩu**.

**BR-002 — Hồ sơ người dùng tối thiểu để nhận diện**  
Doanh nghiệp cần có khả năng cho người dùng **tạo và cập nhật hồ sơ cơ bản** (tên hiển thị, ảnh đại diện, mô tả ngắn) để hỗ trợ nhận diện khi kết bạn/chat.

**BR-003 — Khả năng tìm kiếm & kết nối bạn bè**  
Doanh nghiệp cần có khả năng cho người dùng **tìm kiếm người dùng khác** (sđt/email/username) và thực hiện **gửi/nhận/chấp nhận/từ chối lời mời kết bạn**.

**BR-004 — Quản lý danh sách bạn bè & trạng thái quan hệ**  
Doanh nghiệp cần có khả năng hiển thị **danh sách bạn bè**, hỗ trợ **chặn/bỏ chặn** để bảo vệ trải nghiệm và an toàn người dùng.

**BR-005 — Nhắn tin 1-1 liền mạch**  
Doanh nghiệp cần có khả năng để người dùng **nhắn tin 1-1 theo thời gian thực**, có danh sách hội thoại, và hiển thị trạng thái tối thiểu **đã nhận/đã xem**.

**BR-006 — Chat nhóm cơ bản phục vụ nhóm nhỏ**  
Doanh nghiệp cần có khả năng để người dùng **tạo nhóm chat**, quản lý thành viên theo vai trò admin, đổi tên/ảnh nhóm, và nhắn tin nhóm (text/ảnh).

**BR-007 — Chia sẻ media cơ bản**  
Doanh nghiệp cần có khả năng cho phép người dùng **gửi ảnh** trong chat (mức tối thiểu: 1 ảnh/lần) để tăng giá trị giao tiếp.

**BR-008 — Thông báo để giảm bỏ lỡ tương tác**  
Doanh nghiệp cần có khả năng gửi **thông báo tin nhắn mới** và **thông báo lời mời kết bạn**, đồng thời hiển thị **badge chưa đọc** theo hội thoại.

**BR-009 — Cài đặt cơ bản & kiểm soát thông báo**  
Doanh nghiệp cần có khả năng cho người dùng **đổi mật khẩu**, **bật/tắt thông báo**, và (tùy chọn) **thiết lập quyền riêng tư tối thiểu** về khả năng被 tìm thấy.

**BR-010 — Đo lường & cải tiến dựa trên dữ liệu**  
Doanh nghiệp cần có khả năng thu thập dữ liệu tối thiểu phục vụ KPI: activation, messaging, social graph, reliability (theo dõi lỗi gửi/nhận tin, đăng nhập, upload ảnh).

---

## 5. High-Level Functional Requirements

> Đây là yêu cầu chức năng mức cao (có thể chuyển thành PRD/FRD chi tiết sau).

**FR-001 — Đăng ký/đăng nhập**

- Đăng ký bằng email hoặc số điện thoại
- Đăng nhập/đăng xuất
- Quên mật khẩu/đặt lại mật khẩu
- (Tùy chọn) OTP cho đăng ký bằng số điện thoại (có thể mock)

**FR-002 — Hồ sơ người dùng**

- Xem/sửa ảnh đại diện, tên hiển thị, mô tả ngắn
- Hiển thị trạng thái online/offline

**FR-003 — Tìm kiếm & kết bạn**

- Tìm theo sđt/email/username
- Xem hồ sơ người khác trước khi kết bạn
- Gửi lời mời; chấp nhận/từ chối
- Danh sách bạn bè
- Chặn/bỏ chặn

**FR-004 — Chat 1-1**

- Danh sách hội thoại
- Gửi/nhận tin nhắn text real-time
- Trạng thái delivered/seen
- Gửi ảnh (tối thiểu)
- Danh sách chưa đọc theo hội thoại

**FR-005 — Chat nhóm**

- Tạo nhóm từ danh sách bạn bè
- Thêm/xóa thành viên (admin)
- Đổi tên/ảnh nhóm
- Nhắn text/ảnh
- Rời nhóm

**FR-006 — Thông báo**

- Thông báo có tin nhắn mới (push/in-app)
- Thông báo lời mời kết bạn
- Badge số chưa đọc theo hội thoại

**FR-007 — Cài đặt**

- Đổi mật khẩu
- Bật/tắt thông báo
- (Tùy chọn) quyền riêng tư tối thiểu: ai có thể tìm thấy bạn (email/sđt)

---

## 6. High-Level Non-Functional Requirements

**NFR-001 — Bảo mật cơ bản**

- Truyền dữ liệu qua kết nối an toàn (ví dụ: HTTPS)
- Mật khẩu được lưu theo phương thức bảo mật (hash)
- Quyền riêng tư tối thiểu cho tìm kiếm người dùng (nếu bật)

**NFR-002 — Hiệu năng & độ trễ**

- Nhắn tin real-time ổn định cho nhóm nhỏ (≤ 50 thành viên)
- Theo dõi độ trễ nhận tin (p95) để đảm bảo trải nghiệm

**NFR-003 — Độ tin cậy**

- Không mất tin nhắn (ít nhất trong điều kiện hệ thống bình thường)
- Có retry cơ bản khi mất kết nối
- Trạng thái delivered/seen phản ánh đúng hành vi người dùng

**NFR-004 — Logging & Monitoring**

- Ghi nhận lỗi gửi/nhận tin, đăng nhập, upload ảnh
- Có khả năng thống kê phục vụ KPI tối thiểu

**NFR-005 — Khả dụng & mở rộng**

- Thiết kế MVP theo hướng có thể mở rộng lên các tính năng sau MVP (gọi thoại/video, sticker, multi-device…) mà không phá vỡ luồng cốt lõi

---

## 7. Assumptions

- Người dùng có **email hoặc số điện thoại** hợp lệ để đăng ký.
- MVP ưu tiên “**vào là chat được**”, nên UX sẽ tối giản: ít bước, ít cấu hình.
- OTP (nếu dùng số điện thoại) có thể được **mock** trong giai đoạn thử nghiệm nội bộ/đóng.
- Gửi ảnh mức tối thiểu (1 ảnh/lần) là đủ để kiểm chứng nhu cầu media trong chat.
- Các chỉ số KPI có thể được đo lường qua sự kiện hành vi (events) tối thiểu.

---

## 8. Constraints

- **Giới hạn phạm vi:** chỉ triển khai các chức năng cốt lõi như mục Scope; các tính năng nâng cao để backlog.
- **Giới hạn nguồn lực:** MVP ưu tiên tốc độ ra mắt và học từ dữ liệu, không tối ưu hóa mọi trường hợp biên (edge cases) ngay từ đầu.
- **Giới hạn vận hành:** hỗ trợ nhóm chat nhỏ (≤ 50) cho giai đoạn MVP để giảm rủi ro hiệu năng.

---

## 9. Dependencies

- Dịch vụ gửi **email/SMS** (phục vụ đăng ký, đặt lại mật khẩu, OTP nếu có).
- Dịch vụ **thông báo push** (phục vụ thông báo tin nhắn & lời mời).
- Lưu trữ ảnh/media (phục vụ gửi ảnh).
- Quy trình vận hành: logging/monitoring để theo dõi lỗi và KPI.
- Chính sách/quy định nội bộ về dữ liệu người dùng và quyền riêng tư (nếu tổ chức có yêu cầu riêng).

---

## 10. Glossary

- **MVP (Minimum Viable Product):** phiên bản tối thiểu đủ dùng để kiểm chứng nhu cầu và đo lường hành vi.
- **1-1 Chat:** trò chuyện giữa hai người dùng.
- **Group Chat:** trò chuyện nhóm nhiều người.
- **Delivered/Seen:** trạng thái “đã nhận/đã xem” của tin nhắn.
- **Badge:** số lượng chưa đọc hiển thị trên hội thoại/ứng dụng.
- **Retention D1/D7:** tỷ lệ người dùng quay lại sau 1 ngày/7 ngày kể từ lần đầu dùng.

---

## 11. Approvals

| Họ tên | Vai trò         | Chữ ký | Ngày |
| ------ | --------------- | ------ | ---- |
| (Điền) | Product Owner   |        |      |
| (Điền) | Project Manager |        |      |
| (Điền) | Tech Lead       |        |      |
| (Điền) | QA Lead         |        |      |

---

## Phụ lục — Tóm tắt bàn giao cho tài liệu yêu cầu chi tiết (URD/FRD)

- **Yêu cầu kinh doanh quan trọng nhất:** BR-005 (chat 1-1), BR-006 (chat nhóm), BR-003 (kết bạn), BR-008 (thông báo), BR-010 (đo KPI).
- **Stakeholder “cần ưu tiên” khi lấy yêu cầu chi tiết:** người dùng cuối, PO/PM, QA, Ops/Monitoring.
- **Giả định cần xác nhận sớm:** phương án OTP (mock hay thật), phạm vi quyền riêng tư tối thiểu, mức media (ảnh/file), kỳ vọng retention mục tiêu, kênh thông báo (push/in-app).
- **Điểm rủi ro cần chú ý khi đi vào FRD:** tính liền mạch real-time, trạng thái delivered/seen, đồng bộ chưa đọc/badge, upload ảnh và lỗi mạng.
