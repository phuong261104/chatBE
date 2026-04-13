# 🔐 MODULE XÁC THỰC & NGƯỜI DÙNG - HƯỚNG DẪN CHI TIẾT

## 📍 Cấu Trúc Thư Mục

### Module AUTH (Xác Thực)

```
src/modules/auth/
├── index.ts                                    # Setup & DI (Dependency Injection)
├── interface/index.ts                          # Giao diện hợp đồng
├── model/
│   ├── index.ts                                # Xuất các lớp
│   ├── dto.ts                                  # Xác thực input (RegistrationDTO, LoginDTO)
│   └── errors.ts                               # Định nghĩa lỗi tùy chỉnh
├── usecase/
│   └── index.ts                                # 🎯 AuthUseCase (đăng ký, đăng nhập, xác thực token)
└── infras/
    └── transport/
        └── index.ts                            # 🌐 API Endpoints xác thực (/auth/*)
```

### Module USER (Người Dùng)

```
src/modules/user/
├── index.ts                                    # Setup & DI (Dependency Injection)
├── interface/index.ts                          # Giao diện hợp đồng
├── model/
│   ├── model.ts                                # Thực thể miền (User, UserStatus, UserVerified, UserPrivacy, UserSettings)
│   └── dto.ts                                  # DTOs (UserCreateDTO, UserUpdateDTO, UserCondDTO)
├── usecase/
│   ├── index.ts                                # 🎯 UserUseCase (hồ sơ, tìm kiếm, cập nhật, liệt kê)
│   └── presence-usecase.ts                     # Theo dõi trạng thái online real-time
└── infras/
    ├── repository/
    │   ├── nosql/
    │   │   ├── mongodb-repo.ts                 # Triển khai MongoDB
    │   │   └── dto.ts                          # Schema MongoDB (Mongoose)
    │   └── redis/
    │       └── presence-repo.ts                # Cache Redis cho trạng thái
    └── transport/
        ├── index.ts                            # 🌐 API Endpoints người dùng (/profile, /users/*)
        └── socket-service.ts                   # Sự kiện real-time WebSocket
```

---

## 📖 HƯỚNG DẪN ĐỌC SOURCE CODE

### 🎯 Chiến Lược Đọc Code

```
Hãy nghĩ về code như những LAYER xếp chồng:

HTTP Request (Yêu cầu từ client)
    ↓
HTTP Handler (Transport Layer) ← BẮT ĐẦU TỪ ĐÂY
    ↓
UseCase (Business Logic Layer) ← RỒI ĐẾN ĐÂY
    ↓
Repository (Data Access Layer) ← CUỐI CÙNG LÀ ĐÂY
    ↓
Database/Cache (Cơ sở dữ liệu) ← KẾT THÚC TẠI ĐÂY
```

**Mục đích:** Hiểu code bằng cách theo dõi MỘT QUY TRÌNH ĐẦY ĐỦ từ đầu đến cuối.

---

### 📋 THỨ TỰ ĐỌC TỪNG BƯỚC

#### **Giai đoạn 1: Hiểu Cấu Trúc Dự Án**

**Đọc 3 file này TRƯỚC TIÊN:**

1. `src/modules/auth/index.ts` → **Cái gì**: Điểm vào, xem setup/DI
2. `src/modules/user/index.ts` → **Cái gì**: Điểm vào, xem routes
3. Nhìn vào `src/index.ts` chính → **Cái gì**: Cách các module được đăng ký

**Tại sao?**

- Hiểu cách Express routes được đăng ký
- Hiểu nơi UserRepository được tạo
- Hiểu sự phụ thuộc giữa các module

---

#### **Giai đoạn 2: Chọn MỘT Tính Năng & Theo Dõi Nó**

**Hãy theo dõi REGISTRATION (Đăng Ký) làm ví dụ:**

```
LỰA CHỌN ĐỌC:

Bước 1️⃣: Tìm endpoint HTTP
├─ File: src/modules/auth/index.ts
├─ Tìm: router.post("/auth/register", ...)
├─ Tìm: AuthHTTPService.registerAPI
└─ Câu hỏi: registerAPI nhận tham số gì?

Bước 2️⃣: Đọc HTTP handler
├─ File: src/modules/auth/infras/transport/index.ts
├─ Function: registerAPI(req, res)
├─ Lưu ý: Nó làm gì với req.body
├─ Lưu ý: Nó gọi methods nào của useCase
└─ Câu hỏi: registerAPI trả về gì? Lỗi gì?

Bước 3️⃣: Đọc DTO/Validation
├─ File: src/modules/auth/model/dto.ts
├─ Schema: RegistrationDTOSchema
├─ Lưu ý: Trường nào bắt buộc vs tùy chọn
├─ Lưu ý: Quy tắc xác thực nào
└─ Câu hỏi: Trường nào được xác thực?

Bước 4️⃣: Đọc UseCase (Business Logic)
├─ File: src/modules/auth/usecase/index.ts
├─ Function: register(data: RegistrationDTO): Promise<string>
├─ Theo dõi logic TỪNG DÒNG:
│  ├─ 1. Xác thực DTO
│  ├─ 2. Bình thường hóa số điện thoại
│  ├─ 3. Kiểm tra số điện thoại tồn tại (truy vấn DB)
│  ├─ 4. Kiểm tra email tồn tại (truy vấn DB)
│  ├─ 5. Hash password với bcrypt
│  ├─ 6. Tạo đối tượng user
│  ├─ 7. Chèn vào DB thông qua repository
│  └─ 8. Trả về userId
└─ Câu hỏi: Cái gì có thể ném ra lỗi?

Bước 5️⃣: Đọc Định Nghĩa Lỗi
├─ File: src/modules/auth/model/errors.ts
├─ Lỗi: ErrPhoneExisted, ErrEmailExisted, v.v.
└─ Câu hỏi: Thông báo lỗi nào thân thiện với người dùng?

Bước 6️⃣: Đọc Data Model
├─ File: src/modules/user/model/model.ts
├─ Type: User (trường nào, kiểu nào)
├─ Enum: UserStatus (ACTIVE, DISABLED)
├─ Types: UserVerified, UserPrivacy, UserSettings
└─ Câu hỏi: Đối tượng User chứa gì?

Bước 7️⃣: Đọc Repository Interface
├─ File: src/share/interface/index.ts (hoặc user/interface/)
├─ Interface: IRepository<T, Cond, Update>
├─ Methods: get, insert, findByCond, update, delete, list
└─ Câu hỏi: Repository cung cấp methods nào?

Bước 8️⃣: Đọc Repository Implementation
├─ File: src/modules/user/infras/repository/nosql/mongodb-repo.ts
├─ Tập trung: insert() method (cái chúng ta gọi trong register)
├─ Lưu ý: Nó sử dụng UserModel như thế nào
└─ Câu hỏi: Nó chèn vào MongoDB như thế nào?

Bước 9️⃣: Đọc Mongoose Schema
├─ File: src/modules/user/infras/repository/nosql/dto.ts
├─ Schema: UserSchema (trường, kiểu, xác thực, index)
└─ Câu hỏi: Cấu trúc nào được lưu vào MongoDB?

Bước 🔟: Đọc JWT/Token Generation
├─ File: src/share/component/jwt.ts
├─ Function: generateToken({ sub, role })
└─ Câu hỏi: Bên trong token là gì? Nó có giá trị bao lâu?
```

