import "../share/component/module-aliases";
import axios, { AxiosInstance } from "axios";
import bcrypt from "bcrypt";
import { v7 as uuidv7 } from "uuid";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { initDynamoDBTables } from "@share/repository/dynamodb/auto-init";
import { getDocClient, getTableName } from "@share/repository/dynamodb/client";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

type FriendStatus = {
  status?: string;
  direction?: "OUTGOING" | "INCOMING" | "BLOCKING" | "BLOCKED_BY";
  requestId?: string;
};

type SeedUser = {
  key: string;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  id?: string;
  token?: string;
};

const API_BASE_URL = process.env.SEED_API_URL || "http://localhost:3000/v1";
const TEST_PASSWORD =
  process.env.DEMO_PASSWORD ||
  process.env.SEED_PASSWORD ||
  (process.env.NODE_ENV === "production" ? "" : "Test@123456");
const SEED_MARKER = "[SEED_READY_V1]";
const GROUP_NAME = "Seed Demo Group";

const USERS: SeedUser[] = [
  {
    key: "user1",
    username: "user1",
    displayName: "Test User 1",
    email: "user1@test.com",
    phone: "0910000001",
  },
  {
    key: "user2",
    username: "user2",
    displayName: "Test User 2",
    email: "user2@test.com",
    phone: "0910000002",
  },
  {
    key: "user3",
    username: "user3",
    displayName: "Test User 3",
    email: "user3@test.com",
    phone: "0910000003",
  },
  {
    key: "user4",
    username: "user4",
    displayName: "Test User 4",
    email: "user4@test.com",
    phone: "0910000004",
  },
  {
    key: "user5",
    username: "user5",
    displayName: "Test User 5",
    email: "user5@test.com",
    phone: "0910000005",
  },
  {
    key: "user6",
    username: "user6",
    displayName: "Test User 6",
    email: "user6@test.com",
    phone: "0910000006",
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(err: unknown): string {
  const e = err as any;
  const msg =
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    e?.data?.message ||
    e?.data?.error ||
    e?.message;

  if (typeof msg === "string") {
    return msg;
  }

  if (msg !== undefined && msg !== null) {
    try {
      return JSON.stringify(msg);
    } catch {
      return String(msg);
    }
  }

  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function getBodyData(payload: any): any {
  if (payload?.data?.data !== undefined) {
    return payload.data.data;
  }
  if (payload?.data !== undefined) {
    return payload.data;
  }
  return payload;
}

function extractConversationId(payload: any): string | undefined {
  const data = getBodyData(payload);
  if (!data) return undefined;
  return (
    data.id ||
    data._id ||
    data.conversation?.id ||
    data.conversation?._id ||
    data.conversationId ||
    data?.data?.id ||
    data?.data?._id
  );
}

function extractMessages(payload: any): any[] {
  const data = getBodyData(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function extractConversations(payload: any): any[] {
  const body = payload?.data ?? payload;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.items)) return body.data.items;
  return [];
}

function parseTokenUserId(token?: string): string | undefined {
  if (!token) return undefined;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload?.sub;
  } catch {
    return undefined;
  }
}

function createApi(token: string): AxiosInstance {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });
}

async function findUserIdByPhone(tableName: string, phone: string): Promise<string | null> {
  const docClient = getDocClient();
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "phone-index",
      KeyConditionExpression: "phone = :phone",
      ExpressionAttributeValues: {
        ":phone": phone,
      },
      Limit: 1,
    }),
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return String(result.Items[0].id);
}

async function ensureBaseUsers(): Promise<void> {
  console.log("\n[SEED] Step 1/4 - Initialize DynamoDB tables and fixed users");
  await initDynamoDBTables();

  const docClient = getDocClient();
  const tableName = getTableName(TABLE_NAMES.USERS);

  for (const user of USERS) {
    const existingId = await findUserIdByPhone(tableName, user.phone);
    if (existingId) {
      user.id = existingId;
      console.log(`[SEED] User exists: ${user.key} (${existingId})`);
      continue;
    }

    const salt = bcrypt.genSaltSync(10);
    const hashPassword = bcrypt.hashSync(`${TEST_PASSWORD}.${salt}`, 10);
    const userId = uuidv7();
    const now = new Date().toISOString();

    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          id: userId,
          email: user.email,
          phone: user.phone,
          password: hashPassword,
          salt,
          status: "active",
          tokenVersion: 1,
          displayName: user.displayName,
          username: user.username,
          verified: { email: true, phone: true },
          privacy: {
            searchableByEmail: true,
            searchableByPhone: true,
            searchableByUsername: true,
          },
          settings: { notifications: { push: true, inApp: true } },
          createdAt: now,
          updatedAt: now,
        },
      }),
    );

    user.id = userId;
    console.log(`[SEED] User created: ${user.key} (${userId})`);
  }
}

