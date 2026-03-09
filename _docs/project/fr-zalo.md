# Functional Requirements Document (FRD) — MVP Ứng dụng chat/kết nối kiểu Zalo (Zalo-like)

**Document Version:** v0.1
**Prepared by:** (Điền tên BA/PM)
**Input tham chiếu:** BRD (brd-zalo), URD (urd-zalo)  
**Template:** FRD Template

---

## 1. Introduction

### 1.1 Mục đích

Tài liệu FRD mô tả **các yêu cầu chức năng chi tiết** cho MVP ứng dụng chat/kết nối bạn bè kiểu Zalo, nhằm chuyển hóa yêu cầu kinh doanh (BRD) và yêu cầu người dùng (URD) thành các chức năng **rõ ràng – không mơ hồ – kiểm thử được – truy vết được**.

### 1.2 Liên hệ với BRD/URD

- BRD xác định mục tiêu, phạm vi MVP và yêu cầu kinh doanh cốt lõi: tài khoản, hồ sơ, kết bạn, chat 1-1, chat nhóm, media, thông báo, cài đặt, đo lường.
- URD mô tả user stories, acceptance criteria, use cases và yêu cầu UI/usability/data theo góc nhìn người dùng.

### 1.3 Nguyên tắc viết yêu cầu (theo FRD-agent)

- Mỗi yêu cầu dùng dạng: **“Hệ thống phải …”** (tương đương “shall”).
- Có **Acceptance Criteria** theo Given–When–Then và có truy vết về BR/UR.

---

## 2. System Scope

### 2.1 In Scope (MVP)

Các chức năng nằm trong phạm vi MVP:

- Tài khoản: đăng ký/đăng nhập/đăng xuất, quên mật khẩu/đặt lại.
- Hồ sơ cơ bản: tên hiển thị, ảnh đại diện, mô tả ngắn; trạng thái online/offline tối thiểu.
- Kết bạn/danh bạ: tìm kiếm theo sđt/email/username; gửi/nhận/chấp nhận/từ chối; danh sách bạn; chặn/bỏ chặn.
- Chat 1-1: danh sách hội thoại; nhắn tin real-time (text); delivered/seen; chưa đọc; gửi ảnh tối thiểu.
- Chat nhóm: tạo nhóm, thêm/xóa thành viên (admin), đổi tên/ảnh nhóm, nhắn text/ảnh, rời nhóm.
- Thông báo: tin nhắn mới, lời mời kết bạn, badge chưa đọc theo hội thoại.
- Cài đặt: đổi mật khẩu, bật/tắt thông báo; quyền riêng tư tối thiểu (tùy chọn).

### 2.2 Out of Scope (Ngoài phạm vi MVP)

Không bao gồm các tính năng nâng cao: gọi thoại/video, newsfeed/timeline công khai, thanh toán/mini app, stories/live stream, sticker store/theme nâng cao…

### 2.3 Ràng buộc & phụ thuộc chính

- Nhóm chat nhỏ (≤ 50) trong giai đoạn MVP.
- Phụ thuộc dịch vụ email/SMS (đăng ký/OTP/đặt lại mật khẩu), push notification, lưu trữ ảnh/media, logging/monitoring.

---

## 3. Functional Requirements

> Ghi chú: Ưu tiên (Priority) dùng 3 mức: **Cao / Trung bình / Thấp**. “Nguồn” ghi BR-xxx và/hoặc UR-xxx.

### 3.1. User Management

#### FR-001 — Đăng ký tài khoản bằng email/số điện thoại

- **Mô tả:** Hệ thống phải cho phép người dùng đăng ký bằng **email hoặc số điện thoại** với mật khẩu hợp lệ.
- **Ưu tiên:** Cao
- **Nguồn:** BR-001; UR-001
- **Tiền điều kiện:** Người dùng chưa đăng nhập.
- **Hậu điều kiện:** Tài khoản được tạo; chuyển sang bước thiết lập hồ sơ cơ bản.
- **Tiêu chí chấp nhận:**
  - Given người dùng ở màn hình Đăng ký
  - When nhập email/sđt hợp lệ + mật khẩu và bấm “Đăng ký”
  - Then hệ thống tạo tài khoản thành công và đưa đến bước thiết lập hồ sơ cơ bản
  - And nếu dữ liệu không hợp lệ, hệ thống hiển thị lỗi rõ ràng tại trường nhập

#### FR-002 — (Tùy chọn) OTP cho đăng ký bằng số điện thoại

