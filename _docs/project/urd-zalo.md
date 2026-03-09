# User Requirements Document (URD) — MVP Ứng dụng chat/kết nối kiểu Zalo

> Tài liệu này được hiện thực theo cấu trúc template URD.
> Phương pháp diễn giải theo “User Requirements Agent” (tập trung góc nhìn người dùng, user story + acceptance criteria, use case, UI/Usability/Data).

---

## 1. Introduction

### 1.1 Mục đích

URD mô tả **nhu cầu và kỳ vọng của người dùng** đối với MVP ứng dụng chat/kết nối bạn bè kiểu Zalo, chuyển hóa từ BRD sang **yêu cầu hướng người dùng** (user profiles, user stories, use cases, UI/usability, data).

### 1.2 Phạm vi

URD này bao phủ các luồng MVP: **tài khoản & onboarding, hồ sơ, kết bạn/danh bạ, chat 1-1, chat nhóm, gửi ảnh, thông báo, cài đặt cơ bản**.  
Ngoài phạm vi: gọi thoại/video, newsfeed, thanh toán/mini app, sticker store nâng cao, stories/live stream…

### 1.3 Đối tượng đọc

- Người dùng cuối (alpha/beta)
- PO/PM, BA
- Dev, QA
- CS, Ops/Monitoring

(Stakeholder chính trong BRD đã nêu).

---

## 2. User Profiles

> Mỗi persona gồm: vai trò, nhân khẩu học/độ thành thạo, mục tiêu, tác vụ, pain points, kỹ năng.

### 2.1 Persona A — Người dùng phổ thông (End User)

- **Demographics:** 16–45; dùng smartphone hàng ngày; mức kỹ năng số từ cơ bản đến khá.
- **Goals:**
  - Đăng ký nhanh để “vào là chat được”.
  - Tìm bạn và bắt đầu chat 1-1 dễ dàng.
  - Nhận thông báo để không bỏ lỡ tin nhắn/lời mời.

- **Tasks:**
  - Tạo tài khoản/đăng nhập/đặt lại mật khẩu.
  - Cập nhật tên/ảnh đại diện.
  - Tìm kiếm người dùng; gửi/nhận/chấp nhận lời mời kết bạn.
  - Chat 1-1 (text), xem trạng thái đã nhận/đã xem; gửi ảnh.
  - Tạo/ tham gia chat nhóm; quản lý thành viên (nếu là admin); rời nhóm.
  - Bật/tắt thông báo; đổi mật khẩu; (tuỳ chọn) thiết lập quyền riêng tư.

- **Pain Points:**
  - Đăng ký rườm rà; không rõ lỗi khi OTP/đặt lại mật khẩu.
  - Tìm bạn khó (không biết nhập gì); spam lời mời.
  - Tin nhắn đến trễ/mất; trạng thái đã xem không đáng tin.
  - Upload ảnh lỗi mạng nhưng không biết xử lý.

- **Technical Skills:** cơ bản–khá; kỳ vọng UI trực quan, ít bước.

### 2.2 Persona B — Người dùng nhóm (Group Organizer / Admin nhóm)

- **Demographics:** 18–45; thường dùng chat nhóm cho lớp/CLB/công việc.
- **Goals:** tạo nhóm nhanh, thêm/xóa thành viên, đổi tên/ảnh nhóm, đảm bảo mọi người nhận tin.
- **Tasks:** tạo nhóm từ danh sách bạn, đặt tên/ảnh, thêm/xóa thành viên, nhắn tin nhóm, rời nhóm.
- **Pain Points:** thêm thành viên khó; quyền admin không rõ; nhóm bị spam; thông báo nhóm “quá nhiều” hoặc “không đến”.
- **Technical Skills:** khá.

### 2.3 Persona C — Nhân viên CS (Customer Support)