async function loginOneUser(user: SeedUser): Promise<void> {
  const attempts = [
    { email: user.email, password: TEST_PASSWORD },
    { phone: user.phone, password: TEST_PASSWORD },
  ];

  for (const body of attempts) {
    const res = await axios.post(`${API_BASE_URL}/auth/login`, body, {
      validateStatus: () => true,
      headers: { "Content-Type": "application/json" },
    });

    if (res.status >= 200 && res.status < 300) {
      const data = getBodyData(res);
      const token = data?.accessToken;
      const bodyUserId = data?.user?.id || data?.id;
      const tokenUserId = parseTokenUserId(token);

      user.token = token;
      user.id = String(bodyUserId || tokenUserId || user.id || "");
      if (!user.token || !user.id) {
        throw new Error(`Login response missing token or user id for ${user.key}`);
      }

      console.log(`[SEED] Login OK: ${user.key} (${user.id})`);
      return;
    }
  }

  throw new Error(`Cannot login ${user.key}. Please ensure API server is running and password matches.`);
}

async function loginAllUsers(): Promise<void> {
  console.log("\n[SEED] Step 2/4 - Login users to get access tokens");
  for (const user of USERS) {
    await loginOneUser(user);
  }
}

async function getFriendStatus(user: SeedUser, targetUserId: string): Promise<FriendStatus> {
  const api = createApi(String(user.token));
  const res = await api.get(`/friend-requests/check/${targetUserId}`);
  if (res.status !== 200) {
    throw new Error(`Check friend status failed (${res.status}): ${normalizeError(res)}`);
  }
  return getBodyData(res) as FriendStatus;
}

async function acceptFriendRequest(accepter: SeedUser, requestId: string): Promise<void> {
  const api = createApi(String(accepter.token));
  const res = await api.patch(`/friend-requests/${requestId}`, { status: "accepted" });
  if (res.status !== 200) {
    throw new Error(`Accept friend request failed (${res.status}): ${normalizeError(res)}`);
  }
}

async function sendFriendRequest(sender: SeedUser, receiver: SeedUser): Promise<string> {
  const api = createApi(String(sender.token));
  const res = await api.post(`/friend-requests/${receiver.id}`, {});
  if (res.status === 201) {
    const data = getBodyData(res);
    return String(data?.id || "");
  }

  throw new Error(`Send friend request failed (${res.status}): ${normalizeError(res)}`);
}

async function ensureFriendship(userA: SeedUser, userB: SeedUser): Promise<void> {
  const status = await getFriendStatus(userA, String(userB.id));

  if (status.status === "ACCEPTED") {
    console.log(`[SEED] Friendship exists: ${userA.key} <-> ${userB.key}`);
    return;
  }

  if (status.status === "PENDING" && status.requestId) {
    if (status.direction === "OUTGOING") {
      await acceptFriendRequest(userB, status.requestId);
      console.log(`[SEED] Friendship accepted (pending outgoing): ${userA.key} -> ${userB.key}`);
      return;
    }

    if (status.direction === "INCOMING") {
      await acceptFriendRequest(userA, status.requestId);
      console.log(`[SEED] Friendship accepted (pending incoming): ${userA.key} <- ${userB.key}`);
      return;
    }
  }

  if (status.status === "BLOCKED") {
    console.log(`[SEED] Skip friendship due to blocked relation: ${userA.key} <-> ${userB.key}`);
    return;
  }

  try {
    const requestId = await sendFriendRequest(userA, userB);
    await acceptFriendRequest(userB, requestId);
    console.log(`[SEED] Friendship created: ${userA.key} <-> ${userB.key}`);
    return;
  } catch {
    const refreshedStatus = await getFriendStatus(userA, String(userB.id));
    if (refreshedStatus.status === "ACCEPTED") {
      console.log(`[SEED] Friendship became active: ${userA.key} <-> ${userB.key}`);
      return;
    }

    if (refreshedStatus.status === "PENDING" && refreshedStatus.requestId) {
      if (refreshedStatus.direction === "OUTGOING") {
        await acceptFriendRequest(userB, refreshedStatus.requestId);
        console.log(`[SEED] Friendship accepted after refresh: ${userA.key} -> ${userB.key}`);
        return;
      }

      if (refreshedStatus.direction === "INCOMING") {
        await acceptFriendRequest(userA, refreshedStatus.requestId);
        console.log(`[SEED] Friendship accepted after refresh: ${userA.key} <- ${userB.key}`);
        return;
      }
    }
  }

  throw new Error(`Cannot ensure friendship for ${userA.key} and ${userB.key}`);
}

