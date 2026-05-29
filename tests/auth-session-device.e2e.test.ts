import "module-alias/register";

import axios, { AxiosInstance } from "axios";
import bcrypt from "bcrypt";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { io as createSocketClient, Socket as ClientSocket } from "socket.io-client";
import { v7 } from "uuid";

import { AuthHTTPService } from "@modules/auth/infras/transport";
import { RedisSessionStore } from "@modules/auth/infras/session/redis-session";
import { AuthUseCase } from "@modules/auth/usecase";
import { config } from "@share/component/config";
import { authenticateSocketConnection, createSocketIOServer, setSocketTokenIntrospector } from "@share/component/socket-io";
import { ITokenBlacklist, UserRole } from "@share/interface";

class FakeRedis {
  readonly values = new Map<string, string>();
  readonly sets = new Map<string, Set<string>>();

  async setEx(key: string, _ttl: number, value: string) {
    this.values.set(key, value);
  }

  async get(key: string) {
    return this.values.get(key) || null;
  }

  async del(key: string) {
    this.values.delete(key);
    this.sets.delete(key);
  }

  async sAdd(key: string, value: string) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    this.sets.get(key)!.add(value);
  }

  async sRem(key: string, value: string) {
    this.sets.get(key)?.delete(value);
  }

  async sMembers(key: string) {
    return Array.from(this.sets.get(key) || []);
  }

  async expire() {}

  async incr(key: string) {
    const next = Number(this.values.get(key) || "0") + 1;
    this.values.set(key, String(next));
    return next;
  }
}

class InMemoryTokenBlacklist implements ITokenBlacklist {
  readonly blocked = new Set<string>();

  async add(tokenJti: string): Promise<void> {
    this.blocked.add(tokenJti);
  }

  async isBlacklisted(tokenJti: string): Promise<boolean> {
    return this.blocked.has(tokenJti);
  }
}

class InMemoryAuthUserRepository {
  readonly users = new Map<string, any>();

  async get(id: string) {
    return this.users.get(id) || null;
  }

  async findByCond(cond: Record<string, any>) {
    return Array.from(this.users.values()).find((user) =>
      Object.entries(cond).every(([key, value]) => user[key] === value),
    ) || null;
  }

  async update(id: string, data: Record<string, any>) {
    const user = this.users.get(id);
    if (!user) return false;
    this.users.set(id, { ...user, ...data, updatedAt: new Date() });
    return true;
  }

  async insert(user: any) {
    this.users.set(user.id, user);
    return true;
  }

  addUser(phone = "0900000001", password = "Password123!") {
    const salt = bcrypt.genSaltSync(10);
    const user = {
      id: v7(),
      email: "session@chatbe.test",
      phone,
      password: bcrypt.hashSync(`${password}.${salt}`, 10),
      salt,
      status: "active",
      tokenVersion: 1,
      displayName: "Session User",
      avatarUrl: "https://cdn.test/avatar.png",
      verified: { email: true, phone: true },
      privacy: { searchableByEmail: true, searchableByPhone: true, searchableByUsername: true },
      settings: { notifications: { push: true, inApp: true } },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return { user, password };
  }

  addUserWithOverrides(phone = "0900000001", password = "Password123!", overrides: Record<string, any> = {}) {
    const seeded = this.addUser(phone, password);
    const user = { ...seeded.user, ...overrides };
    this.users.set(user.id, user);
    return { user, password };
  }
}

type Harness = {
  api: AxiosInstance;
  repo: InMemoryAuthUserRepository;
  close: () => Promise<void>;
  connectSocket: (token: string, deviceId: string) => Promise<ClientSocket>;
  connectNamespaceSocket: (namespace: string, token: string, deviceId: string) => Promise<ClientSocket>;
};

async function createHarness(): Promise<Harness> {
  const redis = new FakeRedis();
  const repo = new InMemoryAuthUserRepository();
  const sessionStore = new RedisSessionStore(redis as any);
  const blacklist = new InMemoryTokenBlacklist();
  const useCase = new AuthUseCase(repo as any, sessionStore, blacklist);
  useCase.setRedisClient(redis as any);
  const service = new AuthHTTPService(useCase);

  const app = express();
  const httpServer: HttpServer = createServer(app);
  const io = createSocketIOServer(httpServer);
  setSocketTokenIntrospector(useCase);

  io.of("/messages").use(authenticateSocketConnection);
  io.of("/messages").on("connection", (socket: any) => {
    socket.emit("connected", {
      socketId: socket.id,
      userId: socket.userId,
      deviceId: socket.deviceId,
    });
  });

  const auth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const result = await useCase.introspect(token);
    if (!result.isOk || !result.payload) return res.status(401).json({ error: "Unauthorized" });
    res.locals.requester = result.payload;
    return next();
  };