- **Mô tả:** Hệ thống **có thể** yêu cầu OTP khi đăng ký bằng số điện thoại; trong MVP có thể dùng cơ chế mock/giả lập.
- **Ưu tiên:** Thấp (nếu mock), Trung bình (nếu bật thật)
- **Nguồn:** FR-001 (BRD); giả định OTP có thể mock
- **Tiền điều kiện:** Người dùng chọn đăng ký bằng số điện thoại.
- **Hậu điều kiện:** Trạng thái xác thực số điện thoại được lưu (verified/unverified).
- **Tiêu chí chấp nhận:**
  - Given người dùng đăng ký bằng số điện thoại
  - When OTP được yêu cầu và nhập đúng
  - Then tài khoản được xác thực theo quy tắc MVP
  - And khi nhập sai/quá hạn, hệ thống báo lỗi và cho phép nhập lại trong giới hạn hợp lý

#### FR-003 — Đăng nhập / Đăng xuất

- **Mô tả:** Hệ thống phải cho phép người dùng đăng nhập bằng email/sđt + mật khẩu và đăng xuất.
- **Ưu tiên:** Cao
- **Nguồn:** BR-001; UR-002
- **Tiền điều kiện:** Có tài khoản hợp lệ.
- **Hậu điều kiện:**
  - Đăng nhập: vào màn hình chính (Hội thoại/Danh bạ).
  - Đăng xuất: phiên đăng nhập bị hủy; quay lại màn hình đăng nhập.

- **Tiêu chí chấp nhận:**
  - Given người dùng có tài khoản hợp lệ
  - When đăng nhập đúng thông tin
  - Then vào được danh sách hội thoại/danh bạ
  - And khi đăng xuất, người dùng được đưa về màn hình đăng nhập

#### FR-004 — Quên mật khẩu / Đặt lại mật khẩu

- **Mô tả:** Hệ thống phải hỗ trợ luồng “quên mật khẩu” bằng email/sđt đã đăng ký và cho phép đặt lại mật khẩu.
- **Ưu tiên:** Cao
- **Nguồn:** BR-001; UR-003
- **Tiền điều kiện:** Người dùng chưa đăng nhập; email/sđt tồn tại trong hệ thống.
- **Hậu điều kiện:** Mật khẩu mới được cập nhật; đăng nhập được bằng mật khẩu mới.
- **Tiêu chí chấp nhận:**
  - Given người dùng ở màn hình “Quên mật khẩu”
  - When nhập email/sđt đã đăng ký
  - Then hệ thống gửi hướng dẫn đặt lại (hoặc cơ chế tương đương trong MVP)
  - And sau khi đặt lại thành công, đăng nhập được bằng mật khẩu mới

#### FR-005 — Thiết lập & cập nhật hồ sơ cơ bản

- **Mô tả:** Hệ thống phải cho phép người dùng xem/sửa tên hiển thị, ảnh đại diện, mô tả ngắn để nhận diện khi tìm kiếm/kết bạn/chat.
- **Ưu tiên:** Cao
- **Nguồn:** BR-002; UR-004
- **Tiền điều kiện:** Người dùng đã đăng nhập.
- **Hậu điều kiện:** Hồ sơ cập nhật hiển thị đúng trong kết quả tìm kiếm và hội thoại.
- **Tiêu chí chấp nhận:**
  - Given người dùng ở trang Hồ sơ
  - When cập nhật tên/ảnh và lưu
  - Then hồ sơ hiển thị đúng ở kết quả tìm kiếm và trong hội thoại

#### FR-006 — Trạng thái online/offline tối thiểu

- **Mô tả:** Hệ thống phải hiển thị trạng thái online/offline tối thiểu của người dùng trong ngữ cảnh hội thoại/danh bạ.
- **Ưu tiên:** Trung bình
- **Nguồn:** FR-002 (BRD)
- **Tiền điều kiện:** Người dùng có phiên đăng nhập hợp lệ.
- **Hậu điều kiện:** Trạng thái được cập nhật theo quy tắc hệ thống (ví dụ: online khi app đang hoạt động).
- **Tiêu chí chấp nhận:**
  - Given người dùng A đang xem danh bạ/hội thoại
  - When người dùng B đang hoạt động trong app
  - Then A thấy B ở trạng thái “Online”
  - And khi B không hoạt động theo ngưỡng hệ thống, A thấy “Offline”

---

### 3.2. Data Management

#### FR-020 — Lưu trữ và truy xuất dữ liệu hội thoại & tin nhắn

- **Mô tả:** Hệ thống phải lưu trữ hội thoại và tin nhắn để người dùng có thể xem lại lịch sử chat; không làm mất tin nhắn trong điều kiện hệ thống bình thường.
- **Ưu tiên:** Cao
- **Nguồn:** BR-005; UC-004 (URD)
- **Tiền điều kiện:** Người dùng đã đăng nhập; có quyền truy cập hội thoại.
- **Hậu điều kiện:** Tin nhắn được lưu và xuất hiện trong lịch sử chat.
- **Tiêu chí chấp nhận:**
  - Given người dùng mở một hội thoại hợp lệ
  - When tải lịch sử hội thoại
  - Then hệ thống trả về danh sách tin nhắn theo thứ tự thời gian và hiển thị được cho người dùng
  - And tin nhắn đã gửi trước đó vẫn tồn tại khi tải lại hội thoại