---

### 🔍 MỘT SỐ MẪU ĐỌC THỰC TẾ

#### **Mẫu 1: Theo dõi một tính năng (Register → Login)**

```typescript
// CÂU HỎI: Chuyện gì xảy ra khi user đăng ký?
// THEO DÕI:

1. Mở: src/modules/auth/infras/transport/index.ts
   ↓ Tìm: registerAPI(req: Request, res: Response)
   ↓ Đọc function:

   async registerAPI(req: Request, res: Response) {
     try {
       const userId = await this.usecase.register(req.body);
       const token = await jwtProvider.generateToken({ ... });
       res.status(201).json({ data: { token, userId } });
     } catch (error) { ... }
   }

   ✓ Hiểu: Nhận req.body, gọi usecase.register(), trả token+userId

2. Mở: src/modules/auth/usecase/index.ts
   ↓ Tìm: register(data: RegistrationDTO): Promise<string>
   ↓ Đọc từng dòng:

   - Dòng: dto = RegistrationDTOSchema.parse(data)
     ✓ Hiểu: Xác thực input

   - Dòng: existedByPhone = await userRepository.findByCond({ phone })
     ✓ Hiểu: Kiểm tra phone tồn tại trong DB

   - Dòng: hashPassword = await bcrypt.hash(`${password}.${salt}`, 10)
     ✓ Hiểu: Hash password (không reversible)

   - Dòng: await userRepository.insert(newUser)
     ✓ Hiểu: Lưu vào MongoDB

   - Dòng: return newId
     ✓ Hiểu: Trả về user ID

3. Mở: src/modules/user/infras/repository/nosql/mongodb-repo.ts
   ↓ Tìm: insert(user: User): Promise<boolean>
   ↓ Đọc:

   async insert(user: User): Promise<boolean> {
     await UserModel.create(user);
     return true;
   }

   ✓ Hiểu: Dùng Mongoose model để lưu

4. Mở: src/modules/user/infras/repository/nosql/dto.ts
   ↓ Tìm: UserSchema
   ↓ Đọc trường nào khớp với đối tượng user

   ✓ Hiểu: Schema xác thực cái gì vào DB
```

---

#### **Mẫu 2: Tìm nơi cái gì xảy ra**

**Q: "Số điện thoại được xác thực ở đâu?"**

```
Chiến lược: Tìm từ khóa "phone"

1. Tìm: grep "phone" src/modules/auth/model/dto.ts
   ↓ Tìm: phone: UserPhoneSchema

2. Tìm: grep -r "UserPhoneSchema" src/modules/user/model/
   ↓ Tìm: model.ts có mẫu regex thực tế

3. Mở: src/modules/user/model/model.ts
   ↓ Tìm: UserPhoneSchema = z.string().regex(/^\+?[0-9]{8,15}$/)

✓ TÌM THẤY: Xác thực phone ở model.ts dùng Zod + regex!
```

**Q: "Password được hash ở đâu?"**

```
Chiến lược: Tìm "bcrypt" hoặc "hash"

1. grep -r "bcrypt.hash" src/modules/
   ↓ Kết quả: auth/usecase/index.ts (registration)
   ↓ Kết quả: user/usecase/index.ts (profile update)

2. Mở: src/modules/auth/usecase/index.ts
   ↓ Tìm: bcrypt.hash(`${dto.password}.${salt}`, 10)

3. Hiểu: Dùng salt + password, hash 10 vòng

✓ TÌM THẤY: Hashing xảy ra ở AuthUseCase.register()!
```

**Q: "Token được xác thực ở đâu?"**

```
Chiến lược: Tìm "verifyToken" hoặc "introspect"

1. grep -r "verifyToken" src/modules/
   ↓ Kết quả: auth/usecase/index.ts có verifyToken()

2. grep -r "introspect" src/
   ↓ Kết quả: auth/infras/transport/index.ts có introspectAPI()
   ↓ Kết quả: auth/usecase/index.ts có introspect()

3. Mở: src/modules/auth/usecase/index.ts
   ↓ Tìm: introspect(token) gọi verifyToken()

4. Mở: src/share/middleware/auth.ts
   ↓ Tìm: Middleware gọi introspect ở đâu

✓ TÌM THẤY: Token được xác thực ở 2 nơi:
   - Trực tiếp: /auth/introspect endpoint
   - Middleware: /profile và các API bảo vệ khác
```

---

### 📚 THAM CHIẾU ĐỌC FILE

#### **Theo Mục Đích:**

**"Tôi muốn hiểu ĐĂNG KÝ"**

```
1. src/modules/auth/infras/transport/index.ts → registerAPI()
2. src/modules/auth/model/dto.ts → RegistrationDTOSchema
3. src/modules/auth/usecase/index.ts → register() method
4. src/modules/user/model/model.ts → User type
5. src/modules/user/infras/repository/nosql/mongodb-repo.ts → insert()
```

**"Tôi muốn hiểu ĐĂNG NHẬP"**

```
1. src/modules/auth/infras/transport/index.ts → loginAPI()
2. src/modules/auth/model/dto.ts → LoginDTOSchema
3. src/modules/auth/usecase/index.ts → login() method
4. src/share/component/jwt.ts → generateToken()
```

**"Tôi muốn hiểu XÁC THỰC TOKEN"**

```
1. src/modules/auth/infras/transport/index.ts → introspectAPI()
2. src/modules/auth/usecase/index.ts → introspect() + verifyToken()
3. src/share/component/jwt.ts → verifyToken()
4. src/share/middleware/auth.ts → middleware gọi introspect
```

**"Tôi muốn hiểu LẤY HỒ SƠ"**

```
1. src/modules/user/infras/transport/index.ts → profileAPI()
2. src/modules/user/usecase/index.ts → profile() method
3. src/modules/user/infras/repository/nosql/mongodb-repo.ts → get()
4. src/share/middleware/auth.ts → kiểm tra auth
```

**"Tôi muốn hiểu TÌM KIẾM NGƯỜI DÙNG"**

```
1. src/modules/user/infras/transport/index.ts → searchByPhoneAPI()
2. src/modules/user/usecase/index.ts → searchByPhone() method
3. src/modules/user/model/model.ts → User privacy schema
4. src/modules/user/infras/repository/nosql/mongodb-repo.ts → findByCond()
```