- **Demographics:** 20–35; dùng công cụ nội bộ theo ca.
- **Goals:** hỗ trợ người dùng khôi phục tài khoản, xử lý khiếu nại về tin nhắn/ảnh/ thông báo; cần thông tin tối thiểu để chẩn đoán. (Nhu cầu CS được nêu trong stakeholder).
- **Tasks:** tra cứu theo email/sđt, hướng dẫn reset mật khẩu, thu thập log/ID sự cố (ở mức yêu cầu người dùng).
- **Pain Points:** thiếu thông tin lỗi; người dùng mô tả mơ hồ; khó tái hiện.
- **Technical Skills:** trung bình.

### 2.4 Persona D — QA/Ops (Kiểm thử & Vận hành)

- **Demographics:** 22–40; kỹ năng kỹ thuật khá.
- **Goals:** xác nhận luồng end-to-end, theo dõi độ ổn định gửi/nhận tin, upload ảnh, thông báo; cần sự kiện/đo lường tối thiểu.
- **Tasks:** chạy test kịch bản, quan sát lỗi/độ trễ, kiểm tra số chưa đọc/badge.
- **Pain Points:** thiếu tiêu chí chấp nhận; dữ liệu/telemetry không đủ để khoanh vùng lỗi.
- **Technical Skills:** khá–cao.

---

## 3. User Stories

> User story theo format “As a… I want… So that…” + Acceptance Criteria testable.  
> Các story bám BR/FR cốt lõi: kết bạn, chat 1-1, chat nhóm, ảnh, thông báo, cài đặt.

### 3.1 Nhóm Tài khoản & Hồ sơ

**UR-001 — Đăng ký tài khoản**

- **As a:** Người dùng phổ thông
- **I want to:** đăng ký bằng email hoặc số điện thoại
- **So that:** tôi có thể bắt đầu sử dụng ứng dụng để kết nối và chat
- **Acceptance Criteria:**
  - Given tôi đang ở màn hình Đăng ký
  - When tôi nhập email/sđt hợp lệ + mật khẩu và bấm “Đăng ký”
  - Then hệ thống tạo tài khoản thành công và đưa tôi vào bước thiết lập hồ sơ cơ bản
  - And nếu dữ liệu không hợp lệ, hệ thống hiển thị lỗi rõ ràng tại trường nhập tương ứng.

**UR-002 — Đăng nhập/Đăng xuất**

- **As a:** Người dùng phổ thông
- **I want to:** đăng nhập/đăng xuất
- **So that:** tôi có thể truy cập tài khoản của mình an toàn
- **Acceptance Criteria:**
  - Given tôi có tài khoản hợp lệ
  - When tôi đăng nhập đúng thông tin
  - Then tôi vào được danh sách hội thoại/danh bạ
  - And khi đăng xuất, tôi được đưa về màn hình đăng nhập.

**UR-003 — Quên mật khẩu/Đặt lại mật khẩu**

- **As a:** Người dùng phổ thông
- **I want to:** đặt lại mật khẩu khi quên
- **So that:** tôi có thể lấy lại quyền truy cập tài khoản
- **Acceptance Criteria:**
  - Given tôi ở màn hình “Quên mật khẩu”
  - When tôi nhập email/sđt đã đăng ký
  - Then hệ thống gửi hướng dẫn đặt lại (hoặc cơ chế tương đương trong MVP)
  - And sau khi đặt lại thành công, tôi đăng nhập được bằng mật khẩu mới.

**UR-004 — Cập nhật hồ sơ cơ bản**

- **As a:** Người dùng phổ thông
- **I want to:** đặt tên hiển thị và ảnh đại diện
- **So that:** bạn bè nhận ra tôi khi tìm kiếm/kết bạn/chat
- **Acceptance Criteria:**
  - Given tôi đang ở trang Hồ sơ
  - When tôi cập nhật tên/ảnh và lưu
  - Then hồ sơ hiển thị đúng ở kết quả tìm kiếm và trong hội thoại.

### 3.2 Nhóm Tìm kiếm & Kết bạn

**UR-005 — Tìm kiếm người dùng**