#### FR-021 — Danh sách hội thoại + badge chưa đọc

- **Mô tả:** Hệ thống phải hiển thị danh sách hội thoại theo thời gian cập nhật gần nhất và hiển thị badge chưa đọc theo hội thoại.
- **Ưu tiên:** Cao
- **Nguồn:** BR-005; UR-009
- **Tiền điều kiện:** Người dùng đã đăng nhập.
- **Hậu điều kiện:** Người dùng thấy danh sách hội thoại + badge chưa đọc đúng.
- **Tiêu chí chấp nhận:**
  - Given người dùng đã đăng nhập
  - When vào màn hình Hội thoại
  - Then thấy danh sách hội thoại theo thời gian cập nhật gần nhất
  - And mỗi hội thoại có badge số chưa đọc nếu có

#### FR-022 — Quy tắc “chưa đọc” theo hội thoại

- **Mô tả:** Hệ thống phải tăng số chưa đọc khi có tin nhắn mới đến và giảm/đưa về 0 khi người dùng mở hội thoại (được coi là đọc theo phạm vi MVP).
- **Ưu tiên:** Cao
- **Nguồn:** UR-009; FR-006 (badge chưa đọc)
- **Tiền điều kiện:** Có hội thoại giữa các người dùng.
- **Hậu điều kiện:** Badge chưa đọc đồng bộ với trạng thái đọc.
- **Tiêu chí chấp nhận:**
  - Given hội thoại X đang có badge = N
  - When có thêm 1 tin nhắn mới đến hội thoại X
  - Then badge hội thoại X tăng lên N+1
  - When người dùng mở hội thoại X
  - Then badge hội thoại X về 0 (hoặc theo quy tắc “đã đọc” tối thiểu)

#### FR-023 — Lưu trữ và quản lý dữ liệu quan hệ bạn bè

- **Mô tả:** Hệ thống phải lưu và quản lý các trạng thái quan hệ: chưa kết bạn, đang chờ lời mời, bạn bè, bị chặn.
- **Ưu tiên:** Cao
- **Nguồn:** BR-003; BR-004; UR-005..UR-008
- **Tiền điều kiện:** Người dùng đã đăng nhập.
- **Hậu điều kiện:** Trạng thái quan hệ hiển thị và áp dụng đúng cho các hành động (kết bạn/chat/chặn).
- **Tiêu chí chấp nhận:**
  - Given người dùng A và B có trạng thái quan hệ xác định
  - When A xem hồ sơ B
  - Then hệ thống hiển thị đúng trạng thái (Ví dụ: “Kết bạn”, “Đã gửi lời mời”, “Bạn bè”, “Đã chặn”)

---

### 3.3. Reporting and Analytics

#### FR-050 — Thu thập dữ liệu sự kiện phục vụ KPI (telemetry tối thiểu)

- **Mô tả:** Hệ thống phải thu thập dữ liệu tối thiểu để đo các nhóm KPI: activation, messaging, social graph, reliability; bao gồm theo dõi lỗi gửi/nhận tin, đăng nhập, upload ảnh, thất bại thông báo.
- **Ưu tiên:** Trung bình (MVP), nhưng bắt buộc tối thiểu để đánh giá
- **Nguồn:** BR-010; URD Data Reporting
- **Tiền điều kiện:** Hệ thống có cơ chế ghi nhận sự kiện.
- **Hậu điều kiện:** Dữ liệu sự kiện sẵn sàng để tổng hợp theo cohort/phiên bản/nền tảng (tối thiểu).
- **Tiêu chí chấp nhận:**
  - Given người dùng thực hiện đăng ký/đăng nhập/gửi tin/gửi ảnh
  - When hành vi thành công hoặc thất bại
  - Then hệ thống ghi nhận sự kiện tương ứng (success/failure + timestamp + định danh tối thiểu)
  - And có thể trích xuất/tổng hợp để tính các KPI đã nêu trong BRD/URD

---

### 3.4. Integration

#### FR-060 — Tích hợp Email/SMS cho đặt lại mật khẩu và OTP (nếu bật)

- **Mô tả:** Hệ thống phải tích hợp dịch vụ email/SMS để phục vụ đặt lại mật khẩu và OTP (nếu áp dụng).
- **Ưu tiên:** Cao (đặt lại mật khẩu), Trung bình (OTP)
- **Nguồn:** Dependencies (BRD); FR-004/FR-002
- **Tiền điều kiện:** Có cấu hình nhà cung cấp email/SMS hoặc mock trong môi trường test.
- **Hậu điều kiện:** Tin nhắn email/SMS được gửi theo yêu cầu luồng nghiệp vụ.
- **Tiêu chí chấp nhận:**
  - Given người dùng yêu cầu đặt lại mật khẩu
  - When hệ thống tạo yêu cầu đặt lại hợp lệ
  - Then hệ thống gửi email/SMS theo cấu hình hoặc cơ chế tương đương trong MVP