---

### 🎓 FILE CHÍNH CẦN HIỂU TRƯỚC

**PHẢI ĐỌC (Theo Thứ Tự):**

1. **`src/modules/auth/index.ts`**
   - Cái gì: Module entry point
   - Tại sao: Xem AuthUseCase được tạo và routes được setup
   - Thời gian: 2 phút

2. **`src/modules/auth/model/dto.ts`**
   - Cái gì: Input schemas (RegistrationDTO, LoginDTO)
   - Tại sao: Hiểu quy tắc xác thực dữ liệu
   - Thời gian: 3 phút

3. **`src/modules/auth/usecase/index.ts`**
   - Cái gì: Lõi logic xác thực
   - Tại sao: Xem register(), login(), verifyToken() được triển khai
   - Thời gian: 10 phút (ĐỌC CHẬM!)

4. **`src/modules/auth/infras/transport/index.ts`**
   - Cái gì: HTTP handlers cho endpoints xác thực
   - Tại sao: Xem yêu cầu map như thế nào đến usecase calls
   - Thời gian: 5 phút

5. **`src/modules/user/model/model.ts`**
   - Cái gì: Định nghĩa thực thể người dùng
   - Tại sao: Hiểu dữ liệu nào một User có
   - Thời gian: 3 phút

6. **`src/modules/user/infras/repository/nosql/mongodb-repo.ts`**
   - Cái gì: Phương thức truy cập cơ sở dữ liệu
   - Tại sao: Xem dữ liệu được lưu/lấy như thế nào
   - Thời gian: 5 phút

7. **`src/modules/user/infras/repository/nosql/dto.ts`**
   - Cái gì: Định nghĩa MongoDB schema
   - Tại sao: Hiểu cấu trúc DB
   - Thời gian: 3 phút

8. **`src/share/component/jwt.ts`**
   - Cái gì: JWT token generation/verification
   - Tại sao: Hiểu vòng đời token
   - Thời gian: 3 phút

9. **`src/share/middleware/auth.ts`**
   - Cái gì: Token verification middleware
   - Tại sao: Xem routes bảo vệ hoạt động
   - Thời gian: 3 phút

---

### 🚀 BÀI TẬP THỰC HÀNH

#### **Bài 1: Theo dõi Đăng Ký (Mới bắt đầu)**

```
NHIỆM VỤ: Theo dõi yêu cầu POST /auth/register hoàn toàn

LÀM NHƯ SAU:
1. Mở: src/modules/auth/infras/transport/index.ts
   └─ Tìm registerAPI() method
   └─ Thêm console.log ở mỗi bước:
      - console.log("1. Nhận:", req.body)
      - console.log("2. Tạo userId:", userId)
      - console.log("3. Tạo token:", token)

2. Mở: src/modules/auth/usecase/index.ts
   └─ Tìm register() method
   └─ Thêm console.log ở mỗi bước:
      - console.log("Xác thực DTO")
      - console.log("Kiểm tra phone tồn tại")
      - console.log("Hash password")
      - console.log("Đang chèn user...")

3. Chạy đăng ký với curl (xem ví dụ curl dưới)
4. Kiểm tra console output để thấy flow

KẾT QUẢ: Bạn sẽ thấy thứ tự hoạt động chính xác!
```

#### **Bài 2: Theo dõi Đăng Nhập → Lấy Hồ Sơ (Trung bình)**

```
NHIỆM VỤ: Theo dõi đăng nhập, lấy token, rồi dùng để lấy hồ sơ

LÀM NHƯ SAU:
1. POST /auth/login → lấy token
2. Dùng token ở GET /auth/introspect → xác thực token
3. Dùng token ở GET /profile → lấy user với auth

CÂU HỎI CẦN TRẢ LỜI:
- Cái gì thay đổi từ yêu cầu 1→2→3?
- Token được kiểm tra ở đâu?
- Chuyện gì xảy ra nếu token sai?
- User ID được lấy từ token ở đâu?

THEO DÕI CODE:
- Endpoint: POST /auth/login → introspectAPI → verifyToken
- Endpoint: GET /profile → middleware → useCase.profile
```

#### **Bài 3: Tìm một Tính Năng (Nâng cao)**

```
NHIỆM VỤ: Hiểu tính năng searchByPhone

LÀM NHƯ SAU:
1. GREP: grep -r "searchByPhone" src/
   └─ Tìm tất cả tham chiếu đến method này

2. Tìm 3 vị trí:
   - HTTP handler: infras/transport/index.ts
   - UseCase: usecase/index.ts
   - Repository: repository/nosql/mongodb-repo.ts

3. Đọc mỗi file và theo dõi:
   - HTTP endpoint chấp nhận tham số gì?
   - useCase làm gì với những tham số đó?
   - Repository thực thi truy vấn nào?
   - Kiểm tra quyền riêng tư nào được làm?
   - Trường nào được trả về? (password/salt bị xoá?)

4. CURL TEST: Thử endpoint tìm kiếm với số điện thoại
```

---

### 💡 MẸO ĐỌC

**Mẹo 1: Đừng Đọc Từ Trên Xuống Dưới**

```
❌ XỨ: Đọc index.ts từ dòng 1 đến cuối
✅ TỐTƠN:
  - Lướt qua cấu trúc file trước
  - Tìm function/class cụ thể bạn quan tâm
  - Đọc function đó hoàn toàn
  - Nhảy đến file liên quan
```

**Mẹo 2: Theo Dõi Flow, Không Phải File**

```
❌ XỨ: Đọc auth/usecase/index.ts, rồi auth/infras, rồi user
✅ TỐTƠN:
  - Bắt đầu từ HTTP handler
  - Nhảy đến useCase method nó gọi
  - Nhảy đến repository method nó gọi
  - Quay lại nếu bạn cần hiểu sub-steps
```

**Mẹo 3: Thêm console.log Để Hiểu**

```
// Khi bối rối về giá trị:
console.log("Tên biến:", tenBien);
console.log("Loại:", typeof tenBien);
console.log("Toàn bộ object:", JSON.stringify(tenBien, null, 2));
```

**Mẹo 4: Vẽ Sơ Đồ Flow**

```
Khi đọc logic phức tạp, vẽ mũi tên:

registerAPI
  ↓
useCase.register()
  ├─ validate(dto)
  ├─ check exists
  ├─ hash password
  └─ repository.insert()

Hình ảnh trực quan giúp hiểu tốt hơn!
```

**Mẹo 5: Hỏi "Tại Sao" Không Chỉ "Cái Gì"**

