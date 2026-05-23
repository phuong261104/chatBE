# Backend Project Rules

## Tech Stack

Project hiện tại dùng:

- Node.js 22+
- TypeScript
- Express
- Socket.IO
- AWS DynamoDB
- Redis
- Zod
- JWT + bcrypt
- Swagger YAML + Swagger UI
- LiveKit
- Google Gemini
- Jest
- Docker Compose

Không dùng NestJS, TypeORM, Prisma, MongoDB hoặc Mongoose trong runtime hiện tại.

## 1. Feature Structure

Feature backend phải nằm trong `src/modules/<feature>`.

Structure khuyến nghị:

```text
src/modules/<feature>/
  index.ts
  model/
    model.ts
    dto.ts
    errors.ts
  interface/
    index.ts
  usecase/
    index.ts
    *.ts
  infras/
    repository/
      dynamodb/
    transport/
      index.ts
      socket-service.ts
```

Quy tắc:

- `index.ts` của module chịu trách nhiệm wire dependency và expose router/service.
- `model/model.ts` chứa entity schema, enum và domain type.
- `model/dto.ts` chứa request DTO schema bằng Zod.
- `model/errors.ts` chứa error dùng lại trong domain.
- `interface/index.ts` chứa port/contract để usecase không phụ thuộc trực tiếp infra.
- `usecase` chứa business rules, permission, orchestration.
- `infras/repository/dynamodb` là implementation persistence hiện tại.
- `infras/transport` chỉ parse request/socket payload và gọi usecase.

Nếu feature nhỏ, có thể gộp ít file hơn, nhưng không được đưa business logic dài vào route handler.

## 2. Naming Conventions

| Loại | Quy ước | Ví dụ |
| --- | --- | --- |
| Folder feature | kebab-case | `friend-requests`, `my-cloud` |
| File TypeScript | kebab-case hoặc tên hiện có của module | `send-message.ts`, `call-v2.service.ts` |
| Class usecase/handler | PascalCase | `SendMessageHandler`, `AuthUseCase` |
| DTO schema | PascalCase + `Schema` | `LoginDTOSchema`, `CreateCloudItemDTOSchema` |
| DTO type | PascalCase + `DTO` | `LoginDTO`, `UserUpdateDTO` |
| Error const | `Err...` | `ErrInvalidCredentials` |
| DynamoDB table logical name | UPPER_SNAKE trong `TABLE_NAMES` | `CONVERSATION_MEMBERS` |
| Socket event const | UPPER_SNAKE key, string payload theo convention hiện có | `RECEIVE_MESSAGE: "receiveMessage"` |

Không đổi tên public route/event nếu chưa có kế hoạch migration cho frontend.

## 3. Feature Boundaries

- Feature chỉ expose behavior qua usecase/interface hoặc setup function.
- Không import trực tiếp repository implementation của feature khác từ usecase nếu đã có contract phù hợp.
- Cross-feature dependency phải rõ ràng trong module setup.
- Shared helper thật sự dùng chung mới đặt ở `src/share`.
- Không đặt logic nghiệp vụ feature vào `src/share`.

Ví dụ hợp lệ:

- Chat cần user lookup: dùng adapter/port cho user query.
- Call cần phát message log: inject message emitter hoặc chat service đã được thiết kế cho việc đó.

## 4. DTO and Validation

- Request body/query/params phải được validate bằng Zod ở boundary gần transport hoặc usecase.
- DTO schema đặt trong `model/dto.ts` hoặc file DTO con nếu feature lớn.
- Domain model schema đặt trong `model/model.ts`.
- Không tin input từ client, kể cả `userId` trong body.
- User hiện tại lấy từ `res.locals.requester.sub` sau auth middleware.
- ID từ path/query/body phải được normalize thành string trước khi gọi usecase.

Khi validation fail:

- Với Zod ở global handler, `responseErr` map thành invalid request.
- Một số controller trả 422 validation error trực tiếp; vẫn phải giữ format nhất quán qua `responseFormatMiddleware`.

## 5. Response Format

Tất cả route dưới `/v1` và `/v2` phải đi qua `responseFormatMiddleware`.