#### FR-061 — Tích hợp dịch vụ Push Notification

- **Mô tả:** Hệ thống phải tích hợp dịch vụ push để gửi thông báo tin nhắn mới và lời mời kết bạn (tùy ngữ cảnh in-app/push trong MVP).
- **Ưu tiên:** Cao
- **Nguồn:** BR-008; FR-006
- **Tiền điều kiện:** Người dùng bật thông báo; thiết bị có token hợp lệ.
- **Hậu điều kiện:** Push được gửi và hiển thị theo quy tắc MVP.
- **Tiêu chí chấp nhận:**
  - Given người dùng bật thông báo
  - When có tin nhắn mới hoặc lời mời kết bạn
  - Then hệ thống gửi thông báo push/in-app theo cấu hình MVP

#### FR-062 — Tích hợp lưu trữ ảnh/media

- **Mô tả:** Hệ thống phải tích hợp nơi lưu trữ ảnh để hỗ trợ gửi ảnh trong chat (tối thiểu 1 ảnh/lần).
- **Ưu tiên:** Cao
- **Nguồn:** BR-007; UR-015
- **Tiền điều kiện:** Người dùng cấp quyền truy cập thư viện ảnh (trên mobile) / có file hợp lệ (web).
- **Hậu điều kiện:** Ảnh được upload và gắn vào tin nhắn; hiển thị trong luồng chat.
- **Tiêu chí chấp nhận:**
  - Given người dùng đang ở chat 1-1 hoặc nhóm
  - When chọn 1 ảnh và bấm gửi
  - Then hệ thống upload ảnh và hiển thị ảnh trong luồng chat

---

### 3.5. Workflow and Process Automation

#### FR-100 — Tìm kiếm người dùng theo sđt/email/username

- **Mô tả:** Hệ thống phải cho phép tìm kiếm người dùng theo sđt/email/username và trả về danh sách kết quả có tối thiểu tên + ảnh đại diện.
- **Ưu tiên:** Cao
- **Nguồn:** BR-003; UR-005
- **Tiền điều kiện:** Người dùng đã đăng nhập.
- **Hậu điều kiện:** Hiển thị kết quả phù hợp hoặc trạng thái “Không tìm thấy”.
- **Tiêu chí chấp nhận:**
  - Given người dùng ở màn hình Tìm kiếm
  - When nhập sđt/email/username và bấm tìm
  - Then hệ thống trả về danh sách kết quả phù hợp
  - And mỗi kết quả hiển thị tối thiểu tên + ảnh đại diện

#### FR-101 — Gửi lời mời kết bạn

- **Mô tả:** Hệ thống phải cho phép gửi lời mời kết bạn từ trang hồ sơ người khác; hiển thị trạng thái “Đã gửi lời mời” và gửi thông báo cho người nhận.
- **Ưu tiên:** Cao
- **Nguồn:** BR-003; UR-006
- **Tiền điều kiện:** Người gửi đăng nhập; không bị chặn; chưa là bạn bè.
- **Hậu điều kiện:** Lời mời ở trạng thái “pending”; người nhận có thông báo lời mời.
- **Tiêu chí chấp nhận:**
  - Given người dùng đang xem hồ sơ người khác
  - When bấm “Kết bạn/Gửi lời mời”
  - Then người kia nhận được thông báo lời mời
  - And trạng thái hiển thị “Đã gửi lời mời”

#### FR-102 — Chấp nhận / Từ chối lời mời kết bạn

- **Mô tả:** Hệ thống phải cho phép người nhận chấp nhận hoặc từ chối lời mời; nếu chấp nhận thì trở thành bạn bè và có thể mở chat 1-1.
- **Ưu tiên:** Cao
- **Nguồn:** BR-003; UR-007; UC-003
- **Tiền điều kiện:** Có lời mời đang chờ.
- **Hậu điều kiện:**
  - Chấp nhận: tạo quan hệ bạn bè + cho phép/khởi tạo hội thoại 1-1.
  - Từ chối: xóa lời mời khỏi danh sách chờ.

- **Tiêu chí chấp nhận:**
  - Given người dùng có lời mời kết bạn đến
  - When chọn “Chấp nhận”
  - Then hai bên trở thành bạn bè và có thể mở chat 1-1
  - When chọn “Từ chối”
  - Then lời mời bị loại bỏ khỏi danh sách chờ

#### FR-103 — Chặn / Bỏ chặn người dùng

