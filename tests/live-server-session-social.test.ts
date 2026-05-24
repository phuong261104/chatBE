/**
 * Live server API + Socket.IO tests for session/device, social, privacy and profile-card flows.
 *
 * Run with:
 *   npx ts-node tests/live-server-session-social.test.ts
 *
 * Requires a server already running at BASE_URL (default: http://localhost:3000).
 */

import { io, Socket } from "socket.io-client";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.TEST_PASSWORD || "Test123456!";
const RUN_ID = process.env.TEST_RUN_ID || Date.now().toString().slice(-9);

type Platform = "web" | "app";
type TestResult = { name: string; passed: boolean; error?: string };
type HttpResponse<T = any> = { status: number; data: T; headers: Headers };

type UserSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  phone: string;
  password: string;
  deviceId: string;
  platform: Platform;
  displayLabel: string;
};

const results: TestResult[] = [];
let userCounter = 0;

function pass(name: string, extra?: string) {
  results.push({ name, passed: true });
  console.log(`  PASS  ${name}${extra ? ` ${extra}` : ""}`);
}

function fail(name: string, error: string) {
  results.push({ name, passed: false, error });
  console.log(`  FAIL  ${name}: ${error}`);
}

function summary() {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log("\n" + "=".repeat(70));
  console.log(`  TOTAL:  ${total}`);
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log("=".repeat(70));
  if (failed > 0) {
    console.log("\nFailed tests:");
    for (const item of results.filter((r) => !r.passed)) {
      console.log(`  - ${item.name}: ${item.error}`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

function abort(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (!results.some((item) => !item.passed)) {
    fail("Test runner", message);
  }
  summary();
  throw error;
}

function expect(name: string, condition: unknown, error: string) {
  if (!condition) {
    fail(name, error);
    throw new Error(error);
  }
  pass(name);
}

function expectStatus(name: string, response: HttpResponse, expected: number | number[]) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  expect(
    name,
    allowed.includes(response.status),
    `Expected ${allowed.join("/")} but got ${response.status}: ${JSON.stringify(response.data)}`,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextPhone() {
  userCounter += 1;
  const suffix = `${RUN_ID.slice(-8)}${String(userCounter).padStart(2, "0")}`;
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
    "X-Device-Location": "Live E2E Lab",
    "User-Agent": platform === "app" ? "ChatBE-E2E-App/1.0" : "ChatBE-E2E-Web/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request<T = any>(
  method: string,
  path: string,
  body?: unknown,
  session?: UserSession,
  override?: Partial<Pick<UserSession, "deviceId" | "platform" | "displayLabel" | "accessToken">>,
): Promise<HttpResponse<T>> {
  const deviceId = override?.deviceId || session?.deviceId || `live-e2e-${RUN_ID}-anon`;
  const platform = override?.platform || session?.platform || "web";
  const displayLabel = override?.displayLabel || session?.displayLabel || "Live E2E Client";
  const token = override?.accessToken || session?.accessToken;
  const init = {
    method,
    headers: deviceHeaders(deviceId, platform, displayLabel, token),
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  let response: Response | null = null;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      response = await fetch(`${BASE_URL}${path}`, init);
      break;
    } catch (err) {
      lastError = err;
      if (attempt === 6) throw err;
      await sleep(500 * attempt);
    }
  }
  if (!response) throw lastError || new Error("No response");

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: response.status, data, headers: response.headers };
}

async function login(
  email: string,
  phone: string,
  password: string,
  deviceId: string,
  platform: Platform,
  displayLabel: string,
): Promise<UserSession> {
  const response = await request(
    "POST",
    "/v1/auth/login",
    { email, phone, password },
    undefined,
    { deviceId, platform, displayLabel },
  );
  expectStatus(`Login ${email} on ${platform}`, response, 200);
  const data = (response.data as any).data;
  expect(`Login ${email} returns access token`, data?.accessToken, "No access token");
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user.id,
    email,
    phone,
    password,
    deviceId,
    platform,
    displayLabel,
  };
}

async function createUser(label: string, platform: Platform = "web"): Promise<UserSession> {
  const email = `live-${RUN_ID}-${label}@chatbe.io`;
  const phone = nextPhone();
  const deviceId = `live-${RUN_ID}-${label}-${platform}-1`;
  const displayLabel = `${label} ${platform}`;
  const response = await request(
    "POST",
    "/v1/auth/register",
    {
      email,
      phone,
      password: PASSWORD,
      displayName: `Live ${label}`,
      sendVerificationEmail: false,
    },
    undefined,
    { deviceId, platform, displayLabel },
  );

  expectStatus(`Register ${label}`, response, [200, 201]);
  const data = (response.data as any).data;
  if (data?.accessToken) {
    pass(`Register ${label} returns session`);
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
  return login(email, phone, PASSWORD, deviceId, platform, displayLabel);
}

async function introspect(token: string) {
  return request("POST", "/v1/auth/introspect", { token });
}

async function refresh(refreshToken: string) {
  return request("POST", "/v1/auth/refresh", { refreshToken });
}

function waitForMatchingEvent<T = any>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 8000,
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

function waitForEvent<T = any>(socket: Socket, event: string, timeoutMs = 8000): Promise<T> {
  return waitForMatchingEvent(socket, event, () => true, timeoutMs);
}

function waitForNoMatchingEvent<T = any>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean,
  timeoutMs = 800,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, timeoutMs);
    const onEvent = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      reject(new Error(`Unexpected ${event}: ${JSON.stringify(payload)}`));
    };
    socket.on(event, onEvent);
  });
}