- **As a:** Người dùng phổ thông
- **I want to:** tìm người dùng bằng sđt/email/username
- **So that:** tôi có thể gửi lời mời kết bạn
- **Acceptance Criteria:**
  - Given tôi ở màn hình Tìm kiếm
  - When tôi nhập sđt/email/username và bấm tìm
  - Then hệ thống trả về danh sách kết quả phù hợp
  - And mỗi kết quả hiển thị tối thiểu tên + ảnh đại diện để nhận diện.

**UR-006 — Gửi lời mời kết bạn**

- **As a:** Người dùng phổ thông
- **I want to:** gửi lời mời kết bạn từ trang hồ sơ người khác
- **So that:** tôi có thể bắt đầu chat 1-1 sau khi được chấp nhận
- **Acceptance Criteria:**
  - Given tôi đang xem hồ sơ một người dùng khác
  - When tôi bấm “Kết bạn/Gửi lời mời”
  - Then người kia nhận được thông báo lời mời
  - And trạng thái hiển thị “Đã gửi lời mời”.

**UR-007 — Chấp nhận/Từ chối lời mời**

- **As a:** Người dùng phổ thông
- **I want to:** chấp nhận hoặc từ chối lời mời kết bạn
- **So that:** tôi kiểm soát danh sách bạn bè của mình
- **Acceptance Criteria:**
  - Given tôi có lời mời kết bạn đến
  - When tôi chọn “Chấp nhận”
  - Then người gửi và tôi trở thành bạn bè, có thể mở chat 1-1
  - When tôi chọn “Từ chối”
  - Then lời mời bị loại bỏ khỏi danh sách chờ.

**UR-008 — Chặn/Bỏ chặn**

- **As a:** Người dùng phổ thông
- **I want to:** chặn hoặc bỏ chặn người dùng
- **So that:** tôi tránh bị làm phiền và đảm bảo an toàn trải nghiệm
- **Acceptance Criteria:**
  - Given tôi đang xem hồ sơ/thiết lập quan hệ
  - When tôi bấm “Chặn”
  - Then người bị chặn không thể gửi lời mời/nhắn tin cho tôi (trong phạm vi MVP)
  - And tôi có thể “Bỏ chặn” để khôi phục tương tác.

### 3.3 Nhóm Chat 1-1

**UR-009 — Danh sách hội thoại**

- **As a:** Người dùng phổ thông
- **I want to:** xem danh sách hội thoại và trạng thái chưa đọc
- **So that:** tôi vào đúng cuộc chat và không bỏ lỡ tin nhắn
- **Acceptance Criteria:**
  - Given tôi đã đăng nhập
  - When tôi vào màn hình Hội thoại
  - Then tôi thấy danh sách hội thoại theo thời gian cập nhật gần nhất
  - And mỗi hội thoại có badge số chưa đọc (nếu có).

**UR-010 — Gửi/nhận tin nhắn text real-time**

- **As a:** Người dùng phổ thông
- **I want to:** gửi và nhận tin nhắn text theo thời gian thực
- **So that:** cuộc trò chuyện diễn ra liền mạch
- **Acceptance Criteria:**
  - Given tôi đang ở màn hình chat 1-1
  - When tôi gửi một tin nhắn text
  - Then tin nhắn xuất hiện ngay trong luồng chat của tôi
  - And người nhận thấy tin nhắn trong thời gian hợp lý (real-time trong MVP).

**UR-011 — Trạng thái “đã nhận/đã xem”**

- **As a:** Người dùng phổ thông
- **I want to:** thấy trạng thái đã nhận/đã xem
- **So that:** tôi biết đối phương đã nhận và đã đọc tin nhắn
- **Acceptance Criteria:**
  - Given tôi đã gửi tin nhắn
  - When hệ thống xác nhận người nhận đã nhận
  - Then tin nhắn hiển thị trạng thái “Đã nhận”
  - When người nhận mở hội thoại và xem tin
  - Then tin nhắn hiển thị trạng thái “Đã xem”.

### 3.4 Nhóm Chat nhóm