```
❌ XỨ: "useCase.register gọi repository.insert"
✅ TỐTƠN: "Tại sao register gọi insert? Để lưu user vào DB"
✅ TỐT HƠN: "Tại sao gọi repository thay vì MongoDB trực tiếp?
              → Abstraction, có thể đổi db, testability"
```

---

### 🔗 DANH SÁCH KIỂM TRA LAYER

```
TRANSPORT LAYER (HTTP Handlers)
├─ Câu hỏi: HTTP request vào ở đâu?
├─ Files: **/infras/transport/index.ts
├─ Làm: Trích xuất dữ liệu yêu cầu, gọi useCase, định dạng phản hồi
└─ Nhớ: Luôn bao bọc useCase trong try/catch

USECASE LAYER (Business Logic)
├─ Câu hỏi: Kiểm tra xác thực gì xảy ra? Quy tắc kinh doanh là gì?
├─ Files: **/usecase/index.ts
├─ Làm: Xác thực, chuyển đổi, gọi repository, xây dựng phản hồi
└─ Nhớ: Không có kiến thức HTTP ở đây, logic kinh doanh thuần túy

REPOSITORY LAYER (Data Access)
├─ Câu hỏi: Dữ liệu được lưu giữ như thế nào? Truy vấn được xây dựng như thế nào?
├─ Files: **/infras/repository/**/*.ts
├─ Làm: QueryDB, map results, xử lý DB errors
└─ Nhớ: Chi tiết triển khai, có thể được thay thế

MODEL LAYER (Data Shape)
├─ Câu hỏi: Trường nào tồn tại? Loại nào? Xác thực nào?
├─ Files: **/model/model.ts + **/model/dto.ts
├─ Làm: Định nghĩa entity, xác thực input, chuyển đổi output types
└─ Nhớ: Schema là hợp đồng giữa các layer
```

### 1️⃣ REGISTRATION FLOW

```
Client Request:
POST /v1/auth/register
Content-Type: application/json
{
  "phone": "+84912345678",
  "password": "MyPassword123",
  "email": "user@example.com",
  "displayName": "John Doe"
}

Route: router.post("/auth/register", httpService.registerAPI.bind(httpService))
    ↓
File: src/modules/auth/infras/transport/index.ts::AuthHTTPService.registerAPI()
    ↓
Logic:
  1. httpService.registerAPI()
     ├─ Parse req.body
     └─ Call authUseCase.register(req.body)

  2. authUseCase.register(data)  [src/modules/auth/usecase/index.ts]
     ├─ Validate with Zod: RegistrationDTOSchema.parse(data)
     ├─ Normalize phone: phone.replace(/\s+/g, "") → "+84912345678"
     ├─ Check phone exists: userRepository.findByCond({ phone })
     │  └─ If exists → throw ErrPhoneExisted
     ├─ Check email exists (if provided): userRepository.findByCond({ email })
     │  └─ If exists → throw ErrEmailExisted
     ├─ Hash password: bcrypt.hash(`${password}.${salt}`, 10)
     ├─ Create newUser object with:
     │  ├─ id: v7() (UUID)
     │  ├─ phone, email, password (hashed), salt
     │  ├─ status: ACTIVE (default)
     │  ├─ displayName (or fallback to email or phone)
     │  ├─ verified: { email: !!email, phone: false }
     │  ├─ privacy: { searchableByEmail: true, searchableByPhone: true, searchableByUsername: true }
     │  ├─ settings: { notifications: { push: true, inApp: true } }
     │  └─ createdAt, updatedAt: new Date()
     ├─ Save to DB: userRepository.insert(newUser)
     │  └─ MongoDB: db.users.insertOne(newUser)
     └─ Return: newId

  3. Generate token: jwtProvider.generateToken({ sub: userId, role: USER })
     └─ Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

  4. Return response:
     {
       "data": {
         "token": "eyJhbGc...",
         "userId": "f47ac10b-58cc..."
       }
     }
```

**Key Points:**

- ✅ Registration now in **AUTH module**, not User module
- ✅ Password hashed with `bcrypt` + salt
- ✅ Phone & email are unique in database
- ✅ User includes `verified`, `privacy`, `settings` configuration
- ✅ Token generated in HTTP service after successful registration
- ✅ Only userId returned (not full user object)

---

### 2️⃣ LOGIN FLOW

```
Client Request:
POST /v1/auth/login
{
  "phone": "+84912345678",
  "password": "MyPassword123"
}

// OR with email:
{
  "email": "user@example.com",
  "password": "MyPassword123"
}

Route: router.post("/auth/login", httpService.loginAPI.bind(httpService))
    ↓
File: src/modules/auth/infras/transport/index.ts::AuthHTTPService.loginAPI()
    ↓
Logic:
  1. httpService.loginAPI()
     ├─ Call authUseCase.login(req.body)  [src/modules/auth/usecase/index.ts]

  2. authUseCase.login(data)
     ├─ Validate: LoginDTOSchema.parse(data)
     │  └─ Check: email XOR phone (one must be provided)

     ├─ Build condition:
     │  ├─ If phone provided: cond = { phone: normalizePhone(phone) }
     │  └─ If email provided: cond = { email }

     ├─ Find user: userRepository.findByCond(cond)
     │  └─ If not found → throw ErrInvalidCredentials

     ├─ Compare password (constant-time comparison):
     │  ├─ Input: `${password}.${user.salt}`
     │  ├─ Stored: user.password (bcrypt hash)
     │  ├─ Use bcrypt.compare()
     │  └─ If not match → throw ErrInvalidCredentials

     ├─ Check user status:
     │  └─ If status === DISABLED → throw ErrUserInactivated

     ├─ Update last login:
     │  └─ userRepository.update(user.id, { lastLoginAt: new Date() })

     └─ Generate & return JWT token:
        └─ jwtProvider.generateToken({ sub: userId, role: USER })

  3. httpService returns response:
     {
       "data": {
         "token": "eyJhbGc..."
       }
     }

Client:
  ├─ Save token to localStorage
  ├─ Set header: Authorization: Bearer eyJhbGc...
  └─ All future requests include this header
```

**Key Points:**

- ✅ Login now uses **AuthUseCase** in auth module
- ⚠️ Error message intentionally vague ("invalid email/password") for security
- ✅ Password comparison uses bcrypt.compare (constant time, safe)
- ✅ lastLoginAt updated for analytics
- ✅ Only token returned (not user details)

---

### 3️⃣ TOKEN VERIFICATION & INTROSPECTION

