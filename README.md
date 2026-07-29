# chatBE - Backend Chat Application

Backend chat application sử dụng Node.js, TypeScript, DynamoDB-compatible
storage, Redis, Socket.IO, MinIO, LiveKit và Gemini.

## Yêu cầu

- Node.js 22+
- Docker Engine + Docker Compose
- VPS Linux tại nhà có Docker và outbound Internet
- Domain đang quản lý DNS trên Cloudflare
- Gemini và LiveKit credentials

Runtime local/production không cần AWS account hoặc AWS access key. DynamoDB
Local, Redis và MinIO chạy trong Docker Compose; AWS SDK chỉ được dùng như
protocol client cho DynamoDB và S3-compatible API.

## Docker local

```bash
cp .env.local.example .env.local
# thay JWT, MinIO, Gemini và LiveKit secrets
npm run docker:local
```

Local stack gồm backend, Redis, DynamoDB Local và MinIO. Các port chỉ bind vào
localhost:

- API: `http://localhost:3000`
- DynamoDB Local: `http://localhost:8000`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Docker production qua Cloudflare Tunnel

Stack production dùng remotely-managed Cloudflare Tunnel. VPS không cần public
IP, NAT port-forward, hoặc mở inbound port `80/443`.

Trong Cloudflare Zero Trust:

1. Vào `Networks > Tunnels`, tạo tunnel kiểu Cloudflared.
2. Copy token của tunnel vào `CLOUDFLARE_TUNNEL_TOKEN`.
3. Thêm hai Published application routes:
   - `api.example.com` -> service `http://backend:3000`
   - `storage.example.com` -> service `http://minio:9000`
4. Không bật Cloudflare Access cho storage hostname vì trình duyệt phải `PUT`
   trực tiếp bằng presigned URL.

`backend` và `minio` là Docker service name, chỉ resolve được vì container
`cloudflared` chạy cùng `chatbe-network`.

Triển khai trên VPS:

```bash
cp .env.production.example .env.production
# điền URL/domain, tunnel token, JWT, MinIO, Gemini, LiveKit và DEMO_PASSWORD
chmod 600 .env.production
npm run docker:prod
```

Production stack gồm cloudflared, backend, Redis, DynamoDB Local và MinIO.
Không service nào publish port ra host; TLS public kết thúc tại Cloudflare edge,
sau đó Tunnel chuyển tiếp HTTP trong Docker network.

Kiểm tra và seed:

```bash
curl https://api.example.com/health/ready
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml \
  exec backend npm run seed:demo
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml \
  logs cloudflared
```

Seed demo có tính idempotent và dùng password từ `DEMO_PASSWORD`.

## Docker commands

```bash
npm run docker:local
npm run docker:prod
npm run docker:logs
npm run docker:down
```

## Cấu hình chính

- DynamoDB Local: `DYNAMODB_ENDPOINT=http://dynamodb-local:8000`
- Redis: `REDIS_URL=redis://redis:6379`
- MinIO internal: `CLOUD_ENDPOINT=http://minio:9000`
- MinIO public: `CLOUD_PUBLIC_ENDPOINT=https://storage.example.com`
- MinIO media URL:
  `CLOUD_PUBLIC_BASE_URL=https://storage.example.com/chatbe-media`
- Cloudflare Tunnel: `CLOUDFLARE_TUNNEL_TOKEN`
- Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`
- LiveKit: `LIVEKIT_CLOUD_API_KEY`, `LIVEKIT_CLOUD_API_SECRET`,
  `LIVEKIT_CLOUD_WS_URL`

Không cấu hình `AWS_ACCESS_KEY_ID` hoặc `AWS_SECRET_ACCESS_KEY`.

Cloudflare Free/Pro giới hạn request upload ở 100 MB. Ảnh, audio và video demo
nên nhỏ hơn giới hạn này; upload video lớn cần chunk/multipart hoặc một đường
upload không đi qua Cloudflare proxy.

Cấu hình này giả định cuộc gọi dùng LiveKit Cloud. Nếu tự host LiveKit trên VPS
nhà, Cloudflare Tunnel chỉ giải quyết được signaling HTTP/WebSocket, không thay
thế các cổng ICE/TURN UDP/TCP mà WebRTC media yêu cầu.

## API documentation

- Local Swagger UI: `http://localhost:3000/api-docs`
- Production Swagger UI: `https://api.example.com/api-docs`

## Verification

```bash
npm run build
npx jest tests/media-minio-storage.test.ts \
  tests/media-confirm-upload.test.ts --runInBand
npm run test
```

DynamoDB Local là runtime phù hợp cho demo/portfolio một máy, không thay thế
managed database có high availability hoặc point-in-time recovery.