  app.use(express.json());
  app.use(cors({ credentials: true, origin: true }));
  app.post("/v1/auth/login", service.loginAPI.bind(service));
  app.post("/v1/auth/refresh", service.refreshAPI.bind(service));
  app.post("/v1/auth/logout", auth, service.logoutAPI.bind(service));
  app.post("/v1/auth/logout-all", auth, service.logoutAllAPI.bind(service));
  app.get("/v1/auth/sessions", auth, service.listSessionsAPI.bind(service));
  app.delete("/v1/auth/sessions/:deviceId", auth, service.revokeSessionAPI.bind(service));
  app.delete("/v1/auth/sessions", auth, service.revokeAllSessionsAPI.bind(service));

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const port = (httpServer.address() as AddressInfo).port;
  const baseURL = `http://127.0.0.1:${port}`;
  const clients: ClientSocket[] = [];

  return {
    api: axios.create({ baseURL, validateStatus: () => true, proxy: false, withCredentials: true }),
    repo,
    connectSocket: async (token: string, deviceId: string) => {
      const socket = createSocketClient(baseURL, {
        auth: { token, deviceId },
        transports: ["websocket"],
        forceNew: true,
      });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out connecting socket")), 1000);
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
    connectNamespaceSocket: async (namespace: string, token: string, deviceId: string) => {
      const socket = createSocketClient(`${baseURL}${namespace}`, {
        auth: { token, deviceId },
        transports: ["websocket"],
        forceNew: true,
      });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out connecting socket ${namespace}`)), 1000);
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
    close: async () => {
      for (const client of clients) client.disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      setSocketTokenIntrospector(null);
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
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 1000);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function cookieHeader(response: any) {
  const cookies = response.headers["set-cookie"] || [];
  return Array.isArray(cookies) ? cookies.map((cookie) => cookie.split(";")[0]).join("; ") : "";
}

describe("auth session and device E2E", () => {
  let harness: Harness;
  let credentials: { user: any; password: string };

  beforeEach(async () => {
    harness = await createHarness();
    credentials = harness.repo.addUser();
  });

  afterEach(async () => {
    await harness.close();
  });

  it("keeps one app and one web session, revokes replaced web sessions, and supports remote logout", async () => {
    const web1 = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("web-1", "web", "Chrome - Windows") },
    );
    const app1 = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("app-1", "app", "iPhone 15") },
    );
    expect(web1.status).toBe(200);
    expect(app1.status).toBe(200);

    const initialSessions = await harness.api.get("/v1/auth/sessions", {
      headers: authHeaders(web1.data.data.accessToken, "web-1"),
    });
    expect(initialSessions.status).toBe(200);
    expect(initialSessions.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ deviceId: "web-1", platform: "web", displayLabel: "Chrome - Windows", isCurrent: true }),
        expect.objectContaining({ deviceId: "app-1", platform: "app", displayLabel: "iPhone 15", location: "Ho Chi Minh City, VN" }),
      ]),
    );

    const oldWebSocket = await harness.connectSocket(web1.data.data.accessToken, "web-1");
    const revokedEvent = waitForEvent<any>(oldWebSocket, "session:revoked");
    const web2 = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("web-2", "web", "Edge - macOS") },
    );
    expect(web2.status).toBe(200);
    await expect(revokedEvent).resolves.toEqual(
      expect.objectContaining({ deviceId: "web-1", reason: "platform_session_replaced" }),
    );

    const rejectedOldRefresh = await harness.api.post("/v1/auth/refresh", {
      refreshToken: web1.data.data.refreshToken,
    });
    expect(rejectedOldRefresh.status).toBe(401);

    const appRefresh = await harness.api.post("/v1/auth/refresh", {
      refreshToken: app1.data.data.refreshToken,
    });
    expect(appRefresh.status).toBe(200);

    const afterReplacement = await harness.api.get("/v1/auth/sessions", {
      headers: authHeaders(web2.data.data.accessToken, "web-2"),
    });
    expect(afterReplacement.data.data.map((session: any) => session.deviceId).sort()).toEqual(["app-1", "web-2"]);

    const revokeApp = await harness.api.delete("/v1/auth/sessions/app-1", {
      headers: authHeaders(web2.data.data.accessToken, "web-2"),
    });
    expect(revokeApp.status).toBe(200);

    const rejectedAppRefresh = await harness.api.post("/v1/auth/refresh", {
      refreshToken: appRefresh.data.data.refreshToken,
    });
    expect(rejectedAppRefresh.status).toBe(401);

    const app2 = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("app-2", "app", "Android") },
    );
    expect(app2.status).toBe(200);

    const revokeOthers = await harness.api.delete("/v1/auth/sessions", {
      headers: authHeaders(web2.data.data.accessToken, "web-2"),
    });
    expect(revokeOthers.status).toBe(200);
    expect(revokeOthers.data.data).toEqual({ revoked: 1 });

    const onlyCurrent = await harness.api.get("/v1/auth/sessions", {
      headers: authHeaders(web2.data.data.accessToken, "web-2"),
    });
    expect(onlyCurrent.data.data).toEqual([
      expect.objectContaining({ deviceId: "web-2", isCurrent: true }),
    ]);

    const logoutAll = await harness.api.post(
      "/v1/auth/logout-all",
      {},
      { headers: authHeaders(web2.data.data.accessToken, "web-2") },
    );
    expect(logoutAll.status).toBe(200);

    const rejectedAfterLogoutAll = await harness.api.get("/v1/auth/sessions", {
      headers: authHeaders(web2.data.data.accessToken, "web-2"),
    });
    expect(rejectedAfterLogoutAll.status).toBe(401);
  });

  it("returns FE token metadata, supports cookie refresh, and revokes the device on refresh reuse", async () => {
    const login = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("cookie-web", "web", "Chrome - Windows") },
    );
    expect(login.status).toBe(200);
    expect(login.data.data).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenType: "Bearer",
        expiresIn: expect.any(Number),
        refreshExpiresIn: expect.any(Number),
        deviceId: "cookie-web",
        deviceType: "desktop-web",
        platform: "web",
      }),
    );

    const cookieRefresh = await harness.api.post(
      "/v1/auth/refresh",
      { refreshToken: login.data.data.refreshToken },
    );
    expect(cookieRefresh.status).toBe(200);
    expect(cookieRefresh.data.data.refreshToken).not.toBe(login.data.data.refreshToken);
    expect(cookieRefresh.data.data).toEqual(
      expect.objectContaining({
        deviceId: "cookie-web",
        tokenType: "Bearer",
        refreshExpiresIn: expect.any(Number),
      }),
    );

    const reusedOldRefresh = await harness.api.post("/v1/auth/refresh", {
      refreshToken: login.data.data.refreshToken,
    });
    expect(reusedOldRefresh.status).toBe(401);

    const revokedSessionRequest = await harness.api.get("/v1/auth/sessions", {
      headers: authHeaders(cookieRefresh.data.data.accessToken, "cookie-web"),
    });
    expect(revokedSessionRequest.status).toBe(401);

    const newRefreshAfterReuse = await harness.api.post("/v1/auth/refresh", {
      refreshToken: cookieRefresh.data.data.refreshToken,
    });
    expect(newRefreshAfterReuse.status).toBe(401);
  });

  it("logs out the current session using the token device when X-Device-Id is missing", async () => {
    const login = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("token-device", "web", "Chrome - Windows") },
    );
    expect(login.status).toBe(200);

    const logout = await harness.api.post(
      "/v1/auth/logout",
      {},
      { headers: { Authorization: `Bearer ${login.data.data.accessToken}` } },
    );
    expect(logout.status).toBe(200);

    const refreshAfterLogout = await harness.api.post("/v1/auth/refresh", {
      refreshToken: login.data.data.refreshToken,
    });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("rejects revoked access tokens on default and module socket namespaces", async () => {
    const web1 = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("socket-web-1", "web", "Chrome - Windows") },
    );
    expect(web1.status).toBe(200);

    const defaultSocket = await harness.connectSocket(web1.data.data.accessToken, "socket-web-1");
    const moduleSocket = await harness.connectNamespaceSocket("/messages", web1.data.data.accessToken, "socket-web-1");
    expect(defaultSocket.connected).toBe(true);
    expect(moduleSocket.connected).toBe(true);

    const revokedEvent = waitForEvent<any>(defaultSocket, "session:revoked");
    const web2 = await harness.api.post(
      "/v1/auth/login",
      { phone: credentials.user.phone, password: credentials.password },
      { headers: deviceHeaders("socket-web-2", "web", "Edge - macOS") },
    );
    expect(web2.status).toBe(200);
    await expect(revokedEvent).resolves.toEqual(
      expect.objectContaining({ deviceId: "socket-web-1", reason: "platform_session_replaced" }),
    );

    await expect(harness.connectSocket(web1.data.data.accessToken, "socket-web-1")).rejects.toThrow();
    await expect(harness.connectNamespaceSocket("/messages", web1.data.data.accessToken, "socket-web-1")).rejects.toThrow();
  });

  it("blocks login for unverified email when verification is required", async () => {
    const previous = config.auth.requireEmailVerification;
    config.auth.requireEmailVerification = true;
    try {
      const seeded = harness.repo.addUserWithOverrides("0900000099", "Password123!", {
        email: "unverified@chatbe.test",
        verified: { email: false, phone: true },
      });

      const login = await harness.api.post(
        "/v1/auth/login",
        { email: seeded.user.email, password: seeded.password },
        { headers: deviceHeaders("unverified-web", "web", "Chrome - Windows") },
      );
      expect(login.status).toBe(403);
    } finally {
      config.auth.requireEmailVerification = previous;
    }
  });
});