```
Two ways to verify token:

METHOD 1: Via Auth Introspect Endpoint (Internal)
POST /rpc/auth/introspect
{
  "token": "eyJhbGc..."
}

Route: router.post("/auth/introspect", httpService.introspectAPI.bind(httpService))
    ↓
authUseCase.introspect(token)
    ├─ Try to call verifyToken(token)
    ├─ If valid → return { sub, role }
    └─ If invalid → return null

METHOD 2: In Middleware (Protected APIs)
GET /v1/profile
Headers: Authorization: Bearer eyJhbGc...

Middleware: mdlFactory.auth
    ↓
File: src/share/middleware/auth.ts
    ↓
Logic:
  1. Extract token from "Authorization: Bearer {token}"
  2. Call RPC: POST /rpc/auth/introspect { token }
     └─ Returns: { sub: userId, role: USER } or error
  3. Set request context:
     └─ res.locals["requester"] = { sub: userId, role: USER }
  4. Pass to next middleware/handler
```

**Key Points:**

- ✅ New `/auth/introspect` endpoint for token validation
- ✅ AuthUseCase has both `verifyToken()` and `introspect()` methods
- ✅ `introspect()` safely handles invalid tokens (returns null instead of error)
- ✅ `verifyToken()` throws error if token invalid/expired

---

### 4️⃣ PROTECTED API (GET PROFILE) FLOW

```
Client Request:
GET /v1/profile
Headers: Authorization: Bearer eyJhbGc...

Middleware: mdlFactory.auth
    ↓
File: src/share/middleware/auth.ts
    ↓
Logic:
  1. Extract token from "Authorization: Bearer {token}"
  2. Call RPC: POST /rpc/auth/introspect { token }
     └─ Returns: { sub: userId, role: USER }
  3. Set request context:
     └─ res.locals["requester"] = { sub: userId, role: USER }
  4. Pass to handler
     ↓
Route: router.get("/profile", mdlFactory.auth, userHttpService.profileAPI.bind(...))
    ↓
Handler [src/modules/user/infras/transport/index.ts]:
  1. Get requester from res.locals["requester"]
  2. Call useCase.profile(userId)
  3. Get user from repository
  4. Remove sensitive fields (password, salt)
  5. Return response:
     {
       "data": {
         "id": "...",
         "phone": "+84912345678",
         "email": "user@example.com",
         "displayName": "John Doe",
         "avatarUrl": "https://...",
         "bio": "Software engineer",
         "verified": { "email": true, "phone": false },
         "privacy": { "searchableByEmail": true, ... },
         "settings": { "notifications": { "push": true, ... } },
         "lastLoginAt": "2024-04-04T10:30:00Z"
       }
     }
```

**Key Points:**

- 🔐 Token verified at middleware via `/auth/introspect`
- ✅ Only authenticated users can access /profile
- ✅ Returns full user object with verified, privacy, settings
- ✅ Password & salt never exposed to client

---

## 📊 API ENDPOINT MAPPING

### Auth Endpoints (Authentication)

| Method | Endpoint           | Protected | Handler                           | Business Logic                         |
| ------ | ------------------ | --------- | --------------------------------- | -------------------------------------- |
| POST   | `/auth/register`   | ❌        | `AuthHTTPService.registerAPI()`   | Create new user + return token         |
| POST   | `/auth/login`      | ❌        | `AuthHTTPService.loginAPI()`      | Validate credentials + return token    |
| POST   | `/auth/introspect` | ❌        | `AuthHTTPService.introspectAPI()` | Verify token (returns null if invalid) |

### User Endpoints (User Management)

| Method | Endpoint                  | Protected | Handler                              | Business Logic                             |
| ------ | ------------------------- | --------- | ------------------------------------ | ------------------------------------------ |
| GET    | `/profile`                | ✅        | `UserHTTPService.profileAPI()`       | Get current user profile                   |
| PATCH  | `/profile`                | ✅        | `UserHTTPService.updateProfileAPI()` | Update current user profile                |
| GET    | `/users/search?phone=...` | ✅        | `UserHTTPService.searchByPhoneAPI()` | Search user by phone (returns public info) |
| GET    | `/users/:id`              | ❌        | `UserHTTPService.getDetailAPI()`     | Get public user info (no auth required)    |
| GET    | `/presence/:id`           | ❌        | `UserHTTPService.getPresenceAPI()`   | Get user online status & last seen         |
| GET    | `/users`                  | ❌        | `UserHTTPService.listAPI()`          | List all users (paginated, public info)    |

---

## 🔑 KEY CONCEPTS

### Authentication Architecture (Auth Module)

```
AuthHTTPService (HTTP Layer)
    ↓ receives request
AuthUseCase (Business Logic)
    ├─ register() → create user with verified/privacy/settings
    ├─ login() → password verification + token generation
    ├─ verifyToken() → JWT validation + user check
    └─ introspect() → safe token verification wrapper
    ↓
UserRepository (Data Access)
    └─ findByCond(), insert(), update(), get()
```

**Why separate auth from user module?**

- ✅ Auth is stateless and independent
- ✅ Can be scaled separately
- ✅ Clear separation of concerns
- ✅ Easier to test authentication logic

### User Model Structure

```typescript
User {
  // Core identity
  id: string (UUID v7)
  email?: string (unique, optional)
  phone: string (unique, validated)
  username?: string

  // Security
  password: string (bcrypt hash)
  salt: string (for additional security)
  status: UserStatus (ACTIVE | DISABLED)
  lastLoginAt?: Date

  // Verification flags
  verified: {
    email: boolean    // Set to true if email provided in registration
    phone: boolean    // Set to false initially, verified via OTP later
  }

  // Privacy settings
  privacy: {
    searchableByEmail: boolean
    searchableByPhone: boolean
    searchableByUsername: boolean
  }

  // User settings
  settings: {
    notifications: {
      push: boolean
      inApp: boolean
    }
  }

  // Profile info
  displayName?: string
  avatarUrl?: string
  bio?: string
  lastSeen?: Date

  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### Bcrypt (Password Hashing)

```typescript
// During registration
const salt = bcrypt.genSaltSync(10); // Generate random salt
const hashPassword = await bcrypt.hash(`${password}.${salt}`, 10);
// Store: { password: hashPassword, salt: salt }

// During login
const isMatch = await bcrypt.compare(
  `${inputPassword}.${userSalt}`, // Input + salt
  storedHashPassword, // Stored hash
);
// Returns true/false
```

**Why salt?**

- ✅ Prevents rainbow table attacks
- ✅ Same password produces different hash each time
- ✅ Makes pre-computed hash attacks infeasible

---

### JWT Token

```typescript
// Generation (after successful auth)
token = jwtProvider.generateToken({
  sub: userId, // Subject (user ID)
  role: UserRole.USER, // User role
  // auto-added by JWT: iat (issued at), exp (expires at)
});

// Token structure:
// Header.Payload.Signature