function emitAck<T = any>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs = 8000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event} ack`)), timeoutMs);
    socket.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function connectSocket(session: UserSession, namespace = ""): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${BASE_URL}${namespace}`, {
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
      reject(new Error(`Timed out connecting socket ${namespace || "/"}`));
    }, 10000);

    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (err: Error) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(err);
    });
  });
}

async function makeFriends(sender: UserSession, receiver: UserSession) {
  const send = await request("POST", `/v1/friend-requests/${receiver.userId}`, {}, sender);
  expectStatus(`Send friend request ${sender.email} -> ${receiver.email}`, send, 201);
  const requestId = (send.data as any).data?.id;
  expect("Friend request has id", requestId, JSON.stringify(send.data));

  const accept = await request("PATCH", `/v1/friend-requests/${requestId}`, { status: "accepted" }, receiver);
  expectStatus(`Accept friend request ${requestId}`, accept, 200);
}

async function runFriendSuggestionTests() {
  console.log("\n-- Friend Suggestions --");
  const suggestAlice = await createUser("suggest-alice", "web");
  const mutualFriend = await createUser("suggest-mutual-friend", "web");
  const mutualCandidate = await createUser("suggest-mutual-candidate", "web");
  const groupOwner = await createUser("suggest-group-owner", "web");
  const sharedCandidate = await createUser("suggest-shared-candidate", "web");

  await makeFriends(suggestAlice, mutualFriend);
  await makeFriends(mutualFriend, mutualCandidate);
  await makeFriends(groupOwner, suggestAlice);
  await makeFriends(groupOwner, sharedCandidate);

  for (const index of [1, 2]) {
    const group = await request(
      "POST",
      "/v1/groups",
      {
        name: `Live suggestion group ${RUN_ID}-${index}`,
        memberIds: [suggestAlice.userId, sharedCandidate.userId],
      },
      groupOwner,
    );
    expectStatus(`Create shared suggestion group ${index}`, group, 201);
  }

  const suggestions = await request("GET", "/v1/friends/suggestions?limit=20", undefined, suggestAlice);
  expectStatus("Friend suggestions endpoint", suggestions, 200);
  const items = ((suggestions.data as any).data || []) as any[];
  expect(
    "Friend suggestions include mutual-friend candidate",
    items.some(
      (item) =>
        item.id === mutualCandidate.userId &&
        item.mutualFriendsCount >= 1 &&
        item.reasons?.includes("mutual_friends"),
    ),
    JSON.stringify(items),
  );
  expect(
    "Friend suggestions include shared-groups candidate",
    items.some(
      (item) =>
        item.id === sharedCandidate.userId &&
        item.sharedGroupsCount >= 2 &&
        item.reasons?.includes("shared_groups"),
    ),
    JSON.stringify(items),
  );
}

