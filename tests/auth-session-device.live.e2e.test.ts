import axios, { AxiosInstance } from "axios";
import bcrypt from "bcrypt";
import express, { NextFunction, Request, Response } from "express";
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { createClient } from "redis";
import { io as createSocketClient, Socket as ClientSocket } from "socket.io-client";
import { v7 } from "uuid";

import { AuthHTTPService } from "@modules/auth/infras/transport";
import { RedisSessionStore } from "@modules/auth/infras/session/redis-session";
import { TokenBlacklistService } from "@modules/auth/infras/token/blacklist";
import { AuthUseCase } from "@modules/auth/usecase";
import { DynamoUserRepository } from "@modules/user/infras/repository/dynamodb/dynamodb-repo";
import { UserStatus } from "@modules/user/model/model";
import { config } from "@share/component/config";
import { createSocketIOServer } from "@share/component/socket-io";
import { UserRole } from "@share/interface";
import { eventually } from "./helpers/chat-live-e2e-harness";

const liveDescribe =
  process.env.RUN_LIVE_INFRA_E2E === "true" || process.env.RUN_LIVE_AUTH_E2E === "true"
    ? describe
    : describe.skip;

type AuthLiveHarness = {
  api: AxiosInstance;
  userRepo: DynamoUserRepository;
  connectSocket: (token: string, deviceId: string) => Promise<ClientSocket>;
  seedUser: () => Promise<{ user: any; password: string }>;
  close: () => Promise<void>;
};

async function createRedisClient() {
  const redisUrl = config.redis.url || config.redis.host;
  const client = createClient({ url: redisUrl });
  await client.connect();
  return client;
}

async function createHarness(): Promise<AuthLiveHarness> {
  const redis = await createRedisClient();
  const userRepo = new DynamoUserRepository();
  const sessionStore = new RedisSessionStore(redis as any);
  const blacklist = new TokenBlacklistService(redis as any);
  const useCase = new AuthUseCase(userRepo as any, sessionStore, blacklist);
  useCase.setRedisClient(redis as any);
  const service = new AuthHTTPService(useCase);
  const trackedUserIds = new Set<string>();
  const clients: ClientSocket[] = [];

  const app = express();
  const httpServer: HttpServer = createServer(app);
  const io = createSocketIOServer(httpServer);

  const auth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const result = await useCase.introspect(token);
    if (!result.isOk || !result.payload) return res.status(401).json({ error: "Unauthorized" });
    res.locals.requester = { sub: result.payload.sub, role: UserRole.USER };
    return next();
  };

  app.use(express.json());
  app.post("/v1/auth/login", service.loginAPI.bind(service));
  app.post("/v1/auth/refresh", service.refreshAPI.bind(service));
  app.post("/v1/auth/logout-all", auth, service.logoutAllAPI.bind(service));
  app.get("/v1/auth/sessions", auth, service.listSessionsAPI.bind(service));
  app.delete("/v1/auth/sessions/:deviceId", auth, service.revokeSessionAPI.bind(service));
  app.delete("/v1/auth/sessions", auth, service.revokeAllSessionsAPI.bind(service));

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const port = (httpServer.address() as AddressInfo).port;
  const baseURL = `http://127.0.0.1:${port}`;

  return {
    api: axios.create({ baseURL, validateStatus: () => true, proxy: false }),
    userRepo,
    connectSocket: async (token: string, deviceId: string) => {
      const socket = createSocketClient(baseURL, {
        auth: { token, deviceId },
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
      });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out connecting auth live socket")), 8_000);
        socket.once("connect", () => {
          clearTimeout(timer);
          resolve();
        });
        socket.once("connect_error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      return socket;
    },
    seedUser: async () => {
      const suffix = v7().replace(/-/g, "").slice(-16);
      const password = "Password123!";
      const salt = bcrypt.genSaltSync(10);
      const user = {
        id: v7(),
        email: `live-auth-${suffix}@chatbe.test`,
        phone: `849${suffix.replace(/\D/g, "").padEnd(9, "0").slice(0, 9)}`,
        username: `live_auth_${suffix}`,
        password: bcrypt.hashSync(`${password}.${salt}`, 10),
        salt,
        status: UserStatus.ACTIVE,
        tokenVersion: 1,
        displayName: "Live Auth User",
        avatarUrl: "https://cdn.test/live-auth.png",
        verified: { email: true, phone: true },
        privacy: { searchableByEmail: true, searchableByPhone: true, searchableByUsername: true },
        settings: { notifications: { push: false, inApp: false } },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await userRepo.insert(user as any);
      trackedUserIds.add(user.id);
      await eventually(async () => {
        expect(await userRepo.findByCond({ phone: user.phone } as any)).toEqual(
          expect.objectContaining({ id: user.id }),
        );
      });
      return { user, password };
    },
    close: async () => {
      for (const client of clients) client.disconnect();
      for (const userId of trackedUserIds) {
        await useCase.revokeAllSessions(userId).catch(() => undefined);
        await userRepo.delete(userId, true).catch(() => undefined);
      }
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      await redis.quit().catch(() => undefined);
    },
  };
}

function deviceHeaders(deviceId: string, platform: "app" | "web", label: string) {
  return {
    "X-Device-Id": deviceId,
    "X-Device-Type": platform === "app" ? "mobile-app" : "desktop-web",
    "X-Device-Platform": platform,
    "X-Display-Label": label,
    "X-Device-Location": platform === "app" ? "Ho Chi Minh City, VN" : "Da Nang, VN",
    "User-Agent": platform === "app" ? "ChatBE App/1.0 iPhone" : "Chrome Windows",
  };
}

function authHeaders(accessToken: string, deviceId: string) {
  return { Authorization: `Bearer ${accessToken}`, "X-Device-Id": deviceId };
}

function waitForEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 8_000);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