**UR-012 — Tạo nhóm chat**

- **As a:** Người dùng nhóm (Admin)
- **I want to:** tạo nhóm từ danh sách bạn bè và đặt tên/ảnh nhóm
- **So that:** tôi có thể chat với nhiều người trong một nơi
- **Acceptance Criteria:**
  - Given tôi đang ở danh sách hội thoại
  - When tôi chọn “Tạo nhóm”, chọn thành viên, đặt tên (bắt buộc) và lưu
  - Then nhóm được tạo và xuất hiện trong danh sách hội thoại.

**UR-013 — Quản lý thành viên (Admin)**

- **As a:** Admin nhóm
- **I want to:** thêm/xóa thành viên và đổi tên/ảnh nhóm
- **So that:** tôi quản trị nhóm theo nhu cầu
- **Acceptance Criteria:**
  - Given tôi là admin của nhóm
  - When tôi thêm một bạn bè vào nhóm
  - Then thành viên mới thấy nhóm trong danh sách hội thoại
  - When tôi xóa thành viên
  - Then thành viên đó không còn truy cập được nhóm trong phạm vi MVP.

**UR-014 — Rời nhóm**

- **As a:** Thành viên nhóm
- **I want to:** rời nhóm
- **So that:** tôi không còn nhận tin/ thông báo từ nhóm đó
- **Acceptance Criteria:**
  - Given tôi là thành viên của nhóm
  - When tôi chọn “Rời nhóm” và xác nhận
  - Then tôi không còn thấy nhóm trong danh sách hội thoại.

### 3.5 Nhóm Media & Thông báo & Cài đặt

**UR-015 — Gửi ảnh trong chat**

- **As a:** Người dùng phổ thông
- **I want to:** gửi ảnh trong chat (tối thiểu 1 ảnh/lần)
- **So that:** tôi chia sẻ thông tin nhanh hơn so với chỉ text
- **Acceptance Criteria:**
  - Given tôi đang ở chat 1-1 hoặc chat nhóm
  - When tôi chọn 1 ảnh từ thiết bị và bấm gửi
  - Then ảnh hiển thị trong luồng chat
  - And nếu upload thất bại, hệ thống báo lỗi rõ ràng và cho phép thử lại.

**UR-016 — Thông báo tin nhắn mới**

- **As a:** Người dùng phổ thông
- **I want to:** nhận thông báo khi có tin nhắn mới
- **So that:** tôi không bỏ lỡ hội thoại quan trọng
- **Acceptance Criteria:**
  - Given tôi bật thông báo
  - When có tin nhắn mới đến
  - Then tôi nhận được thông báo (in-app/push tùy ngữ cảnh MVP)
  - And badge chưa đọc tăng tương ứng theo hội thoại.

**UR-017 — Thông báo lời mời kết bạn**

- **As a:** Người dùng phổ thông
- **I want to:** nhận thông báo khi có lời mời kết bạn
- **So that:** tôi phản hồi kịp thời
- **Acceptance Criteria:**
  - Given có người gửi lời mời kết bạn cho tôi
  - When lời mời được gửi thành công
  - Then tôi nhận được thông báo và thấy mục “Lời mời” trong danh sách liên quan.

**UR-018 — Bật/Tắt thông báo**

- **As a:** Người dùng phổ thông
- **I want to:** bật/tắt thông báo trong cài đặt
- **So that:** tôi kiểm soát mức độ làm phiền
- **Acceptance Criteria:**
  - Given tôi ở trang Cài đặt
  - When tôi tắt thông báo
  - Then hệ thống không gửi thông báo mới (trong phạm vi kiểm soát của app MVP)
  - And tôi có thể bật lại bất kỳ lúc nào.

**UR-019 — Đổi mật khẩu**

- **As a:** Người dùng phổ thông
- **I want to:** đổi mật khẩu
- **So that:** tôi tăng an toàn tài khoản
- **Acceptance Criteria:**
  - Given tôi đang đăng nhập
  - When tôi nhập mật khẩu cũ + mật khẩu mới hợp lệ và xác nhận
  - Then mật khẩu được cập nhật và tôi đăng nhập được bằng mật khẩu mới.