- **Mô tả:** Hệ thống phải cho phép chặn/bỏ chặn; khi bị chặn thì không thể gửi lời mời/nhắn tin trong phạm vi MVP.
- **Ưu tiên:** Cao
- **Nguồn:** BR-004; UR-008
- **Tiền điều kiện:** Người dùng đã đăng nhập.
- **Hậu điều kiện:** Trạng thái chặn được áp dụng cho hành động kết bạn/nhắn tin.
- **Tiêu chí chấp nhận:**
  - Given người dùng đang xem hồ sơ/thiết lập quan hệ
  - When bấm “Chặn”
  - Then người bị chặn không thể gửi lời mời/nhắn tin cho tôi (MVP)
  - And có thể “Bỏ chặn” để khôi phục tương tác

#### FR-110 — Gửi tin nhắn text 1-1 theo thời gian thực

- **Mô tả:** Hệ thống phải cho phép gửi và nhận tin nhắn text real-time trong chat 1-1.
- **Ưu tiên:** Cao
- **Nguồn:** BR-005; UR-010; FR-004 (BRD)
- **Tiền điều kiện:** Hai người dùng là bạn bè (theo UC-004).
- **Hậu điều kiện:** Tin nhắn xuất hiện ngay ở phía người gửi và tới người nhận trong thời gian hợp lý (MVP).
- **Tiêu chí chấp nhận:**
  - Given người dùng đang ở màn hình chat 1-1
  - When gửi một tin nhắn text
  - Then tin nhắn xuất hiện ngay trong luồng chat của tôi
  - And người nhận thấy tin nhắn trong thời gian hợp lý (real-time MVP)

#### FR-111 — Trạng thái tin nhắn: “Đã nhận / Đã xem”

- **Mô tả:** Hệ thống phải hỗ trợ trạng thái delivered/seen tối thiểu cho tin nhắn 1-1, phản ánh đúng hành vi người dùng.
- **Ưu tiên:** Cao
- **Nguồn:** BR-005; UR-011
- **Tiền điều kiện:** Tin nhắn đã được gửi thành công.
- **Hậu điều kiện:** Tin nhắn hiển thị “Đã nhận” khi người nhận nhận được; “Đã xem” khi người nhận mở hội thoại và xem.
- **Tiêu chí chấp nhận:**
  - Given người dùng đã gửi tin nhắn
  - When hệ thống xác nhận người nhận đã nhận
  - Then tin nhắn hiển thị trạng thái “Đã nhận”
  - When người nhận mở hội thoại và xem tin
  - Then tin nhắn hiển thị trạng thái “Đã xem”

#### FR-112 — Retry cơ bản khi gửi tin thất bại do mất kết nối

- **Mô tả:** Khi mất kết nối lúc gửi tin, hệ thống phải hiển thị trạng thái “Gửi thất bại” và cho phép “Gửi lại” mà không mất nội dung.
- **Ưu tiên:** Cao
- **Nguồn:** NFR-003 (độ tin cậy); UC-004 Alternative Flow
- **Tiền điều kiện:** Người dùng đang gửi tin; mạng chập chờn/mất kết nối.
- **Hậu điều kiện:** Người dùng có thể gửi lại thành công khi mạng ổn định.
- **Tiêu chí chấp nhận:**
  - Given người dùng vừa bấm gửi tin
  - When hệ thống phát hiện gửi thất bại do kết nối
  - Then hiển thị “Gửi thất bại” và nút “Gửi lại”
  - And khi bấm “Gửi lại” sau khi có mạng, tin được gửi thành công và cập nhật trạng thái bình thường

#### FR-120 — Tạo nhóm chat (từ danh sách bạn bè) và đặt tên/ảnh nhóm

- **Mô tả:** Hệ thống phải cho phép tạo nhóm từ danh sách bạn bè; tên nhóm là bắt buộc; ảnh nhóm tùy chọn.
- **Ưu tiên:** Cao
- **Nguồn:** BR-006; UR-012
- **Tiền điều kiện:** Người tạo đã đăng nhập và có danh sách bạn bè.
- **Hậu điều kiện:** Nhóm được tạo và xuất hiện trong danh sách hội thoại.
- **Tiêu chí chấp nhận:**
  - Given người dùng đang ở danh sách hội thoại
  - When chọn “Tạo nhóm”, chọn thành viên, đặt tên (bắt buộc) và lưu
  - Then nhóm được tạo và xuất hiện trong danh sách hội thoại

#### FR-121 — Quản lý thành viên nhóm theo vai trò Admin

- **Mô tả:** Hệ thống phải cho phép admin thêm/xóa thành viên; thành viên bị xóa không còn truy cập nhóm trong phạm vi MVP.
- **Ưu tiên:** Cao
- **Nguồn:** BR-006; UR-013; UC-005
- **Tiền điều kiện:** Người thao tác là admin nhóm.
- **Hậu điều kiện:** Thành viên mới thấy nhóm trong hội thoại; thành viên bị xóa mất quyền truy cập.
- **Tiêu chí chấp nhận:**
  - Given người dùng là admin của nhóm
  - When thêm một bạn bè vào nhóm
  - Then thành viên mới thấy nhóm trong danh sách hội thoại
  - When xóa một thành viên
  - Then thành viên đó không còn truy cập được nhóm (MVP)