async function ensurePrivateConversation(userA: SeedUser, userB: SeedUser): Promise<string> {
  const api = createApi(String(userA.token));
  const res = await api.post("/conversations/private", { targetUserId: userB.id });
  if (res.status !== 200) {
    throw new Error(`Create/get private conversation failed (${res.status}): ${normalizeError(res)}`);
  }

  const conversationId = extractConversationId(res);
  if (!conversationId) {
    throw new Error(`Cannot parse private conversation id for ${userA.key} and ${userB.key}`);
  }

  console.log(`[SEED] Private conversation ready: ${userA.key} <-> ${userB.key} (${conversationId})`);
  return conversationId;
}

async function hasSeedMarkerMessage(user: SeedUser, conversationId: string): Promise<boolean> {
  const api = createApi(String(user.token));
  const res = await api.get(`/conversations/${conversationId}/messages?limit=50`);
  if (res.status !== 200) {
    return false;
  }

  const messages = extractMessages(res);
  return messages.some((item) => typeof item?.text === "string" && item.text.includes(SEED_MARKER));
}

async function sendMessage(user: SeedUser, conversationId: string, text: string): Promise<void> {
  const api = createApi(String(user.token));
  const res = await api.post(`/conversations/${conversationId}/messages`, { text });
  if (res.status !== 201) {
    throw new Error(`Send message failed (${res.status}): ${normalizeError(res)}`);
  }
}

async function seedConversationMessages(
  conversationId: string,
  messages: Array<{ user: SeedUser; text: string }>,
): Promise<void> {
  const markerExists = await hasSeedMarkerMessage(messages[0].user, conversationId);
  if (markerExists) {
    console.log(`[SEED] Skip messages for ${conversationId} (marker existed)`);
    return;
  }

  for (const item of messages) {
    await sendMessage(item.user, conversationId, `${SEED_MARKER} ${item.text}`);
    await sleep(20);
  }

  console.log(`[SEED] Added ${messages.length} seed messages for ${conversationId}`);
}

async function findGroupConversationByName(owner: SeedUser, groupName: string): Promise<string | undefined> {
  const api = createApi(String(owner.token));
  const res = await api.get("/conversations/cursor?limit=100");
  if (res.status !== 200) {
    return undefined;
  }

  const conversations = extractConversations(res);
  const found = conversations.find((conv) => {
    const name = String(conv?.name || "").trim();
    const type = String(conv?.type || "").toLowerCase();
    return name === groupName && (type === "group" || type === "");
  });

  return found?.id || found?._id;
}

async function ensureGroupConversation(owner: SeedUser, members: SeedUser[]): Promise<string> {
  const api = createApi(String(owner.token));

  const existingGroupId = await findGroupConversationByName(owner, GROUP_NAME);
  if (existingGroupId) {
    console.log(`[SEED] Reuse existing group: ${existingGroupId}`);

    const membersRes = await api.get(`/groups/${existingGroupId}/members`);
    if (membersRes.status === 200) {
      const currentMembers: any[] = getBodyData(membersRes) || [];
      const currentIds = new Set(currentMembers.map((item) => item?.userId).filter(Boolean));
      const missingMemberIds = members
        .map((item) => item.id)
        .filter((id) => id && id !== owner.id && !currentIds.has(id));

      if (missingMemberIds.length > 0) {
        const addRes = await api.post(`/groups/${existingGroupId}/members`, {
          memberIds: missingMemberIds,
        });
        if (addRes.status !== 200) {
          throw new Error(`Cannot add missing members to group (${addRes.status}): ${normalizeError(addRes)}`);
        }
        console.log(`[SEED] Added ${missingMemberIds.length} missing members to existing group`);
      }
    }

    return existingGroupId;
  }

  const createRes = await api.post("/groups", {
    name: GROUP_NAME,
    memberIds: members.map((item) => item.id).filter(Boolean),
  });

  if (createRes.status !== 201) {
    throw new Error(`Create group failed (${createRes.status}): ${normalizeError(createRes)}`);
  }

  const groupId = extractConversationId(createRes);
  if (!groupId) {
    throw new Error("Cannot parse group conversation id after creating group");
  }

  console.log(`[SEED] Group created: ${groupId}`);
  return groupId;
}