// Verification (middleware/introspect)
const payload = jwtProvider.verifyToken(token);
// Returns: { sub, role, iat, exp }
// Throws if: invalid signature, expired, malformed
```

**JWT advantages:**

- ✅ Stateless (no server-side session needed)
- ✅ Scalable (works across multiple servers)
- ✅ Self-contained claims (user ID, role embedded)
- ✅ Cryptographically signed (tamper-proof)

---

### Repository Pattern

```typescript
// Benefits:
// ✅ Abstraction: Switch db (MongoDB → PostgreSQL) without changing usecase
// ✅ Testability: Mock repository in unit tests
// ✅ Clarity: DB logic separated from business logic

interface IRepository<Entity, Condition, UpdateDTO> {
  get(id: string): Promise<Entity | null>;
  findByCond(cond: Condition): Promise<Entity | null>;
  insert(data: Entity): Promise<boolean>;
  update(id: string, data: UpdateDTO): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  list(cond: Condition, paging: PagingDTO): Promise<Entity[]>;
}

// Auth usecase depends on abstraction, not implementation
class AuthUseCase {
  constructor(private userRepository: IRepository) {}

  async register(data) {
    await this.userRepository.insert(user); // Can swap implementation
  }
}
```

---

## 📋 CODE ANATOMY BY FILE

### AUTH Module Files

#### `auth/model/dto.ts` - AUTH INPUT VALIDATION

```typescript
// What: Defines shapes of incoming auth requests
// How: Zod schemas with validation rules
// Use: Validates registration and login payloads

export const RegistrationDTOSchema = z.object({
  email: z.string().email().optional(),
  phone: UserPhoneSchema, // Reuses user module schema
  password: z.string().min(6),
  displayName: z.string().optional(),
});

export const LoginDTOSchema = z
  .object({
    email: z.string().email().optional(),
    phone: UserPhoneSchema.optional(),
    password: z.string().min(6),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone must be provided",
  });

// Usage in usecase
const dto = RegistrationDTOSchema.parse(data);
// If invalid → throws ZodError
```

---

#### `auth/model/errors.ts` - AUTH ERROR DEFINITIONS

```typescript
// What: Predefined auth errors with consistent messages
// How: Error objects, can wrap with AppError
// Use: Throw specific errors from usecase

export const ErrInvalidCredentials = new Error("Invalid email and password");
export const ErrEmailExisted = new Error("Email already exists");
export const ErrPhoneExisted = new Error("Phone number already exists");
export const ErrUserInactivated = new Error("User is inactivated or banned");
export const ErrInvalidToken = new Error("Invalid or expired token");

// Usage in usecase
if (existedByPhone) {
  throw AppError.from(ErrPhoneExisted, 400);
}
```

---

#### `auth/usecase/index.ts` - AUTH BUSINESS LOGIC

```typescript
// What: Implements auth workflows
// How: Methods that orchestrate password verification, token generation, etc.
// Use: Called by AuthHTTPService

export class AuthUseCase implements IAuthUseCase {
  constructor(private userRepository: IRepository) {}

  async register(data: RegistrationDTO): Promise<string>;
  // 1. Validate with Zod
  // 2. Check phone/email not exists
  // 3. Hash password with bcrypt
  // 4. Create user doc with initial settings
  // 5. Insert to DB
  // 6. Return userId

  async login(data: LoginDTO): Promise<string>;
  // 1. Validate with Zod
  // 2. Find user by phone or email
  // 3. Compare password with bcrypt
  // 4. Check user status (not disabled)
  // 5. Update lastLoginAt
  // 6. Return JWT token

  async verifyToken(token: string): Promise<TokenPayload>;
  // 1. Verify JWT signature and expiration
  // 2. Get user from DB (verify still exists)
  // 3. Check user status (not disabled)
  // 4. Return { sub, role }

  async introspect(token: string): Promise<TokenPayload | null>;
  // 1. Try verifyToken()
  // 2. Return payload if valid, null if invalid
  // (Never throws, safe for external use)
}
```

---

#### `auth/infras/transport/index.ts` - AUTH API HANDLERS

```typescript
// What: HTTP request → response mapping
// How: Express route handlers
// Use: Receives HTTP request, calls usecase, formats response

export class AuthHTTPService {
  constructor(private usecase: IAuthUseCase) {}

  async registerAPI(req: Request, res: Response);
  // 1. Call useCase.register(req.body)
  // 2. Generate JWT token
  // 3. Return 201 + { token, userId }
  // On error: return 422 + error message

  async loginAPI(req: Request, res: Response);
  // 1. Call useCase.login(req.body)
  // 2. Return 200 + { token }
  // On error: return 401 + error message

  async introspectAPI(req: Request, res: Response);
  // 1. Extract token from req.body
  // 2. Call useCase.introspect(token)
  // 3. Return 200 + { sub, role } if valid
  // 4. Return 400 if invalid (no error thrown)
}
```

---

### USER Module Files

#### `user/model/model.ts` - USER DOMAIN ENTITIES

```typescript
// What: Defines User entity across the system
// How: TypeScript types + Zod schemas
// Use: Type safety, validation

export enum UserStatus {
  ACTIVE = "active",
  DISABLED = "disabled"
}

// Verification state tracks what's been verified
export type UserVerified = {
  email: boolean         // true if email confirmed
  phone: boolean         // true if phone confirmed via OTP
}

// Privacy controls
export type UserPrivacy = {
  searchableByEmail: boolean
  searchableByPhone: boolean
  searchableByUsername: boolean
}

// User preferences
export type UserSettings = {
  notifications: {
    push: boolean
    inApp: boolean
  }
}

// Full user entity
export type User = {
  id: string
  email?: string
  phone: string
  username?: string
  password: string (never exposed to client)
  salt: string (never exposed to client)
  status: UserStatus
  verified: UserVerified
  displayName?: string
  avatarUrl?: string
  bio?: string
  privacy: UserPrivacy
  settings: UserSettings
  lastLoginAt?: Date
  lastSeen?: Date
  createdAt: Date
  updatedAt: Date
}
```

---

#### `user/model/dto.ts` - USER DTOs

```typescript
// What: Input validation and data transfer objects
// How: Zod schemas (create, update, search conditions)
// Use: When creating/updating/searching users

export const UserCreateSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  username: z.string().optional(),
  password: z.string(),
  salt: z.string(),
  displayName: z.string().optional(),
  // ... verified, privacy, settings, etc.
});

export const UserUpdateSchema = z.object({
  // All fields optional (user updates what they want)
  email: z.string().email().optional(),
  password: z.string().optional(),
  displayName: z.string().optional(),
  // ...
});

export const UserCondDTOSchema = z.object({
  // For searching/filtering
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  "verified.email": z.boolean().optional(),
  "verified.phone": z.boolean().optional(),
});
```

---

#### `user/usecase/index.ts` - USER BUSINESS LOGIC

```typescript
// What: User management workflows
// How: Methods for profile access, updates, search, etc.
// Use: Called by UserHTTPService (not auth-related)