#### FR-122 — Đổi tên/ảnh nhóm

- **Mô tả:** Hệ thống phải cho phép admin đổi tên nhóm và ảnh nhóm; thay đổi hiển thị cho mọi thành viên.
- **Ưu tiên:** Trung bình
- **Nguồn:** BR-006; FR-005 (BRD)
- **Tiền điều kiện:** Người thao tác là admin.
- **Hậu điều kiện:** Metadata nhóm được cập nhật.
- **Tiêu chí chấp nhận:**
  - Given admin đang ở màn hình thông tin nhóm
  - When đổi tên/ảnh và lưu
  - Then tất cả thành viên thấy tên/ảnh mới trong danh sách hội thoại và header chat

#### FR-123 — Rời nhóm

- **Mô tả:** Hệ thống phải cho phép thành viên rời nhóm; sau khi rời, không còn thấy nhóm trong danh sách hội thoại (MVP).
- **Ưu tiên:** Cao
- **Nguồn:** BR-006; UR-014
- **Tiền điều kiện:** Người dùng là thành viên nhóm.
- **Hậu điều kiện:** Người dùng rời nhóm và không nhận tin/ thông báo từ nhóm đó theo phạm vi MVP.
- **Tiêu chí chấp nhận:**
  - Given người dùng là thành viên của nhóm
  - When chọn “Rời nhóm” và xác nhận
  - Then người dùng không còn thấy nhóm trong danh sách hội thoại

#### FR-130 — Gửi ảnh trong chat (1 ảnh/lần tối thiểu)

- **Mô tả:** Hệ thống phải cho phép gửi ảnh trong chat 1-1 hoặc nhóm, tối thiểu 1 ảnh/lần; nếu upload thất bại phải báo lỗi rõ ràng và cho phép thử lại.
- **Ưu tiên:** Cao
- **Nguồn:** BR-007; UR-015; UC-006
- **Tiền điều kiện:** Có quyền truy cập thư viện ảnh; người dùng đang ở chat.
- **Hậu điều kiện:** Ảnh hiển thị trong luồng chat; nếu lỗi có thể retry.
- **Tiêu chí chấp nhận:**
  - Given người dùng đang ở chat 1-1 hoặc chat nhóm
  - When chọn 1 ảnh và bấm gửi
  - Then ảnh hiển thị trong luồng chat
  - And nếu upload thất bại, hệ thống báo lỗi rõ ràng và cho phép thử lại

#### FR-140 — Thông báo tin nhắn mới + đồng bộ badge chưa đọc

- **Mô tả:** Hệ thống phải gửi thông báo khi có tin nhắn mới (push/in-app theo ngữ cảnh MVP) và đồng bộ badge chưa đọc theo hội thoại.
- **Ưu tiên:** Cao
- **Nguồn:** BR-008; UR-016
- **Tiền điều kiện:** Người nhận bật thông báo.
- **Hậu điều kiện:** Người nhận nhận thông báo; badge tăng tương ứng.
- **Tiêu chí chấp nhận:**
  - Given người dùng bật thông báo
  - When có tin nhắn mới đến
  - Then người dùng nhận được thông báo (in-app/push tùy ngữ cảnh MVP)
  - And badge chưa đọc tăng tương ứng theo hội thoại

#### FR-141 — Thông báo lời mời kết bạn

- **Mô tả:** Hệ thống phải gửi thông báo khi có lời mời kết bạn.
- **Ưu tiên:** Cao
- **Nguồn:** BR-008; UR-017
- **Tiền điều kiện:** Lời mời được gửi thành công.
- **Hậu điều kiện:** Người nhận thấy thông báo và có thể vào mục lời mời để xử lý.
- **Tiêu chí chấp nhận:**
  - Given có người gửi lời mời kết bạn
  - When lời mời được gửi thành công
  - Then người nhận nhận được thông báo và thấy mục “Lời mời” trong danh sách liên quan

#### FR-150 — Bật/Tắt thông báo trong cài đặt

- **Mô tả:** Hệ thống phải cho phép người dùng bật/tắt thông báo; khi tắt thì không gửi thông báo mới trong phạm vi kiểm soát của app MVP.
- **Ưu tiên:** Trung bình
- **Nguồn:** BR-009; UR-018
- **Tiền điều kiện:** Người dùng đang đăng nhập.
- **Hậu điều kiện:** Trạng thái setting được lưu và áp dụng.
- **Tiêu chí chấp nhận:**
  - Given người dùng ở trang Cài đặt
  - When tắt thông báo
  - Then hệ thống không gửi thông báo mới (MVP)
  - And người dùng có thể bật lại bất kỳ lúc nào

#### FR-151 — Đổi mật khẩu khi đang đăng nhập

