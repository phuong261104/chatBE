# chatBE - Backend Chat Application

Backend chat application sử dụng Node.js, TypeScript, MongoDB, Redis và Socket.IO.

## Yêu Cầu Hệ Thống

- **Node.js**: v22.x trở lên
- **Docker** & **Docker Compose** (để chạy với container)
- **MongoDB**: v4.4+ (hoặc dùng container)
- **Redis**: v7+

## Cài Đặt

### 1. Clone repository

```bash
git clone <repo-url>
cd chatBE
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Tạo file cấu hình môi trường

Tạo file `.env` trong thư mục gốc với nội dung sau:

```env
PORT=3000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/chat_db

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
ACCESS_TOKEN_SECRET=your-secret-key-here
REFRESH_TOKEN_SECRET=your-refresh-secret-key-here

# Upload
UPLOAD_BASE_URL=http://localhost:3000/uploads
MAX_FILE_SIZE=10485760
```

## Cách Chạy

### Bước 1: Khởi động Database và Cache bằng Docker

```bash
docker-compose up -d
```

Lệnh này sẽ khởi động:
- **MongoDB** trên port `27018` (host) / `27017` (container)
- **Redis** trên port `6379`

### Bước 2: Chạy ứng dụng trên máy host

```bash
npm run start
```

Server sẽ chạy trên `http://localhost:3000`.

### Xem logs Docker (tùy chọn)

```bash
docker-compose logs -f
```

### Dừng services

```bash
docker-compose down
```

### Cách khác: Chạy hoàn toàn trong Docker (không khuyến nghị)

Nếu muốn chạy cả API trong container, uncomment phần `api` service trong `docker-compose.yml` và sử dụng:

```bash
docker-compose up -d --build
```

## API Documentation

Swagger UI available tại: `http://localhost:3000/api-docs`

## Các Module Chính

| Module | Mô tả |
|--------|--------|
| `user` | Quản lý người dùng, authentication |
| `chat` | Chat 1-1 và group chat |
| `media` | Upload và quản lý media files |
| `blocks` | Block người dùng |
| `friend-requests` | Gửi/nhận lời mời kết bạn |
| `friendships` | Quản lý bạn bè |
| `my-cloud` | Cloud storage cho user |
| `posts` | Bài đăng |
| `stories` | Stories |
| `search` | Tìm kiếm |

## Real-time Events

Socket.IO events được hỗ trợ cho:
- Chat messages
- Typing indicators
- Online/offline status
- Friend requests
- Message reactions

## Scripts

```bash
npm run start     # Chạy với nodemon (development)
npm run demo      # Chạy một lần với ts-node
npm test          # Chạy tests
```

## Cấu Trúc Project

```
chatBE/
├── src/
│   ├── modules/           # Business modules
│   │   ├── blocks/
│   │   ├── chat/
│   │   ├── friend-requests/
│   │   ├── friendships/
│   │   ├── media/
│   │   ├── my-cloud/
│   │   ├── posts/
│   │   ├── search/
│   │   ├── stories/
│   │   └── user/
│   ├── share/              # Shared components
│   │   ├── component/
│   │   ├── middleware/
│   │   ├── model/
│   │   ├── repository/
│   │   └── utils/
│   └── index.ts            # Entry point
├── docs/                   # API documentation
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Ports

| Service | Port |
|---------|------|
| API | 3000 |
| MongoDB (host) | 27018 |
| Redis | 6379 |
| Swagger UI | 3000/api-docs |