**UR-020 — Quyền riêng tư tối thiểu (tuỳ chọn)**

- **As a:** Người dùng phổ thông
- **I want to:** chọn ai có thể tìm thấy tôi bằng email/sđt
- **So that:** tôi kiểm soát khả năng bị tìm kiếm
- **Acceptance Criteria:**
  - Given tôi ở trang Quyền riêng tư
  - When tôi tắt “Cho phép tìm bằng sđt/email”
  - Then người khác không tìm thấy tôi bằng thông tin đó (trong phạm vi MVP).

### 3.6 Traceability (UR ↔ BR)

| User Story                     | BR liên quan   |
| ------------------------------ | -------------- |
| UR-001..UR-003                 | BR-001         |
| UR-004                         | BR-002         |
| UR-005..UR-008                 | BR-003, BR-004 |
| UR-009..UR-011                 | BR-005         |
| UR-012..UR-014                 | BR-006         |
| UR-015                         | BR-007         |
| UR-016..UR-017                 | BR-008         |
| UR-018..UR-020                 | BR-009         |
| (đo lường/telemetry gián tiếp) | BR-010         |

(Các BR/FR được mô tả trong BRD).

---

## 4. Use Cases

> Use case gồm: ID, Name, Actors, Preconditions, Postconditions, Main Flow, Alternative Flows.

### UC-001 — Onboarding: Đăng ký và thiết lập hồ sơ cơ bản

- **Actors:** Người dùng phổ thông
- **Description:** Người dùng tạo tài khoản và hoàn tất hồ sơ tối thiểu để bắt đầu kết nối/chat.
- **Pre-conditions:** App đã cài; người dùng chưa đăng nhập.
- **Post-conditions:** Tài khoản tạo thành công; hồ sơ có tên hiển thị (ảnh đại diện có thể tuỳ chọn).
- **Main Flow:**
  1. Người dùng chọn “Đăng ký”.
  2. Nhập email/sđt + mật khẩu → bấm “Tạo tài khoản”.
  3. Hệ thống tạo tài khoản → chuyển sang bước hồ sơ.
  4. Người dùng nhập tên hiển thị, chọn ảnh (tuỳ chọn) → Lưu.
  5. Hệ thống đưa người dùng vào màn hình chính (Hội thoại/Danh bạ).

- **Alternative Flows:**
  - A1: Dữ liệu không hợp lệ → hiển thị lỗi tại trường nhập.
  - A2: Email/sđt đã tồn tại → gợi ý đăng nhập hoặc đặt lại mật khẩu.

### UC-002 — Kết bạn: Tìm kiếm và gửi lời mời

- **Actors:** Người dùng phổ thông (người gửi), Người dùng phổ thông (người nhận)
- **Description:** Tìm người dùng theo định danh và gửi lời mời kết bạn.
- **Pre-conditions:** Người gửi đã đăng nhập.
- **Post-conditions:** Lời mời được tạo; người nhận thấy thông báo và mục lời mời.
- **Main Flow:**
  1. Người gửi mở “Tìm kiếm”.
  2. Nhập sđt/email/username → xem danh sách kết quả.
  3. Chọn một người → xem hồ sơ.
  4. Bấm “Gửi lời mời”.
  5. Hệ thống cập nhật trạng thái “Đã gửi lời mời” và gửi thông báo cho người nhận.

- **Alternative Flows:**
  - A1: Không có kết quả → hiển thị trạng thái “Không tìm thấy”.
  - A2: Người nhận đã chặn người gửi → thông báo không thể gửi (message thân thiện).

### UC-003 — Kết bạn: Nhận và chấp nhận lời mời