async function runSessionDeviceTests() {
  console.log("\n=== SESSION / DEVICE LIVE SERVER TESTS ===");
  const owner = await createUser("session-owner", "web");

  const web1Socket = await connectSocket(owner);
  pass("Root socket connected for first web device");
  const web1Revoked = waitForEvent<any>(web1Socket, "session:revoked");

  const app1 = await login(
    owner.email,
    owner.phone,
    owner.password,
    `live-${RUN_ID}-session-app-1`,
    "app",
    "Session App 1",
  );

  const initialSessions = await request("GET", "/v1/auth/sessions", undefined, app1);
  expectStatus("List sessions after web + app login", initialSessions, 200);
  const sessionItems = (initialSessions.data as any).data || [];
  expect("Web + app sessions can coexist", sessionItems.length === 2, JSON.stringify(sessionItems));
  expect(
    "Session metadata includes current device and location",
    sessionItems.some((item: any) => item.deviceId === app1.deviceId && item.isCurrent && item.platform === "app" && item.location),
    JSON.stringify(sessionItems),
  );
  expect(
    "Session list returns complete device metadata",
    sessionItems.every(
      (item: any) =>
        item.deviceId &&
        item.displayLabel &&
        item.platform &&
        item.ip &&
        item.location &&
        item.lastActive &&
        typeof item.isCurrent === "boolean",
    ),
    JSON.stringify(sessionItems),
  );

  const web2 = await login(
    owner.email,
    owner.phone,
    owner.password,
    `live-${RUN_ID}-session-web-2`,
    "web",
    "Session Web 2",
  );
  const revokedWebPayload = await web1Revoked;
  expect(
    "Second web login emits session:revoked to old web socket",
    revokedWebPayload?.deviceId === owner.deviceId,
    JSON.stringify(revokedWebPayload),
  );
  await sleep(100);
  expect("Old web socket is disconnected after replacement", !web1Socket.connected, "Old web socket stayed connected");
  const web1Refresh = await refresh(owner.refreshToken);
  expectStatus("Replaced web refresh token is revoked", web1Refresh, 401);

  const afterReplacement = await request("GET", "/v1/auth/sessions", undefined, web2);
  expectStatus("List sessions after replacing web device", afterReplacement, 200);
  const replacementItems = (afterReplacement.data as any).data || [];
  expect(
    "Second web login revokes only old web session",
    replacementItems.length === 2 &&
      replacementItems.some((item: any) => item.deviceId === web2.deviceId && item.platform === "web") &&
      replacementItems.some((item: any) => item.deviceId === app1.deviceId && item.platform === "app") &&
      !replacementItems.some((item: any) => item.deviceId === owner.deviceId),
    JSON.stringify(replacementItems),
  );

  const appSocket = await connectSocket(app1);
  pass("Root socket connected for app device");
  const appRevoked = waitForEvent<any>(appSocket, "session:revoked");
  const revokeApp = await request("DELETE", `/v1/auth/sessions/${app1.deviceId}`, undefined, web2);
  expectStatus("Revoke specific app device from web", revokeApp, 200);
  const revokedAppPayload = await appRevoked;
  expect(
    "Specific revoke emits session:revoked to app socket",
    revokedAppPayload?.deviceId === app1.deviceId,
    JSON.stringify(revokedAppPayload),
  );
  await sleep(100);
  expect("Revoked app socket is disconnected", !appSocket.connected, "Revoked app socket stayed connected");
  const appTokenState = await introspect(app1.accessToken);
  expect(
    "Revoked app access token is blacklisted",
    appTokenState.status === 200 && (appTokenState.data as any).data?.active === false,
    JSON.stringify(appTokenState.data),
  );
  const appRefreshState = await refresh(app1.refreshToken);
  expectStatus("Revoked app refresh token is deleted", appRefreshState, 401);

  const app2 = await login(
    owner.email,
    owner.phone,
    owner.password,
    `live-${RUN_ID}-session-app-2`,
    "app",
    "Session App 2",
  );
  const revokeOthers = await request("DELETE", "/v1/auth/sessions", undefined, web2);
  expectStatus("Logout all other devices keeps current device", revokeOthers, 200);
  expect(
    "Logout all other devices revokes at least app session",
    ((revokeOthers.data as any).data?.revoked || 0) >= 1,
    JSON.stringify(revokeOthers.data),
  );
  const onlyCurrent = await request("GET", "/v1/auth/sessions", undefined, web2);
  expectStatus("List sessions after logout other devices", onlyCurrent, 200);
  const currentItems = (onlyCurrent.data as any).data || [];
  expect(
    "Only current web device remains after logout other devices",
    currentItems.length === 1 && currentItems[0].deviceId === web2.deviceId && currentItems[0].isCurrent,
    JSON.stringify(currentItems),
  );
  const app2State = await introspect(app2.accessToken);
  expect(
    "Other app access token is blacklisted after logout other devices",
    app2State.status === 200 && (app2State.data as any).data?.active === false,
    JSON.stringify(app2State.data),
  );
  const app2RefreshState = await refresh(app2.refreshToken);
  expectStatus("Other app refresh token is deleted after logout other devices", app2RefreshState, 401);

  const logoutAll = await request("POST", "/v1/auth/logout-all", undefined, web2);
  expectStatus("Logout all devices", logoutAll, 200);
  const web2State = await introspect(web2.accessToken);
  expect(
    "Logout all blacklists current web token",
    web2State.status === 200 && (web2State.data as any).data?.active === false,
    JSON.stringify(web2State.data),
  );

  web1Socket.disconnect();
  appSocket.disconnect();
}

