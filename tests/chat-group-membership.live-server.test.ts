import { io, Socket } from "socket.io-client";
import { SocketEvent } from "@modules/chat/constants/socket-events";

const BASE_URL = process.env.LIVE_BACKEND_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.TEST_PASSWORD || "Test123456!";
const RUN_ID = process.env.TEST_RUN_ID || Date.now().toString().slice(-9);
const liveDescribe = process.env.RUN_LIVE_SERVER_CHAT_E2E === "true" ? describe : describe.skip;

type Platform = "web" | "app";
type HttpResponse<T = any> = { status: number; data: T; headers: Headers };
type Session = {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email: string;
  phone: string;
  password: string;
  deviceId: string;
  platform: Platform;
  displayLabel: string;
};

let userCounter = 0;

const dataOf = (response: HttpResponse) => (response.data as any)?.data;
const idsOf = (items: Array<{ id: string }> = []) => items.map((item) => item.id);

function nextPhone() {
  userCounter += 1;
  const numericRun = RUN_ID.replace(/\D/g, "") || Date.now().toString().slice(-8);
  const suffix = `${numericRun.slice(-8)}${String(userCounter).padStart(2, "0")}`;
  return `+84${suffix}`;
}

function deviceHeaders(
  deviceId: string,
  platform: Platform,
  displayLabel: string,
  token?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
    "X-Device-Type": platform === "app" ? "mobile-app" : "desktop-web",
    "X-Device-Platform": platform,
    "X-Display-Label": displayLabel,
    "X-Device-Location": "Live Group Membership E2E",
    "User-Agent": platform === "app" ? "ChatBE-E2E-App/1.0" : "ChatBE-E2E-Web/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function eventually(
  assertion: () => Promise<void> | void,
  timeoutMs = 12_000,
  intervalMs = 250,
) {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await sleep(intervalMs);
    }
  }

  throw lastError;
}

async function request<T = any>(
  method: string,
  path: string,
  body?: unknown,
  session?: Session,
  override?: Partial<Pick<Session, "deviceId" | "platform" | "displayLabel" | "accessToken">>,
): Promise<HttpResponse<T>> {
  const deviceId = override?.deviceId || session?.deviceId || `group-membership-live-${RUN_ID}-anon`;
  const platform = override?.platform || session?.platform || "web";
  const displayLabel = override?.displayLabel || session?.displayLabel || "Group Membership Live E2E";
  const token = override?.accessToken || session?.accessToken;

  let response: Response | null = null;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: deviceHeaders(deviceId, platform, displayLabel, token),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      break;
    } catch (error) {
      lastError = error;
      if (attempt === 6) throw error;
      await sleep(500 * attempt);
    }
  }
  if (!response) throw lastError || new Error("No response");

  const raw = await response.text();
  let data: any = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  return { status: response.status, data, headers: response.headers };
}

async function registerUser(label: string, platform: Platform = "web"): Promise<Session> {
  const email = `group-membership-live-${RUN_ID}-${label}@chatbe.io`;
  const phone = nextPhone();
  const deviceId = `group-membership-live-${RUN_ID}-${label}-${platform}`;
  const displayLabel = `${label} ${platform}`;
  const response = await request(
    "POST",
    "/v1/auth/register",
    {
      email,
      phone,
      password: PASSWORD,
      displayName: `Group Membership ${label}`,
      sendVerificationEmail: false,
    },
    undefined,
    { deviceId, platform, displayLabel },
  );

  expect([200, 201]).toContain(response.status);
  const data = dataOf(response);
  if (data?.accessToken) {
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      userId: data.user.id,
      email,
      phone,
      password: PASSWORD,
      deviceId,
      platform,
      displayLabel,
    };
  }

  const login = await request(
    "POST",
    "/v1/auth/login",
    { email, phone, password: PASSWORD },
    undefined,
    { deviceId, platform, displayLabel },
  );
  expect(login.status).toBe(200);
  const loginData = dataOf(login);
  expect(loginData?.accessToken).toBeTruthy();
  return {
    accessToken: loginData.accessToken,
    refreshToken: loginData.refreshToken,
    userId: loginData.user.id,
    email,
    phone,
    password: PASSWORD,
    deviceId,
    platform,
    displayLabel,
  };
}