liveDescribe("auth session and device live E2E with real DynamoDB and Redis", () => {
  let harness: AuthLiveHarness;

  jest.setTimeout(80_000);

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("keeps one app plus one web session and revokes replaced/remote sessions in Redis", async () => {
    const credentials = await harness.seedUser();
    const web1 = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("live-web-1", "web", "Chrome - Windows") },
    );
    const app1 = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("live-app-1", "app", "iPhone 15") },
    );
    expect(web1.status).toBe(200);
    expect(app1.status).toBe(200);

    const sessions = await harness.api.get("/v1/auth/sessions", {
      headers: authHeaders(web1.data.data.accessToken, "live-web-1"),
    });
    expect(sessions.status).toBe(200);
    expect(sessions.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ deviceId: "live-web-1", platform: "web", isCurrent: true }),
        expect.objectContaining({ deviceId: "live-app-1", platform: "app", location: "Ho Chi Minh City, VN" }),
      ]),
    );

    const oldWebSocket = await harness.connectSocket(web1.data.data.accessToken, "live-web-1");
    const revokedEvent = waitForEvent<any>(oldWebSocket, "session:revoked");
    const web2 = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("live-web-2", "web", "Edge - macOS") },
    );
    expect(web2.status).toBe(200);
    await expect(revokedEvent).resolves.toEqual(
      expect.objectContaining({ deviceId: "live-web-1", reason: "platform_session_replaced" }),
    );

    const oldRefresh = await harness.api.post("/v1/auth/refresh", { refreshToken: web1.data.data.refreshToken });
    expect(oldRefresh.status).toBe(401);

    const appRefresh = await harness.api.post("/v1/auth/refresh", { refreshToken: app1.data.data.refreshToken });
    expect(appRefresh.status).toBe(200);

    const revokeApp = await harness.api.delete("/v1/auth/sessions/live-app-1", {
      headers: authHeaders(web2.data.data.accessToken, "live-web-2"),
    });
    expect(revokeApp.status).toBe(200);

    const revokedAppRefresh = await harness.api.post("/v1/auth/refresh", {
      refreshToken: appRefresh.data.data.refreshToken,
    });
    expect(revokedAppRefresh.status).toBe(401);

    const app2 = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("live-app-2", "app", "Android") },
    );
    expect(app2.status).toBe(200);

    const revokeOthers = await harness.api.delete("/v1/auth/sessions", {
      headers: authHeaders(web2.data.data.accessToken, "live-web-2"),
    });
    expect(revokeOthers.status).toBe(200);
    expect(revokeOthers.data.data).toEqual({ revoked: 1 });

    const onlyCurrent = await harness.api.get("/v1/auth/sessions", {
      headers: authHeaders(web2.data.data.accessToken, "live-web-2"),
    });
    expect(onlyCurrent.status).toBe(200);
    expect(onlyCurrent.data.data).toEqual([
      expect.objectContaining({ deviceId: "live-web-2", isCurrent: true }),
    ]);

    const logoutAll = await harness.api.post(
      "/v1/auth/logout-all",
      {},
      { headers: authHeaders(web2.data.data.accessToken, "live-web-2") },
    );
    expect(logoutAll.status).toBe(200);

    const rejectedAfterLogoutAll = await harness.api.get("/v1/auth/sessions", {
      headers: authHeaders(web2.data.data.accessToken, "live-web-2"),
    });
    expect(rejectedAfterLogoutAll.status).toBe(401);
  });
});