- **Mô tả:** Hệ thống phải cho phép đổi mật khẩu khi đang đăng nhập bằng mật khẩu cũ + mật khẩu mới hợp lệ.
- **Ưu tiên:** Trung bình
- **Nguồn:** BR-009; UR-019
- **Tiền điều kiện:** Người dùng đang đăng nhập.
- **Hậu điều kiện:** Mật khẩu cập nhật; đăng nhập được bằng mật khẩu mới.
- **Tiêu chí chấp nhận:**
  - Given người dùng đang đăng nhập
  - When nhập mật khẩu cũ + mật khẩu mới hợp lệ và xác nhận
  - Then mật khẩu được cập nhật và đăng nhập được bằng mật khẩu mới

#### FR-152 — (Tùy chọn) Quyền riêng tư tối thiểu: ai có thể tìm thấy bạn

- **Mô tả:** Hệ thống **có thể** cho phép người dùng tắt/bật khả năng bị tìm bằng email/sđt; khi tắt thì người khác không tìm thấy bằng thông tin đó trong phạm vi MVP.
- **Ưu tiên:** Thấp–Trung bình (tùy ưu tiên MVP)
- **Nguồn:** BR-009; UR-020
- **Tiền điều kiện:** Người dùng đang đăng nhập.
- **Hậu điều kiện:** Quyền riêng tư được lưu và ảnh hưởng đến chức năng tìm kiếm.
- **Tiêu chí chấp nhận:**
  - Given người dùng ở trang Quyền riêng tư
  - When tắt “Cho phép tìm bằng sđt/email”
  - Then người khác không tìm thấy người dùng bằng thông tin đó (MVP)

---

## 4. Data Model (Logical)

> Mô hình logic mức cao để hỗ trợ các FR về tài khoản, kết bạn, chat, nhóm, media, thông báo, settings và telemetry. (Tham chiếu yêu cầu data hiển thị và reporting trong URD).

### 4.1 Thực thể chính & thuộc tính gợi ý

1. **User**
   - user_id (PK), email (unique, nullable), phone (unique, nullable), username (optional), created_at, status (active/locked)

2. **Credential**
   - user_id (PK/FK), password_hash, password_updated_at, reset_token (nullable), reset_expired_at

3. **UserProfile**
   - user_id (PK/FK), display_name, avatar_url, bio, last_seen_at, presence_state (online/offline)

4. **FriendRequest**
   - request_id (PK), from_user_id, to_user_id, status (pending/accepted/rejected/cancelled), created_at, responded_at

5. **Friendship**
   - user_id, friend_user_id (composite PK), created_at

6. **Block**
   - blocker_user_id, blocked_user_id (composite PK), created_at, reason (optional)

7. **Conversation**
   - conversation_id (PK), type (direct/group), created_by, created_at, last_message_at

8. **ConversationParticipant**
   - conversation_id, user_id (composite PK), role (member/admin), joined_at, left_at (nullable), last_read_at

9. **Message**
   - message_id (PK), conversation_id (FK), sender_user_id, content_text (nullable), message_type (text/image), created_at, client_msg_id (optional)

10. **MessageReceipt**

- message_id, user_id (composite PK), delivered_at (nullable), seen_at (nullable)

11. **Attachment (Image)**

- attachment_id (PK), message_id (FK), url, mime_type, size_bytes, width, height, upload_status

12. **Notification**

- notification_id (PK), user_id, type (message/friend_request), payload (json), is_read, created_at, delivered_at

13. **UserSetting**

- user_id (PK/FK), notifications_enabled (bool), privacy_search_by_phone (bool), privacy_search_by_email (bool)

14. **EventLog (Telemetry)**

- event_id (PK), user_id (nullable), event_name, event_time, attributes (json), result (success/failure), error_code (nullable)

### 4.2 Quan hệ chính

- User 1–1 UserProfile / Credential / UserSetting
- User 1–N FriendRequest (gửi/nhận), N–N Friendship (qua bảng trung gian), N–N Block
- Conversation 1–N Participant, 1–N Message; Message 1–N Receipt; Message 1–N Attachment
- User 1–N Notification; User 1–N EventLog

---

## 5. User Interface (UI) Functional Requirements

> UI yêu cầu điều hướng chính: Hội thoại — Danh bạ/Bạn bè — Thông báo — Cài đặt; và hiển thị các dữ liệu như: kết quả tìm kiếm, danh sách bạn, badge chưa đọc, trạng thái delivered/seen.

### UI-FR-01 — Điều hướng chính và truy cập tìm kiếm

- **Mô tả:** UI phải cung cấp điều hướng chính tối thiểu để truy cập: Hội thoại, Danh bạ/Bạn bè, Thông báo, Cài đặt; và truy cập nhanh chức năng tìm kiếm từ Danh bạ/Bạn bè.
- **Ưu tiên:** Cao
- **Tiêu chí chấp nhận:** Người dùng có thể vào Tìm kiếm trong ≤ 2 thao tác từ màn hình chính.