export class UserUseCase implements IUserUseCase {
  constructor(private repository: IRepository<User, ...>) {}

  async profile(userId: string): Promise<User>
    // Get current user's own profile

  async searchByPhone(phone: string): Promise<User | null>
    // Search public user by phone (respects privacy settings)

  async updateProfile(requester: Requester, data: UserUpdateDTO): Promise<boolean>
    // User updates own profile
    // If password provided, hash it first

  async getDetail(id: string): Promise<User | null>
    // Get public user info (no password/salt)

  async list(cond: UserCondDTO, paging: PagingDTO): Promise<User[]>
    // List users with pagination

  async update(id: string, data: UserUpdateDTO): Promise<boolean>
    // Admin: update any user

  async delete(id: string): Promise<boolean>
    // Soft delete user (set status = DISABLED)
}
```

---

#### `user/infras/transport/index.ts` - USER API HANDLERS

```typescript
// What: HTTP request → user response mapping
// How: Express route handlers
// Use: Handles /profile, /users/*, /presence endpoints

export class UserHTTPService extends BaseHttpService {
  constructor(
    readonly usecase: IUserUseCase,
    private presenceUseCase: IPresenceUseCase,
  ) {}

  async profileAPI(req: Request, res: Response);
  // GET /profile
  // 1. Get requester from middleware
  // 2. Call useCase.profile(userId)
  // 3. Remove password/salt fields
  // 4. Return user with verified/privacy/settings

  async updateProfileAPI(req: Request, res: Response);
  // PATCH /profile
  // 1. Get requester from middleware
  // 2. Call useCase.updateProfile(requester, req.body)
  // 3. Return true if successful

  async searchByPhoneAPI(req: Request, res: Response);
  // GET /users/search?phone=...
  // 1. Validate phone query param
  // 2. Call useCase.searchByPhone(phone)
  // 3. Return public user info (no password)

  async getPresenceAPI(req: Request, res: Response);
  // GET /presence/:id
  // 1. Get user ID from params
  // 2. Call presenceUseCase.getUserPresence(id)
  // 3. Return { userId, isOnline, lastSeen }
}
```

---

#### `user/infras/repository/nosql/mongodb-repo.ts` - DATA PERSISTENCE

```typescript
// What: How to persist/retrieve data from MongoDB
// How: Extends BaseRepositoryMongoose with MongoDB queries
// Use: Called by usecase

export class MongoUserRepository implements IRepository {
  async insert(user: User): Promise<boolean>;
  // db.users.insertOne(user)

  async get(id: string): Promise<User | null>;
  // db.users.findById(id)

  async findByCond(cond: UserCondDTO): Promise<User | null>;
  // db.users.findOne(cond)
  // Supports: phone, email, status, verified fields, privacy fields

  async update(id: string, data: UserUpdateDTO): Promise<boolean>;
  // db.users.findByIdAndUpdate(id, data)

  async list(cond: UserCondDTO, paging: PagingDTO): Promise<User[]>;
  // db.users.find(cond).skip().limit()
}
```

---

#### `user/infras/repository/nosql/dto.ts` - MONGODB SCHEMA

```typescript
// What: MongoDB collection structure & validation
// How: Mongoose schema definition
// Use: When saving/retrieving from MongoDB