- **Actors:** Người dùng phổ thông (người nhận), Người dùng phổ thông (người gửi)
- **Description:** Người nhận quyết định chấp nhận/từ chối lời mời.
- **Pre-conditions:** Có lời mời đang chờ.
- **Post-conditions:** Nếu chấp nhận → trở thành bạn bè và có thể chat 1-1.
- **Main Flow:**
  1. Người nhận mở mục “Lời mời”.
  2. Chọn “Chấp nhận”.
  3. Hệ thống thêm cả hai vào danh sách bạn bè.
  4. Hệ thống tạo (hoặc cho phép tạo) hội thoại 1-1.

- **Alternative Flows:**
  - A1: Từ chối → lời mời bị xóa khỏi danh sách chờ.
  - A2: Lời mời hết hiệu lực (đã bị thu hồi) → thông báo trạng thái.

### UC-004 — Chat 1-1: Gửi tin nhắn và hiển thị trạng thái

- **Actors:** Người dùng phổ thông (A), Người dùng phổ thông (B)
- **Description:** A gửi tin cho B; hệ thống cập nhật delivered/seen.
- **Pre-conditions:** A và B là bạn bè; cả hai có thể online hoặc offline.
- **Post-conditions:** Tin nhắn xuất hiện trong lịch sử chat; trạng thái được cập nhật.
- **Main Flow:**
  1. A mở chat với B từ danh sách bạn bè/hội thoại.
  2. A nhập text → bấm gửi.
  3. Hệ thống hiển thị tin nhắn phía A ngay lập tức.
  4. B nhận tin; nếu bật thông báo → nhận push/in-app.
  5. Khi B mở chat → hệ thống cập nhật “Đã xem” cho tin.

- **Alternative Flows:**
  - A1: B offline → hệ thống vẫn lưu tin và gửi thông báo khi phù hợp (MVP).
  - A2: Mất kết nối khi gửi → hiển thị “Gửi thất bại” và cho phép “Gửi lại”.

### UC-005 — Chat nhóm: Tạo nhóm và quản lý thành viên

- **Actors:** Admin nhóm, Thành viên nhóm
- **Description:** Tạo nhóm, thêm/xóa thành viên, đổi tên/ảnh nhóm.
- **Pre-conditions:** Admin đã đăng nhập và có danh sách bạn bè.
- **Post-conditions:** Nhóm hoạt động; thành viên nhận nhóm trong hội thoại.
- **Main Flow:**
  1. Admin chọn “Tạo nhóm” → chọn thành viên.
  2. Nhập tên nhóm → tạo.
  3. Admin vào “Quản lý nhóm” → thêm/xóa thành viên.
  4. Nhóm chat text/ảnh như hội thoại bình thường.

- **Alternative Flows:**
  - A1: Thêm thành viên không phải bạn bè → hệ thống không cho chọn (MVP).
  - A2: Admin rời nhóm → (tuỳ MVP) yêu cầu chuyển quyền hoặc cho phép rời nếu còn admin khác.

### UC-006 — Gửi ảnh trong chat

- **Actors:** Người dùng phổ thông
- **Description:** Người dùng gửi 1 ảnh trong chat 1-1/nhóm.
- **Pre-conditions:** Có quyền truy cập thư viện ảnh.
- **Post-conditions:** Ảnh hiển thị trong luồng chat.
- **Main Flow:**
  1. Người dùng bấm biểu tượng “Ảnh”.
  2. Chọn 1 ảnh → bấm gửi.
  3. Hệ thống tải ảnh và hiển thị thumbnail trong chat.

- **Alternative Flows:**
  - A1: Upload lỗi mạng → thông báo lỗi + nút thử lại.

### UC-007 — Cài đặt: Bật/tắt thông báo và đổi mật khẩu

- **Actors:** Người dùng phổ thông
- **Description:** Người dùng kiểm soát thông báo và an toàn tài khoản.
- **Pre-conditions:** Đang đăng nhập.
- **Post-conditions:** Cài đặt được lưu và áp dụng.
- **Main Flow:**
  1. Vào Cài đặt → tắt/bật thông báo.
  2. Chọn “Đổi mật khẩu” → nhập mật khẩu cũ/mới → lưu.