### UI-FR-02 — Màn hình Hội thoại: hiển thị badge và preview

- **Mô tả:** UI phải hiển thị danh sách hội thoại có preview, thời gian và badge chưa đọc theo hội thoại.
- **Ưu tiên:** Cao
- **Tiêu chí chấp nhận:** Badge cập nhật đồng bộ với FR-022.

### UI-FR-03 — Màn hình Chat: trạng thái gửi/nhận/xem và gửi ảnh

- **Mô tả:** UI phải hiển thị luồng tin nhắn, trạng thái delivered/seen cho tin phù hợp, và cung cấp nút gửi ảnh; với trạng thái “đang gửi/thất bại/thử lại” cho ảnh.
- **Ưu tiên:** Cao
- **Tiêu chí chấp nhận:** Thỏa FR-111, FR-112, FR-130.

### UI-FR-04 — Form validation & thông báo lỗi theo ngữ cảnh

- **Mô tả:** UI phải validate định dạng email/sđt/mật khẩu và hiển thị lỗi rõ ràng tại trường nhập (không mơ hồ).
- **Ưu tiên:** Cao
- **Tiêu chí chấp nhận:** Với input sai định dạng, người dùng nhận thông báo lỗi ngay tại field và không gửi request tạo tài khoản.

---

## 6. Error Handling

> Lưu ý rủi ro: mất kết nối khi gửi tin/ảnh; cần cơ chế trạng thái + “gửi lại”; đồng bộ badge/notification tránh “báo ảo”.

### EH-01 — Lỗi xác thực/đăng nhập

- Khi đăng nhập thất bại (sai thông tin), hệ thống phải trả thông báo lỗi thân thiện và không tiết lộ chi tiết nhạy cảm.

### EH-02 — Lỗi mạng khi gửi tin nhắn

- Khi gửi tin thất bại do mạng, hệ thống phải hiển thị “Gửi thất bại” và cho phép “Gửi lại”.

### EH-03 — Lỗi upload ảnh

- Khi upload ảnh thất bại, hệ thống phải báo lỗi rõ ràng và cho phép thử lại.

### EH-04 — Lỗi tích hợp (email/SMS/push)

- Khi dịch vụ tích hợp không khả dụng, hệ thống phải:
  - ghi nhận lỗi (telemetry/log) phục vụ reliability KPI,
  - hiển thị thông báo phù hợp (ví dụ: “Không thể gửi mã, vui lòng thử lại sau”).

---

## 7. Security Functional Requirements

### SEC-01 — Truyền dữ liệu an toàn

- **Mô tả:** Hệ thống phải truyền dữ liệu qua kết nối an toàn (ví dụ HTTPS).

### SEC-02 — Lưu mật khẩu an toàn

- **Mô tả:** Hệ thống phải lưu mật khẩu theo phương thức bảo mật (hash), không lưu plain text.

### SEC-03 — Kiểm soát truy cập tài nguyên hội thoại

- **Mô tả:** Hệ thống phải đảm bảo chỉ người tham gia hội thoại/nhóm mới truy cập được nội dung và thao tác tương ứng (xem, gửi tin, xem thành viên).

### SEC-04 — Quyền riêng tư tối thiểu cho tìm kiếm (nếu bật)

- **Mô tả:** Nếu tính năng quyền riêng tư được bật, hệ thống phải áp dụng để ngăn người khác tìm thấy bằng sđt/email theo lựa chọn người dùng.

---

## 8. Glossary

- **MVP:** phiên bản tối thiểu đủ dùng để kiểm chứng nhu cầu.
- **Chat 1-1 / Chat nhóm:** trò chuyện giữa hai người / nhiều người.
- **Delivered/Seen:** trạng thái “đã nhận/đã xem”.
- **Badge chưa đọc:** số lượng tin chưa đọc theo hội thoại.
- **Activation / Retention D1/D7 / Accept rate:** chỉ số đo lường MVP.

---

## 9. Approvals

| Họ tên | Vai trò         | Chữ ký | Ngày |
| ------ | --------------- | ------ | ---- |
| (Điền) | Product Owner   |        |      |
| (Điền) | Project Manager |        |      |
| (Điền) | Tech Lead       |        |      |
| (Điền) | QA Lead         |        |      |

---

## Phụ lục — Handoff tóm tắt cho NFR/NFR-agent (khuyến nghị)

- **Khu vực chức năng phức tạp/nhạy:** real-time messaging, delivered/seen, đồng bộ unread/badge/notification, retry khi lỗi mạng.
- **Tích hợp quan trọng:** email/SMS (reset/OTP), push notification, lưu trữ ảnh/media.
- **Ràng buộc hiệu năng:** nhóm chat nhỏ (≤ 50) cho MVP.
- **Đo lường:** cần telemetry tối thiểu phục vụ KPI activation/messaging/social graph/reliability.