Success chuẩn:

```json
{
  "status": "success",
  "msg": "OK",
  "data": {}
}
```

Error chuẩn:

```json
{
  "status": "error",
  "msg": "Invalid request",
  "code": "BAD_REQUEST",
  "details": {}
}
```

Quy tắc:

- Controller nên trả `{ data }`, `{ data, meta }`, hoặc throw `AppError`.
- Không tự tạo envelope khác nếu không cần.
- List/cursor response phải có `meta` hoặc fields rõ ràng như `nextCursor`, `hasMore`.
- Không bypass middleware bằng cách mount API mới ngoài `/v1` hoặc `/v2` nếu đó là public API.

## 6. Error Handling

- Dùng `AppError.from(error, statusCode)` cho lỗi nghiệp vụ cần HTTP status cụ thể.
- Dùng error const trong `model/errors.ts` khi lỗi được dùng lại.
- Không throw string.
- Không leak stack trace/secret trong response production.
- Log chi tiết ở server side nếu cần, response chỉ nên chứa message/actionable details.

HTTP status nên dùng:

| Status | Khi dùng |
| --- | --- |
| 400 | Input hợp lệ về syntax nhưng sai nghiệp vụ |
| 401 | Thiếu/sai auth token |
| 403 | Authenticated nhưng không đủ quyền |
| 404 | Resource không tồn tại hoặc không visible |
| 409 | Conflict state |
| 410 | Resource/upload đã hết hạn |
| 422 | Validation schema fail |
| 429 | Rate limit |
| 500 | Unknown/server error |

## 7. Repository and DynamoDB Rules

Nguồn schema table là `src/share/repository/dynamodb/table-defs.ts`.

Quy tắc:

- Thêm table phải cập nhật `TABLE_NAMES`, table definition và `ALL_TABLES`.
- Thêm GSI phải mô tả access pattern trước khi implement.
- Không scan table lớn nếu có thể query bằng key/GSI.
- Composite key phải có prefix rõ ràng như `CONV#`, `MSG#`, `MEM#`.
- Date lưu ở DynamoDB nên dùng ISO string; entity trả về nên map lại `Date` nếu model yêu cầu.
- Table production không đổi primary key nếu không có migration/backfill.
- Soft delete/hard delete phải nhất quán với repository hiện có của domain.
- Không thêm MongoDB/TypeORM repository pattern vào project này.

Khi thêm field query mới:

1. Xác định query theo partition/sort key nào.
2. Nếu cần GSI, cập nhật `table-defs.ts`.
3. Cập nhật repository query method.
4. Cập nhật model/DTO nếu field public.
5. Cập nhật `docs/DATABASE.md`.

## 8. Auth and Security Rules

- Public route phải được chủ động quyết định; mặc định API nghiệp vụ cần auth.
- Protected route dùng `mdlFactory.auth`.
- Không lấy `userId` từ body để đại diện current user nếu route đã auth.
- Password phải hash bằng bcrypt, không log password hoặc token.
- JWT secret trong env production phải đủ mạnh và không dùng default dev value.
- Session/device route phải tôn trọng `x-device-id`.
- Logout/revoke phải cập nhật Redis session/blacklist phù hợp.
- CORS production nên cấu hình origin cụ thể nếu hạ tầng yêu cầu.

## 9. Socket.IO Rules

- Event name mới phải thêm vào constant nếu thuộc chat events.
- Socket payload phải validate tương tự HTTP DTO khi có input nghiệp vụ.
- Handler socket không chứa business logic dài; gọi usecase/service.
- Khi HTTP action có side effect realtime, phát event nhất quán với socket action tương đương.
- User-specific emit dùng user room.
- Conversation/group emit chỉ gửi tới member có quyền nhận.
- Không phát dữ liệu nhạy cảm qua broadcast rộng.
- Presence phải tôn trọng privacy `showOnline`, `showLastSeen` và relationship policy.

## 10. Swagger and API Documentation

Swagger source:

- `docs/swagger/main.yaml`
- `docs/swagger/components.yaml`
- `docs/swagger/paths/*.yaml`

Quy tắc:

- Thêm/sửa public REST API phải cập nhật Swagger trong cùng change.
- Nếu route mount trong `src/index.ts` khác path trong Swagger, phải sửa ngay.
- Request DTO, response shape và error status trong Swagger phải khớp controller/usecase.
- Nếu thêm socket event public, cập nhật socket reference docs liên quan.
- `docs/API_SPEC.md` là catalog; Swagger YAML là nguồn chi tiết endpoint đầy đủ.

## 11. Config and Secrets

- Tất cả config runtime đọc qua env và `src/share/component/config.ts`.
- Cập nhật `.env.example`, `.env.local.example`, `.env.production.example` khi thêm biến mới.
- Không commit `.env`, `.env.local`, `.env.production` chứa secret thật.
- Không hardcode credential trong source hoặc docs.
- Với DynamoDB thật, để `DYNAMODB_ENDPOINT` rỗng.
- Với Docker backend, Redis URL thường là `redis://redis:6379`.

Env mới phải có:

- Tên biến rõ domain.
- Default an toàn cho development nếu có thể.
- Ghi chú trong example file.
- Tài liệu cập nhật trong architecture docs nếu ảnh hưởng runtime.

## 12. Logging

- Dùng logger chung ở `src/share/utils/logger.ts` cho log ứng dụng.
- Không dùng log để in password, token, refresh token, API key, presigned URL dài hoặc credential.
- Log lỗi server side có đủ context để debug nhưng không leak vào response.
- Long-running startup task như DynamoDB init phải log success/failure rõ ràng.

## 13. Testing Rules

Test runner: Jest.

Các script chính:

```bash
npm run test
npm run test:chat
npm run test:chat:socket
```

Quy tắc:

- Business logic mới nên có unit/service test nếu usecase có rule đáng kể.
- HTTP/socket workflow mới nên có e2e hoặc harness test nếu ảnh hưởng frontend contract.
- Test helper dùng `tests/helpers`.
- Test flow docs nằm trong `docs/test-flows` khi cần mô tả hành vi.
- Không để test phụ thuộc secret production.
- Live e2e test phải tách rõ với test offline/in-memory.

## 14. Git and Change Hygiene

- Giữ change đúng scope.
- Không format/refactor toàn repo nếu task không yêu cầu.
- Không revert thay đổi người khác.
- Khi chỉ sửa docs, không thay đổi `package-lock.json`, source, generated Swagger hoặc env thật.
- Trước khi hoàn tất, chạy test phù hợp và kiểm tra `git diff`.

## 15. Anti-Patterns

Không làm các việc sau:

- Không thêm NestJS module/controller/provider vào project Express hiện tại.
- Không thêm TypeORM/Prisma/Mongoose/MongoDB schema cho dữ liệu runtime hiện tại.
- Không hardcode AWS, Redis, JWT, Gemini, LiveKit secret.
- Không thêm API public mà quên Swagger.
- Không thêm DynamoDB access pattern dựa trên full table scan cho luồng dùng thường xuyên.
- Không mount public route mới ngoài `/v1` hoặc `/v2` nếu muốn response envelope chuẩn.
- Không bypass `responseFormatMiddleware` bằng response custom không cần thiết.
- Không đưa business logic vào Socket.IO callback hoặc Express handler khi logic đó thuộc usecase.
- Không phát socket event cho user không phải member/không có quyền.
- Không đổi response field/event name đang dùng bởi frontend nếu chưa có compatibility plan.
- Không commit file upload, logs runtime, `.env` thật hoặc credential.

## 16. Checklist Khi Thêm Feature/API

1. Xác định route/event và version (`/v1` hay `/v2`).
2. Tạo/cập nhật DTO Zod.
3. Cập nhật usecase và permission checks.
4. Cập nhật repository/table/index nếu cần persistence mới.
5. Wire module trong `index.ts` của feature và `src/index.ts` nếu cần mount mới.
6. Cập nhật Swagger YAML.
7. Cập nhật docs liên quan: `API_SPEC.md`, `DATABASE.md`, socket docs hoặc handoff docs.
8. Thêm test phù hợp.
9. Chạy `npm run test` hoặc script hẹp hơn nếu task yêu cầu.