async function runSocialPrivacyTests() {
  console.log("\n=== SOCIAL / PRIVACY / PROFILE LIVE SERVER TESTS ===");
  const alice = await createUser("alice", "web");
  const bob = await createUser("bob", "web");
  const carol = await createUser("carol", "web");
  const dave = await createUser("dave", "web");

  const aliceFriendsSocket = await connectSocket(alice, "/friends");
  const bobFriendsSocket = await connectSocket(bob, "/friends");
  const bobReceived = waitForEvent<any>(bobFriendsSocket, "friend_request:received");
  const sendToBob = await request("POST", `/v1/friend-requests/${bob.userId}`, {}, alice);
  expectStatus("Friend request pending status", sendToBob, 201);
  expect("Friend request status is pending", (sendToBob.data as any).data?.status === "pending", JSON.stringify(sendToBob.data));
  const bobReceivedPayload = await bobReceived;
  expect(
    "Friend request received socket notification",
    bobReceivedPayload?.data?.fromUserId === alice.userId,
    JSON.stringify(bobReceivedPayload),
  );

  const aliceAccepted = waitForEvent<any>(aliceFriendsSocket, "friend_request:accepted");
  const acceptBob = await request(
    "PATCH",
    `/v1/friend-requests/${(sendToBob.data as any).data.id}`,
    { status: "accepted" },
    bob,
  );
  expectStatus("Friend request accepted status", acceptBob, 200);
  expect("Friend request status is accepted", (acceptBob.data as any).data?.status === "accepted", JSON.stringify(acceptBob.data));
  const acceptedPayload = await aliceAccepted;
  expect(
    "Friend request accepted socket notification",
    acceptedPayload?.data?.acceptedBy === bob.userId,
    JSON.stringify(acceptedPayload),
  );

  const aliceRejected = waitForEvent<any>(aliceFriendsSocket, "friend_request:rejected");
  const sendToCarol = await request("POST", `/v1/friend-requests/${carol.userId}`, {}, alice);
  expectStatus("Send rejectable friend request", sendToCarol, 201);
  const rejectCarol = await request(
    "PATCH",
    `/v1/friend-requests/${(sendToCarol.data as any).data.id}`,
    { status: "rejected" },
    carol,
  );
  expectStatus("Friend request rejected status", rejectCarol, 200);
  expect("Friend request status is rejected", (rejectCarol.data as any).data?.status === "rejected", JSON.stringify(rejectCarol.data));
  const rejectedPayload = await aliceRejected;
  expect(
    "Friend request rejected socket notification",
    rejectedPayload?.data?.rejectedBy === carol.userId,
    JSON.stringify(rejectedPayload),
  );

  const daveFriendsSocket = await connectSocket(dave, "/friends");
  const daveCanceled = waitForEvent<any>(daveFriendsSocket, "friend_request:canceled");
  const sendToDave = await request("POST", `/v1/friend-requests/${dave.userId}`, {}, alice);
  expectStatus("Send cancelable friend request", sendToDave, 201);
  const cancelDave = await request("DELETE", `/v1/friend-requests/${(sendToDave.data as any).data.id}`, undefined, alice);
  expectStatus("Friend request canceled status", cancelDave, 204);
  const canceledPayload = await daveCanceled;
  expect(
    "Friend request canceled socket notification",
    canceledPayload?.data?.canceledBy === alice.userId,
    JSON.stringify(canceledPayload),
  );

  await runFriendSuggestionTests();

  const firstMessage = await request("POST", "/v1/messages/private", { targetUserId: bob.userId, text: "before block" }, alice);
  expectStatus("Friend private message before block succeeds", firstMessage, 201);
  const conversationId = (firstMessage.data as any).data?.conversation?.id;
  expect("Private message creates conversation", conversationId, JSON.stringify(firstMessage.data));

  const blockBob = await request("POST", `/v1/blocks/${bob.userId}`, {}, alice);
  expectStatus("Block user", blockBob, [200, 201]);

  const blockedMessage = await request(
    "POST",
    `/v1/conversations/${conversationId}/messages`,
    { text: "blocked message" },
    bob,
  );
  expectStatus("Block prevents sending private message", blockedMessage, 403);

  const blockedCall = await request("POST", "/v1/calls", { conversationId, type: "audio" }, bob);
  expectStatus("Block prevents calls", blockedCall, 403);

  const blockedProfile = await request("GET", `/v1/users/${alice.userId}/public`, undefined, bob);
  expectStatus("Block prevents viewing public profile", blockedProfile, 403);

  const oldHistory = await request("GET", `/v1/conversations/${conversationId}/messages`, undefined, alice);
  expectStatus("Blocker can still load old message history", oldHistory, 200);

  const bobRootSocket = await connectSocket(bob);
  const blockedPresence = await emitAck<any>(bobRootSocket, "getOnlineStatus", { userId: alice.userId });
  expect(
    "Block hides presence over root socket",
    blockedPresence?.visibility === "hidden" && blockedPresence?.isOnline === false,
    JSON.stringify(blockedPresence),
  );
  const blockedBatchPresence = await emitAck<any>(bobRootSocket, "getBatchOnlineStatus", { userIds: [alice.userId] });
  expect(
    "Block hides batch presence over root socket",
    blockedBatchPresence?.statuses?.[0]?.visibility === "hidden" &&
      blockedBatchPresence.statuses[0].isOnline === false,
    JSON.stringify(blockedBatchPresence),
  );

  const watcher = await createUser("presence-watcher", "web");
  const hiddenWatcher = await createUser("presence-hidden-watcher", "web");
  const presenceTarget = await createUser("presence-target", "web");
  const hideWatcherPrivacy = await request(
    "PATCH",
    "/v1/users/me/privacy",
    { showOnline: false, showLastSeen: false },
    hiddenWatcher,
  );
  expectStatus("Hidden watcher disables own presence visibility", hideWatcherPrivacy, 200);
  const watcherSocket = await connectSocket(watcher);
  const hiddenWatcherSocket = await connectSocket(hiddenWatcher);
  const visibleOnline = waitForMatchingEvent<any>(
    watcherSocket,
    "user:online",
    (payload) => payload?.userId === presenceTarget.userId && payload?.visibility === "visible",
  );
  const hiddenNoOnline = waitForNoMatchingEvent<any>(
    hiddenWatcherSocket,
    "user:online",
    (payload) => payload?.userId === presenceTarget.userId,
  );
  const targetPresenceSocket = await connectSocket(presenceTarget);
  await visibleOnline;
  pass("Visible watcher receives user:online event");
  await hiddenNoOnline;
  pass("Hidden watcher does not receive user:online event");

  const visibleOffline = waitForMatchingEvent<any>(
    watcherSocket,
    "user:offline",
    (payload) => payload?.userId === presenceTarget.userId && payload?.visibility === "visible",
  );
  const hiddenNoOffline = waitForNoMatchingEvent<any>(
    hiddenWatcherSocket,
    "user:offline",
    (payload) => payload?.userId === presenceTarget.userId,
  );
  targetPresenceSocket.disconnect();
  await visibleOffline;
  pass("Visible watcher receives user:offline event");
  await hiddenNoOffline;
  pass("Hidden watcher does not receive user:offline event");

  const receiver = await createUser("stranger-receiver", "web");
  const stranger = await createUser("stranger-sender", "web");
  const requestSender = await createUser("stranger-requester", "web");
  const receiverPrivacyBlocked = await request(
    "PATCH",
    "/v1/users/me/privacy",
    { blockMessagesFromStrangers: true },
    receiver,
  );
  expectStatus("Receiver enables stranger-message block", receiverPrivacyBlocked, 200);
  const blockedStrangerMessage = await request(
    "POST",
    "/v1/messages/private",
    { targetUserId: receiver.userId, text: "stranger blocked" },
    stranger,
  );
  expectStatus("Stranger message is blocked by receiver setting", blockedStrangerMessage, 403);

  const receiverPrivacyOpen = await request(
    "PATCH",
    "/v1/users/me/privacy",
    { blockMessagesFromStrangers: false },
    receiver,
  );
  expectStatus("Receiver allows stranger message requests", receiverPrivacyOpen, 200);
  const requestMessage = await request(
    "POST",
    "/v1/messages/private",
    { targetUserId: receiver.userId, text: "message request" },
    requestSender,
  );
  expectStatus("Stranger message creates message request", requestMessage, 201);
  expect(
    "Stranger private message status is pending",
    (requestMessage.data as any).data?.messageRequestStatus === "pending",
    JSON.stringify(requestMessage.data),
  );
  const strangerConversations = await request("GET", "/v1/conversations/strangers", undefined, receiver);
  expectStatus("List stranger conversations", strangerConversations, 200);
  expect(
    "Stranger conversation list includes pending request",
    ((strangerConversations.data as any).data || []).some(
      (item: any) => item.conversation?.id === (requestMessage.data as any).data?.conversation?.id && item.messageRequestStatus === "pending",
    ),
    JSON.stringify(strangerConversations.data),
  );

  const profileTarget = await createUser("profile-target", "web");
  const profileViewer = await createUser("profile-viewer", "web");
  const avatarOne = `https://example.com/${RUN_ID}/avatar-one.png`;
  const avatarTwo = `https://example.com/${RUN_ID}/avatar-two.png`;
  const profileFirst = await request(
    "PATCH",
    "/v1/users/me/profile",
    {
      displayName: "Private Profile Target",
      avatarUrl: avatarOne,
      birthday: "1990-01-02",
      gender: "other",
      bio: "privacy test",
    },
    profileTarget,
  );
  expectStatus("Update profile first avatar", profileFirst, 200);
  const profileSecond = await request("PATCH", "/v1/users/me/profile", { avatarUrl: avatarTwo }, profileTarget);
  expectStatus("Update profile second avatar", profileSecond, 200);
  const avatarHistory = await request("GET", "/v1/users/me/avatar-history", undefined, profileTarget);
  expectStatus("Avatar history endpoint", avatarHistory, 200);
  expect(
    "Avatar change writes previous avatar to history",
    ((avatarHistory.data as any).data || []).some((item: any) => item.avatarUrl === avatarOne),
    JSON.stringify(avatarHistory.data),
  );

  const privatePrivacy = await request(
    "PATCH",
    "/v1/users/me/privacy",
    {
      phoneVisibility: "only_me",
      birthdayVisibility: "only_me",
      avatarVisibility: "only_me",
      searchableByPhone: false,
      showOnline: false,
      showLastSeen: false,
    },
    profileTarget,
  );
  expectStatus("Set profile privacy to private", privatePrivacy, 200);
  const publicProfile = await request("GET", `/v1/users/${profileTarget.userId}/public`, undefined, profileViewer);
  expectStatus("Public profile respects privacy", publicProfile, 200);
  const publicData = (publicProfile.data as any).data || {};
  expect(
    "Public profile hides phone, birthday and avatar",
    !publicData.phone && !publicData.birthday && !publicData.avatarUrl,
    JSON.stringify(publicData),
  );
  const phoneSearch = await request(
    "GET",
    `/v1/users/search-by-phone?phone=${encodeURIComponent(profileTarget.phone)}`,
    undefined,
    profileViewer,
  );
  expectStatus("Search by phone respects privacy", phoneSearch, 404);

  const receiverRootSocket = await connectSocket(receiver);
  const viewerNoPresence = await request(
    "PATCH",
    "/v1/users/me/privacy",
    { showOnline: false, showLastSeen: false },
    profileViewer,
  );
  expectStatus("Viewer hides own presence setting", viewerNoPresence, 200);
  const profileViewerRootSocket = await connectSocket(profileViewer);
  const reciprocalPresence = await emitAck<any>(profileViewerRootSocket, "getOnlineStatus", { userId: receiver.userId });
  expect(
    "Viewer who hides presence cannot view others over socket",
    reciprocalPresence?.visibility === "hidden" && reciprocalPresence?.isOnline === false,
    JSON.stringify(reciprocalPresence),
  );

  const cardSender = await createUser("card-sender", "web");
  const cardReceiver = await createUser("card-receiver", "web");
  await makeFriends(cardSender, cardReceiver);
  const cardConversation = await request(
    "POST",
    "/v1/messages/private",
    { targetUserId: cardReceiver.userId, text: "conversation for profile card" },
    cardSender,
  );
  expectStatus("Create active conversation for profile card", cardConversation, 201);
  const cardConversationId = (cardConversation.data as any).data?.conversation?.id;
  expect("Profile card conversation id exists", cardConversationId, JSON.stringify(cardConversation.data));

  const cardReceiverSocket = await connectSocket(cardReceiver, "/messages");
  const profileCardRealtime = waitForEvent<any>(cardReceiverSocket, "receiveMessage");
  const sendProfileCard = await request(
    "POST",
    `/v1/conversations/${cardConversationId}/profile-cards`,
    { userId: profileTarget.userId },
    cardSender,
  );
  expectStatus("Send profile card", sendProfileCard, 201);
  expect(
    "Profile card response keeps type profile_card",
    (sendProfileCard.data as any).data?.type === "profile_card",
    JSON.stringify(sendProfileCard.data),
  );
  const profileCardEvent = await profileCardRealtime;
  const eventMessage = profileCardEvent?.message || {};
  expect(
    "Profile card emits realtime receiveMessage",
    eventMessage.type === "profile_card" && profileCardEvent?.conversationId === cardConversationId,
    JSON.stringify(profileCardEvent),
  );
  expect(
    "Profile card is sanitized for receiver privacy",
    eventMessage.profileCard &&
      !eventMessage.profileCard.phone &&
      !eventMessage.profileCard.birthday &&
      !eventMessage.profileCard.avatarUrl,
    JSON.stringify(eventMessage.profileCard),
  );

  aliceFriendsSocket.disconnect();
  bobFriendsSocket.disconnect();
  daveFriendsSocket.disconnect();
  bobRootSocket.disconnect();
  watcherSocket.disconnect();
  hiddenWatcherSocket.disconnect();
  targetPresenceSocket.disconnect();
  receiverRootSocket.disconnect();
  profileViewerRootSocket.disconnect();
  cardReceiverSocket.disconnect();
}

async function main() {
  console.log("=".repeat(70));
  console.log("  Live Server Session/Social API + Socket.IO Tests");
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Run ID:   ${RUN_ID}`);
  console.log("=".repeat(70));

  await runSessionDeviceTests();
  await sleep(300);
  await runSocialPrivacyTests();
  summary();
}

main().catch((err) => {
  console.error("\nTest runner error:", err);
  abort(err);
});