async function makeFriends(sender: Session, receiver: Session) {
  const send = await request("POST", `/v1/friend-requests/${receiver.userId}`, {}, sender);
  expect(send.status).toBe(201);
  const requestId = dataOf(send)?.id;
  expect(requestId).toBeTruthy();

  const accept = await request("PATCH", `/v1/friend-requests/${requestId}`, { status: "accepted" }, receiver);
  expect(accept.status).toBe(200);
}

function connectMessagesSocket(session: Session): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${BASE_URL}/messages`, {
      auth: {
        token: session.accessToken,
        deviceId: session.deviceId,
        platform: session.platform,
      },
      transports: ["websocket"],
      reconnection: false,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Timed out connecting /messages socket"));
    }, 10_000);

    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(error);
    });
  });
}

function waitForMatchingEvent<T = any>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const onEvent = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    };
    socket.on(event, onEvent);
  });
}

async function expectConversationInList(session: Session, conversationId: string) {
  await eventually(async () => {
    const list = await request("GET", "/v1/conversations?page=1&limit=50", undefined, session);
    expect(list.status).toBe(200);
    expect(idsOf(dataOf(list))).toContain(conversationId);
  });
}

liveDescribe("Group membership live-server E2E against a running backend", () => {
  jest.setTimeout(120_000);

  let sockets: Socket[] = [];

  afterEach(() => {
    for (const socket of sockets) socket.disconnect();
    sockets = [];
  });

  it("emits user-room updates for direct invites, approval, and leave without requiring cached group rooms", async () => {
    const owner = await registerUser("owner");
    const member = await registerUser("member");
    const directInvitee = await registerUser("direct-invitee");
    const pendingInvitee = await registerUser("pending-invitee");
    const leavingMember = await registerUser("leaving-member");

    await makeFriends(owner, member);
    await makeFriends(owner, directInvitee);
    await makeFriends(owner, leavingMember);
    await makeFriends(member, pendingInvitee);

    const create = await request(
      "POST",
      "/v1/groups",
      { name: `Live Membership ${RUN_ID}`, memberIds: [member.userId] },
      owner,
    );
    expect(create.status).toBe(201);
    const conversationId = dataOf(create)?.conversation?.id;
    expect(conversationId).toBeTruthy();

    const requireApproval = await request(
      "PATCH",
      `/v1/groups/${conversationId}/settings`,
      { requireApproval: true },
      owner,
    );
    expect(requireApproval.status).toBe(200);
    expect(dataOf(requireApproval)?.settings?.requireApproval).toBe(true);

    const ownerSocket = await connectMessagesSocket(owner);
    const directInviteeSocket = await connectMessagesSocket(directInvitee);
    const pendingInviteeSocket = await connectMessagesSocket(pendingInvitee);
    const leavingMemberSocket = await connectMessagesSocket(leavingMember);
    sockets.push(ownerSocket, directInviteeSocket, pendingInviteeSocket, leavingMemberSocket);

    const directCreated = waitForMatchingEvent<any>(
      directInviteeSocket,
      SocketEvent.CONVERSATION_CREATED,
      (payload) => payload.conversation?.id === conversationId,
    );
    const directAdded = await request(
      "POST",
      `/v1/groups/${conversationId}/members`,
      { memberIds: [directInvitee.userId] },
      owner,
    );
    expect(directAdded.status).toBe(200);
    expect(dataOf(directAdded)[0]).toEqual(
      expect.objectContaining({
        userId: directInvitee.userId,
        status: "active",
      }),
    );
    await expect(directCreated).resolves.toEqual(
      expect.objectContaining({
        conversation: expect.objectContaining({ id: conversationId }),
        member: expect.objectContaining({ userId: directInvitee.userId, status: "active" }),
      }),
    );
    await expectConversationInList(directInvitee, conversationId);

    const pendingAdd = await request(
      "POST",
      `/v1/groups/${conversationId}/members`,
      { memberIds: [pendingInvitee.userId] },
      member,
    );
    expect(pendingAdd.status).toBe(200);
    expect(dataOf(pendingAdd)[0]).toEqual(
      expect.objectContaining({
        userId: pendingInvitee.userId,
        status: "pending",
      }),
    );

    const approvedCreated = waitForMatchingEvent<any>(
      pendingInviteeSocket,
      SocketEvent.CONVERSATION_CREATED,
      (payload) => payload.conversation?.id === conversationId,
    );
    const approvedEventForOwner = waitForMatchingEvent<any>(
      ownerSocket,
      SocketEvent.GROUP_MEMBER_APPROVED,
      (payload) => payload.conversationId === conversationId && payload.userId === pendingInvitee.userId,
    );
    const approve = await request(
      "PATCH",
      `/v1/groups/${conversationId}/members/${pendingInvitee.userId}/approve`,
      {},
      owner,
    );
    expect(approve.status).toBe(200);
    expect(dataOf(approve)).toEqual(
      expect.objectContaining({
        userId: pendingInvitee.userId,
        status: "active",
      }),
    );
    await expect(approvedCreated).resolves.toEqual(
      expect.objectContaining({
        conversation: expect.objectContaining({ id: conversationId }),
        member: expect.objectContaining({ userId: pendingInvitee.userId, status: "active" }),
      }),
    );
    await expect(approvedEventForOwner).resolves.toEqual(
      expect.objectContaining({
        conversationId,
        userId: pendingInvitee.userId,
        approvedBy: owner.userId,
      }),
    );
    await expectConversationInList(pendingInvitee, conversationId);

    const leavingCreated = waitForMatchingEvent<any>(
      leavingMemberSocket,
      SocketEvent.CONVERSATION_CREATED,
      (payload) => payload.conversation?.id === conversationId,
    );
    const leavingAdded = await request(
      "POST",
      `/v1/groups/${conversationId}/members`,
      { memberIds: [leavingMember.userId] },
      owner,
    );
    expect(leavingAdded.status).toBe(200);
    expect(dataOf(leavingAdded)[0]).toEqual(
      expect.objectContaining({
        userId: leavingMember.userId,
        status: "active",
      }),
    );
    await expect(leavingCreated).resolves.toEqual(
      expect.objectContaining({
        conversation: expect.objectContaining({ id: conversationId }),
      }),
    );

    const ownerSawLeave = waitForMatchingEvent<any>(
      ownerSocket,
      SocketEvent.GROUP_MEMBER_LEFT,
      (payload) => payload.conversationId === conversationId && payload.leftUserId === leavingMember.userId,
    );
    const ownerSawLeaveMessage = waitForMatchingEvent<any>(
      ownerSocket,
      SocketEvent.RECEIVE_MESSAGE,
      (payload) => payload.conversationId === conversationId && payload.message?.type === "system",
    );
    const leavingSawRemoval = waitForMatchingEvent<any>(
      leavingMemberSocket,
      SocketEvent.CONVERSATION_MEMBER_REMOVED,
      (payload) =>
        payload.conversationId === conversationId &&
        payload.removedUserId === leavingMember.userId &&
        payload.reason === "left",
    );
    const leave = await request("POST", `/v1/groups/${conversationId}/leave`, {}, leavingMember);
    expect(leave.status).toBe(200);
    await expect(ownerSawLeave).resolves.toEqual(
      expect.objectContaining({
        conversationId,
        leftUserId: leavingMember.userId,
        leftBy: leavingMember.userId,
      }),
    );
    await expect(ownerSawLeaveMessage).resolves.toEqual(
      expect.objectContaining({
        conversationId,
        message: expect.objectContaining({ type: "system" }),
      }),
    );
    await expect(leavingSawRemoval).resolves.toEqual(
      expect.objectContaining({
        conversationId,
        removedUserId: leavingMember.userId,
        removedBy: leavingMember.userId,
        reason: "left",
      }),
    );
  });
});
