# chatBE - Backend Chat Application

Backend chat application sử dụng Node.js, TypeScript, DynamoDB, Redis và Socket.IO.

## Yêu Cầu

- Node.js 22+
- Docker + Docker Compose
- AWS DynamoDB credentials trong env

> Local và production đều dùng AWS DynamoDB. Redis chạy cùng Docker stack với backend trên cùng server, không dùng Redis cloud.

## Chạy Trên Host

```bash
npm install
cp .env.example .env
npm run start
```

Server chạy ở `http://localhost:3000`.

## Docker Local

```bash
cp .env.local.example .env.local
# điền AWS DynamoDB, JWT, LiveKit secrets vào .env.local
npm run docker:local
```

Lệnh này build cùng Docker image dùng cho production và chạy `backend` + `redis` trong cùng Docker network.

Redis local được publish ra host qua `REDIS_HOST_PORT`, mặc định `6379`, để khi cần chạy backend bằng `npm start` trên host vẫn có thể dùng Redis container:

```bash
REDIS_URL=redis://localhost:6379
```

## Docker Production

```bash
cp .env.production.example .env.production
# điền production AWS/JWT/LiveKit secrets trên server
npm run docker:prod
```

Production nên đặt reverse proxy/TLS phía trước container và map `BACKEND_PORT` theo hạ tầng triển khai.

## Docker Commands

```bash
npm run docker:local   # docker compose local
npm run docker:prod    # docker compose production
npm run docker:logs    # xem logs backend
npm run docker:down    # dừng stack
```

## Env Chính

- `DYNAMODB_REGION`, `DYNAMODB_ENDPOINT`, `DYNAMODB_TABLE_PREFIX`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `APP_URL`, `FRONTEND_URL`
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`
- `LIVEKIT_CLOUD_API_KEY`, `LIVEKIT_CLOUD_API_SECRET`, `LIVEKIT_CLOUD_WS_URL`

Để dùng AWS DynamoDB thật, để `DYNAMODB_ENDPOINT=` rỗng.
Trong Docker local/prod, `REDIS_URL=redis://redis:6379` trỏ tới Redis service chạy cùng stack. Riêng local publish Redis ra host qua `REDIS_HOST_PORT` để hỗ trợ chạy backend bằng `npm start`; production không publish Redis port.

## API Documentation

Swagger UI: `http://localhost:3000/api-docs`

## Scripts

```bash
npm run start          # nodemon cho development trên host
npm run demo           # chạy một lần bằng ts-node
npm run test           # chạy tests
npm run dynamodb:init  # khởi tạo bảng DynamoDB trên endpoint trong env
```

## Ports

| Service | Port |
|---------|------|
| Backend API | `3000` trong container |
| Host mapping | `BACKEND_PORT`, mặc định `3000` |
| Redis local | `REDIS_HOST_PORT`, mặc định `6379` |
| Redis production | `6379` trong Docker network, không expose ra host |