const UserSchema = new Schema<IUserDocument>({
  _id: { type: String, required: true },
  phone: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  username: { type: String, sparse: true },
  password: { type: String, required: true },
  salt: { type: String, required: true },
  status: { type: String, enum: [ACTIVE, DISABLED], default: ACTIVE },
  verified: {
    email: { type: Boolean, default: false },
    phone: { type: Boolean, default: false },
  },
  privacy: {
    searchableByEmail: { type: Boolean, default: true },
    searchableByPhone: { type: Boolean, default: true },
    searchableByUsername: { type: Boolean, default: true },
  },
  settings: {
    notifications: {
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
  },
  displayName: String,
  avatarUrl: String,
  bio: String,
  lastLoginAt: Date,
  lastSeen: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes for fast queries
UserSchema.index({ phone: 1 }, { sparse: true });
UserSchema.index({ email: 1 }, { sparse: true });
UserSchema.index({ status: 1 });
```

---

## 🔍 HOW TO READ SIMILAR MODULES (Chat, Friends, etc.)

When you encounter a new module, follow this sequence:

### Step 1: Understand the Data (`model/`)

```
Read: model.ts
Ask:
  - What are the main entities? (Message, Conversation, ...)
  - What are the states/statuses? (sent, delivered, seen)
  - What are the relationships? (Message has Conversation)
```

### Step 2: Understand the Workflows (`usecase/`)

```
Read: usecase/*.ts
Ask:
  - What are 3-5 main operations? (send msg, edit, delete, react, ...)
  - What validations/checks? (user in group, message exists, ...)
  - What transformations? (normalize, hash, calculate, ...)
```

### Step 3: Understand Data Persistence (`infras/repository/`)

```
Read: repository/*.ts + schema/*.ts
Ask:
  - How is data stored? (what collections, relationships)
  - What indexes? (for fast queries)
  - What queries? (find by ID, by condition, pagination, ...)
```

### Step 4: Understand APIs (`infras/transport/`)

```
Read: http-service.ts + socket-service.ts
Ask:
  - What HTTP endpoints? (POST, GET, PATCH, DELETE)
  - What WebSocket events? (real-time updates)
  - What auth checks? (protected or public)
```

### Step 5: Trace One Flow

```
Pick one feature, trace from API → response:
  1. HTTP request arrives
  2. Route matches
  3. Middleware runs
  4. Handler calls usecase
  5. Usecase validates + calls repository
  6. Repository queries DB
  7. Response returned
```

---

### `auth/index.ts` - AUTH MODULE SETUP

```typescript
// What: Initialize auth module & setup DI
// How: Create instances, wire them together
// Use: Called once at app startup

export const setupAuthHexagon = (sctx: ServiceContext) => {
  const userRepository = new MongoUserRepository();
  const authUseCase = new AuthUseCase(userRepository); // Inject repo
  const httpService = new AuthHTTPService(authUseCase); // Inject usecase

  const router = Router();
  router.post("/auth/register", httpService.registerAPI.bind(httpService));
  router.post("/auth/login", httpService.loginAPI.bind(httpService));
  router.post("/auth/introspect", httpService.introspectAPI.bind(httpService));

  return { router, authUseCase };
};
```

---

### `user/index.ts` - USER MODULE SETUP

```typescript
// What: Initialize user module & setup DI
// How: Create instances, wire them together
// Use: Called once at app startup

export const setupUserHexagon = (sctx: ServiceContext, io?) => {
  const userRepository = new MongoUserRepository();
  const presenceRepository = new RedisPresenceRepository();
  const userUseCase = new UserUseCase(userRepository); // Inject repo
  const presenceUseCase = new PresenceUseCase(presenceRepository); // Inject repo
  const httpService = new UserHTTPService(userUseCase, presenceUseCase); // Inject both
  const socketService = new UserSocketService(userUseCase, presenceUseCase, io);

  const router = Router();
  router.get("/profile", mdlFactory.auth, httpService.profileAPI.bind(httpService));
  router.patch("/profile", mdlFactory.auth, httpService.updateProfileAPI.bind(httpService));
  router.get("/users/search", mdlFactory.auth, httpService.searchByPhoneAPI.bind(httpService));
  router.get("/presence/:id", httpService.getPresenceAPI.bind(httpService));
  router.get("/users/:id", httpService.getDetailAPI.bind(httpService));
  router.get("/users", httpService.listAPI.bind(httpService));

  return { router, socketService };
};
```

---

## 🧪 TESTING LOCALLY (CURL EXAMPLES)

### Start Server

```bash
npm start
# Server runs on http://localhost:3000
```

### 1️⃣ Test Registration

```bash
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+84912345678",
    "password": "MyPassword123",
    "email": "user@example.com",
    "displayName": "John Doe"
  }'

# Response (201 Created):
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": "f47ac10b-58cc-4c2c-90c2-b3db52e1fdf2"
  }
}

# Error Response (422 Unprocessable Entity):
{
  "message": "Phone number already exists"
}
```

### 2️⃣ Test Login

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+84912345678",
    "password": "MyPassword123"
  }'

# Response (200 OK):
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

# Error Response (401 Unauthorized):
{
  "message": "Invalid email and password"
}
```

### 3️⃣ Test Token Introspection

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3000/v1/auth/introspect \
  -H "Content-Type: application/json" \
  -d '{"token": "'$TOKEN'"}'

# Response (200 OK):
{
  "data": {
    "sub": "f47ac10b-58cc-4c2c...",
    "role": "user"
  }
}

# If invalid:
{
  "message": "Invalid token"
}
```

### 4️⃣ Test Get Profile (Protected)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3000/v1/profile \
  -H "Authorization: Bearer $TOKEN"

# Response (200 OK):
{
  "data": {
    "id": "f47ac10b-58cc-4c2c...",
    "phone": "+84912345678",
    "email": "user@example.com",
    "displayName": "John Doe",
    "avatarUrl": null,
    "bio": null,
    "verified": {
      "email": true,
      "phone": false
    },
    "privacy": {
      "searchableByEmail": true,
      "searchableByPhone": true,
      "searchableByUsername": true
    },
    "settings": {
      "notifications": {
        "push": true,
        "inApp": true
      }
    },
    "lastLoginAt": "2024-04-04T10:30:00Z",
    "createdAt": "2024-04-03T15:22:30Z",
    "updatedAt": "2024-04-03T15:22:30Z"
    // Note: password and salt are NOT included
  }
}

# If no token:
{
  "message": "Unauthorized"
}
```

### 5️⃣ Test Update Profile (Protected)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X PATCH http://localhost:3000/v1/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Jane Doe",
    "bio": "Software Engineer",
    "avatarUrl": "https://example.com/avatar.jpg"
  }'

# Response (200 OK):
{
  "data": true
}
```

### 6️⃣ Test Search User by Phone (Protected)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET "http://localhost:3000/v1/users/search?phone=%2B84912345678" \
  -H "Authorization: Bearer $TOKEN"

# Response (200 OK):
{
  "data": {
    "id": "f47ac10b-58cc-4c2c...",
    "phone": "+84912345678",
    "email": "user@example.com",
    "displayName": "John Doe",
    "avatarUrl": null,
    "bio": null,
    // privacy settings included (for your own display)
    // password and salt NOT included
  }
}

# If not found (404):
{
  "message": "User not found"
}
```

### 7️⃣ Test Get Public User Info (No Auth)

```bash
USER_ID="f47ac10b-58cc-4c2c..."

curl -X GET http://localhost:3000/v1/users/$USER_ID

# Response (200 OK):
{
  "data": {
    "id": "f47ac10b-58cc-4c2c...",
    "displayName": "John Doe",
    "avatarUrl": null,
    "bio": null,
    // Only public info, no email, phone, verified, settings
  }
}
```

### 8️⃣ Test Get Presence (No Auth)

```bash
USER_ID="f47ac10b-58cc-4c2c..."

curl -X GET http://localhost:3000/v1/presence/$USER_ID

# Response (200 OK):
{
  "data": {
    "userId": "f47ac10b-58cc-4c2c...",
    "isOnline": true,
    "lastSeen": "2024-04-04T10:30:00Z"
  }
}
```

---

## 🎓 LEARNING CHECKLIST

- [ ] Understand separation: Auth (register/login) vs User (profile/search)
- [ ] Know Auth module has: register(), login(), verifyToken(), introspect()
- [ ] Know User module has: profile(), searchByPhone(), updateProfile(), etc.
- [ ] Know why password needs hashing (bcrypt) + salt
- [ ] Know why JWT (stateless, scalable, self-contained claims)
- [ ] Know why Repository pattern (abstraction, testability)
- [ ] Can trace: register → insert user → return token
- [ ] Can trace: login → verify password → return token
- [ ] Can find where phone/email duplication checked (in AuthUseCase.register)
- [ ] Can find where token verification happens (AuthUseCase.verifyToken)
- [ ] Understand verified/privacy/settings initialization in registration
- [ ] Can debug by adding console.log in usecase methods

---

## 📚 RELATED FILES TO UNDERSTAND

- `src/share/component/jwt.ts` - JWT token generation/verification
- `src/share/middleware/auth.ts` - Token verification middleware
- `src/share/app-error.ts` - Custom error handling & logging
- `src/share/repository/repo-mongoose.ts` - Base repository classes
- `src/share/interface/service-context.ts` - ServiceContext for DI
- `.env` - Environment config (DB URI, JWT secret, JWT expire time)

---

## 🚀 COMMON ERRORS & FIXES

### ❌ Error: "Phone number already exists"

**Cause:** User already registered with this phone  
**Fix:** Try different phone or login if account exists

### ❌ Error: "Invalid email and password"

**Cause:** User not found OR password incorrect (intentionally vague for security)
**Fix:** Check phone/email spelling, verify password, try registration

### ❌ Error: "Invalid or expired token" (401 on /profile)

**Cause:** Token expired OR malformed OR invalid signature  
**Fix:** Login again to get new token

### ❌ Error: "User is inactivated or banned"

**Cause:** User status = DISABLED (set by admin)
**Fix:** Contact administrator to reactivate account

### ❌ Error: "Either email or phone must be provided" (422)

**Cause:** Both email and phone missing in login request
**Fix:** Provide at least one: phone OR email

---