- **Alternative Flows:**
  - A1: Mật khẩu cũ sai → báo lỗi rõ ràng.
  - A2: Mật khẩu mới không đạt tiêu chí → hướng dẫn cách sửa.

---

## 5. User Interface (UI) Requirements

> Các hạng mục UI: Look & Feel, Navigation, Layout, Input/Output, Accessibility.

### 5.1 Look and Feel

- Giao diện tối giản, ưu tiên tốc độ thao tác cho chat.
- Nhấn mạnh: badge chưa đọc, trạng thái gửi/nhận/xem, nút hành động rõ ràng (Kết bạn, Gửi, Tạo nhóm).

### 5.2 Navigation

- Thanh điều hướng chính (gợi ý): **Hội thoại — Danh bạ/Bạn bè — Thông báo — Cài đặt**.
- Tìm kiếm dễ truy cập từ Danh bạ/Bạn bè.
- Từ hồ sơ người dùng: có nút “Gửi lời mời/Kết bạn”, “Nhắn tin” (nếu đã là bạn), “Chặn”.

### 5.3 Layout

- **Hội thoại:** danh sách hội thoại + badge + preview tin nhắn gần nhất.
- **Chat:** luồng tin nhắn, ô nhập + nút gửi + nút chọn ảnh; trạng thái delivered/seen gắn theo tin.
- **Nhóm:** màn hình thông tin nhóm riêng (tên/ảnh/thành viên) để quản trị.

### 5.4 Input/Output

- Form có validation tại chỗ (email/sđt/mật khẩu).
- Lỗi hiển thị theo ngữ cảnh, dễ hiểu (không dùng thông báo mơ hồ).
- Upload ảnh: hiển thị tiến trình/tình trạng (đang gửi, thất bại, thử lại).

### 5.5 Accessibility

- Hỗ trợ cỡ chữ hệ thống; vùng bấm đủ lớn.
- Màu sắc badge/trạng thái có độ tương phản tốt; không phụ thuộc màu duy nhất để phân biệt trạng thái.
- Điều hướng bằng bàn phím (web) / hỗ trợ screen reader ở mức cơ bản.

---

## 6. Usability Requirements

> Usability gồm: Efficiency, Learnability, Memorability, Error Prevention & Recovery, Satisfaction.

### 6.1 Efficiency

- Người dùng mới có thể hoàn tất “đăng ký → tạo hồ sơ → gửi tin đầu tiên” trong một phiên (phù hợp KPI activation).
- Các hành động thường dùng ≤ 3 bước: tìm bạn, gửi lời mời, mở chat, gửi tin/ảnh.

### 6.2 Learnability

- Onboarding hướng dẫn ngắn: cách tìm bạn, tạo nhóm, bật/tắt thông báo.
- Icon/nhãn quen thuộc (Gửi, Ảnh, Tạo nhóm).

### 6.3 Memorability

- Vị trí tính năng nhất quán giữa các màn hình (tìm kiếm, cài đặt).
- Mẫu tương tác giống nhau giữa chat 1-1 và chat nhóm (gửi tin/ảnh).

### 6.4 Error Prevention and Recovery

- Ngăn lỗi nhập: kiểm tra định dạng email/sđt; mật khẩu tối thiểu.
- Khi gửi tin/ảnh thất bại do mạng: có “Gửi lại”, không làm mất nội dung.
- Trạng thái hệ thống minh bạch: “Đang gửi/Thất bại/Đã nhận/Đã xem”.

### 6.5 Satisfaction

- Trải nghiệm chat mượt và đáng tin (không mất tin; phản hồi nhanh).
- Thông báo đúng lúc, người dùng kiểm soát được (bật/tắt).

---

## 7. Data Requirements (User Perspective)

> Mô tả theo Data Entry, Data Display, Data Reporting.

### 7.1 Data Entry (Người dùng nhập)