function printAccountsSummary(): void {
  console.log("\n[SEED] ==================== READY ACCOUNTS ====================");
  console.log(`[SEED] API URL : ${API_BASE_URL}`);
  console.log("[SEED] Password: configured through DEMO_PASSWORD");
  for (const user of USERS) {
    console.log(
      `[SEED] ${user.key.padEnd(6)} | email: ${user.email.padEnd(20)} | phone: ${user.phone} | id: ${user.id}`,
    );
  }
  console.log("[SEED] ========================================================\n");
}

async function seedSocialAndChatData(): Promise<void> {
  console.log("\n[SEED] Step 3/4 - Ensure friendships and conversations");

  const userMap = new Map(USERS.map((item) => [item.key, item]));
  const u1 = userMap.get("user1") as SeedUser;
  const u2 = userMap.get("user2") as SeedUser;
  const u3 = userMap.get("user3") as SeedUser;
  const u4 = userMap.get("user4") as SeedUser;
  const u5 = userMap.get("user5") as SeedUser;

  await ensureFriendship(u1, u2);
  await ensureFriendship(u1, u3);
  await ensureFriendship(u2, u3);
  await ensureFriendship(u4, u5);

  const conv12 = await ensurePrivateConversation(u1, u2);
  const conv13 = await ensurePrivateConversation(u1, u3);
  const conv45 = await ensurePrivateConversation(u4, u5);
  const groupId = await ensureGroupConversation(u1, [u2, u3, u4]);

  console.log("\n[SEED] Step 4/4 - Seed sample messages");
  await seedConversationMessages(conv12, [
    { user: u1, text: "Xin chao User2, day la tin nhan mau." },
    { user: u2, text: "Chao User1, minh da nhan duoc." },
    { user: u1, text: "Toi se gui them mot file sau." },
  ]);

  await seedConversationMessages(conv13, [
    { user: u1, text: "Hello User3, demo private chat." },
    { user: u3, text: "OK User1, private chat da san sang." },
  ]);

  await seedConversationMessages(conv45, [
    { user: u4, text: "Xin chao User5, day la cap ban demo." },
    { user: u5, text: "Da ro User4, ket noi thanh cong." },
  ]);

  await seedConversationMessages(groupId, [
    { user: u1, text: "Chao mung moi nguoi den voi group seed." },
    { user: u2, text: "Da vao group, test nhan tin OK." },
    { user: u3, text: "San sang test API group chat." },
    { user: u4, text: "Group da co du thanh vien can thiet." },
  ]);
}

async function main(): Promise<void> {
  const usersOnly = process.argv.includes("--users-only");

  if (!TEST_PASSWORD) {
    throw new Error(
      "DEMO_PASSWORD is required when running the production demo seed",
    );
  }

  console.log("\n============================================================");
  console.log("  READY DATA SEED FOR CHATBE");
  console.log("============================================================");

  await ensureBaseUsers();
  printAccountsSummary();

  if (usersOnly) {
    console.log("[SEED] Done users-only mode.");
    return;
  }

  try {
    await loginAllUsers();
  } catch (err) {
    throw new Error(
      `${normalizeError(err)}. Start API server first with 'npm run start', then run this seed script again.`,
    );
  }

  await seedSocialAndChatData();

  console.log("\n[SEED] DONE - Ready data has been created successfully.");
  console.log("[SEED] You can now test APIs, socket flows, and UI with fixed accounts.\n");
}

main().catch((err) => {
  console.error("\n[SEED] FAILED:", normalizeError(err));
  process.exit(1);
});