- Thông tin đăng ký: email/sđt, mật khẩu.
- Hồ sơ: tên hiển thị, ảnh đại diện, mô tả ngắn (tuỳ chọn).
- Tìm kiếm: sđt/email/username.
- Nội dung chat: text; ảnh (1 ảnh/lần ở mức tối thiểu).
- Cài đặt: bật/tắt thông báo; đổi mật khẩu; quyền riêng tư tối thiểu (tuỳ chọn).

### 7.2 Data Display (Người dùng cần thấy)

- Kết quả tìm kiếm: tên + ảnh đại diện + (tuỳ chọn) username.
- Danh sách bạn bè; trạng thái quan hệ (bạn bè/đang chờ/đã chặn).
- Danh sách hội thoại: preview tin nhắn, thời gian, badge chưa đọc.
- Trong chat: nội dung tin nhắn, timestamp (khuyến nghị), trạng thái đã nhận/đã xem.
- Thông báo: tin nhắn mới, lời mời kết bạn.

### 7.3 Data Reporting (Báo cáo/đo lường mà “người dùng nội bộ” cần)

- **PO/PM/Ops/QA** cần số liệu hành vi tối thiểu phục vụ KPI: activation (gửi tin đầu tiên trong 24h), messaging (tin/ngày), accept rate, reliability (tỷ lệ lỗi upload/notification).
- **CS** cần thông tin sự cố người dùng cung cấp được: tài khoản (email/sđt), thời điểm lỗi, loại lỗi (đăng nhập/gửi tin/upload ảnh/nhận thông báo).

---

## 8. Glossary

- **MVP:** phiên bản tối thiểu đủ dùng để kiểm chứng nhu cầu.
- **Chat 1-1:** trò chuyện giữa hai người dùng.
- **Chat nhóm:** trò chuyện nhiều người (nhóm nhỏ).
- **Delivered/Seen:** trạng thái “đã nhận/đã xem” của tin nhắn.
- **Badge chưa đọc:** số lượng tin chưa đọc theo hội thoại.
- **Activation / Retention D1/D7 / Accept rate:** các chỉ số đo lường MVP.

---

## 9. Approvals

| Họ tên | Vai trò         | Chữ ký | Ngày |
| ------ | --------------- | ------ | ---- |
| (Điền) | Product Owner   |        |      |
| (Điền) | Project Manager |        |      |
| (Điền) | Tech Lead       |        |      |
| (Điền) | QA Lead         |        |      |

---

## Phụ lục — Handoff tóm tắt cho nhóm FRD/NFR (khuyến nghị)

- **Vai trò người dùng chính & mục tiêu:**
  - End User: vào là chat được, tìm bạn nhanh, chat ổn định, không bỏ lỡ tin.
  - Group Admin: tạo nhóm/ quản trị thành viên dễ dàng.
  - CS/QA/Ops: cần tín hiệu/điểm chạm để hỗ trợ & kiểm chứng.

- **User stories quan trọng nhất (ưu tiên MVP):**
  - UR-005..UR-007 (tìm & kết bạn), UR-010..UR-011 (chat 1-1 + delivered/seen), UR-012..UR-013 (nhóm), UR-015 (ảnh), UR-016..UR-018 (thông báo & kiểm soát).

- **Rủi ro usability cần chú ý khi viết FRD/NFR:**
  - Mất kết nối khi gửi tin/ảnh: cần cơ chế hiển thị trạng thái + “gửi lại”.
  - Trạng thái delivered/seen phải nhất quán để tránh mất niềm tin.
  - Badge chưa đọc và thông báo phải đồng bộ, tránh “báo ảo” hoặc “không báo”.

- **Gợi ý chuyển hóa sang FRD/NFR (không đi vào kỹ thuật):**
  - FRD nên định nghĩa rõ hành vi từng trạng thái tin nhắn, quy tắc badge, quy tắc quyền admin nhóm, và quy tắc chặn/bỏ chặn theo luồng người dùng.
  - NFR nhấn mạnh độ tin cậy/độ trễ/khả năng theo dõi lỗi theo KPI reliability.
