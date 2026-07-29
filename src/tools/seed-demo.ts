import "../share/component/module-aliases";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import bcrypt from "bcrypt";
import { v7 as uuidv7 } from "uuid";
import {
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "@share/component/config";
import { CloudStorage } from "@share/middleware/upload/cloud-storage";
import { IUploadConfig } from "@share/middleware/upload/storage-interface";
import { initDynamoDBTables } from "@share/repository/dynamodb/auto-init";
import {
  getDocClient,
  getTableName,
} from "@share/repository/dynamodb/client";
import { TABLE_NAMES } from "@share/repository/dynamodb/table-defs";

type FriendStatus = {
  status?: string;
  direction?: "OUTGOING" | "INCOMING" | "BLOCKING" | "BLOCKED_BY";
  requestId?: string;
};

type PrivacySettings = {
  searchableByEmail: boolean;
  searchableByPhone: boolean;
  searchableByUsername: boolean;
  birthdayVisibility: "everyone" | "friends" | "only_me";
  phoneVisibility: "everyone" | "friends" | "only_me";
  avatarVisibility: "everyone" | "friends" | "only_me";
  showOnline: boolean;
  showLastSeen: boolean;
  blockMessagesFromStrangers: boolean;
};

type SeedUser = {
  key: string;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  bio: string;
  birthday: string;
  gender: "male" | "female" | "other";
  privacy?: Partial<PrivacySettings>;
  id?: string;
  token?: string;
};

type MediaAttachment = {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
};

type DemoAssets = {
  avatarUrls: Record<string, string>;
  coverUrl?: string;
  image?: MediaAttachment;
  document?: MediaAttachment;
};

type SeedMessageInput = {
  tag: string;
  user: SeedUser;
  text?: string;
  media?: MediaAttachment[];
};

type SeededConversations = {
  private12: string;
  private13: string;
  private45: string;
  group: string;
};

const API_BASE_URL = process.env.SEED_API_URL || "http://localhost:3000/v1";
const TEST_PASSWORD =
  process.env.DEMO_PASSWORD ||
  process.env.SEED_PASSWORD ||
  (process.env.NODE_ENV === "production" ? "" : "Test@123456");
const SEED_VERSION = "RECRUITER_V2";
const SEED_MARKER = `[SEED_${SEED_VERSION}]`;
const GROUP_NAME = "Seed Demo Group";
const POLL_QUESTION = "Tính năng nào của ChatBE gây ấn tượng nhất?";
const NOTE_TITLE = "Checklist demo dành cho nhà tuyển dụng";
const REMINDER_TITLE = "Phỏng vấn kỹ thuật ChatBE";

const DEFAULT_PRIVACY: PrivacySettings = {
  searchableByEmail: true,
  searchableByPhone: true,
  searchableByUsername: true,
  birthdayVisibility: "friends",
  phoneVisibility: "friends",
  avatarVisibility: "everyone",
  showOnline: true,
  showLastSeen: true,
  blockMessagesFromStrangers: false,
};

const USERS: SeedUser[] = [
  {
    key: "user1",
    username: "user1",
    displayName: "Phương · Demo Owner",
    email: "user1@test.com",
    phone: "0910000001",
    bio: "Tài khoản chính dành cho nhà tuyển dụng: owner của nhóm demo.",
    birthday: "1998-04-15T00:00:00.000Z",
    gender: "male",
  },
  {
    key: "user2",
    username: "user2",
    displayName: "An · Group Admin",
    email: "user2@test.com",
    phone: "0910000002",
    bio: "Bạn bè của user1, quản trị viên nhóm và tài khoản test realtime thứ hai.",
    birthday: "1997-08-20T00:00:00.000Z",
    gender: "female",
  },
  {
    key: "user3",
    username: "user3",
    displayName: "Bình · Team Member",
    email: "user3@test.com",
    phone: "0910000003",
    bio: "Thành viên nhóm dùng để test poll, reaction và read receipt.",
    birthday: "1999-02-11T00:00:00.000Z",
    gender: "male",
  },
  {
    key: "user4",
    username: "user4",
    displayName: "Chi · Media Tester",
    email: "user4@test.com",
    phone: "0910000004",
    bio: "Tài khoản chuyên kiểm tra upload, media gallery và tìm kiếm.",
    birthday: "2000-10-03T00:00:00.000Z",
    gender: "female",
  },
  {
    key: "user5",
    username: "user5",
    displayName: "Dũng · Pending Friend",
    email: "user5@test.com",
    phone: "0910000005",
    bio: "Đã là bạn của user4 và đang gửi lời mời kết bạn tới user1.",
    birthday: "1996-12-09T00:00:00.000Z",
    gender: "male",
  },
  {
    key: "user6",
    username: "user6",
    displayName: "Em · Blocked Contact",
    email: "user6@test.com",
    phone: "0910000006",
    bio: "Tài khoản được user1 chặn để kiểm tra block list và quyền truy cập profile.",
    birthday: "1998-06-25T00:00:00.000Z",
    gender: "female",
  },
  {
    key: "user7",
    username: "user7",
    displayName: "Giang · Stranger Request",
    email: "user7@test.com",
    phone: "0910000007",
    bio: "Người lạ gửi message request tới user1.",
    birthday: "2001-01-17T00:00:00.000Z",
    gender: "other",
  },
  {
    key: "user8",
    username: "user8",
    displayName: "Hà · Private Profile",
    email: "user8@test.com",
    phone: "0910000008",
    bio: "Tài khoản riêng tư: ẩn thông tin và từ chối tin nhắn từ người lạ.",
    birthday: "1995-11-30T00:00:00.000Z",
    gender: "female",
    privacy: {
      searchableByEmail: false,
      searchableByPhone: false,
      birthdayVisibility: "only_me",
      phoneVisibility: "only_me",
      avatarVisibility: "friends",
      showOnline: false,
      showLastSeen: false,
      blockMessagesFromStrangers: true,
    },
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(err: unknown): string {
  const e = err as any;
  const candidates = [
    e?.response?.data?.error?.message,
    e?.response?.data?.msg,
    e?.response?.data?.message,
    e?.response?.data?.error,
    e?.data?.error?.message,
    e?.data?.msg,
    e?.data?.message,
    e?.data?.error,
    e?.message,
  ];
  const message = candidates.find(
    (value) => value !== undefined && value !== null,
  );

  if (typeof message === "string") return message;
  if (message !== undefined) {
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function getBodyData(payload: any): any {
  if (payload?.data?.data !== undefined) return payload.data.data;
  if (payload?.data !== undefined) return payload.data;
  return payload;
}

function extractArray(payload: any): any[] {
  const data = getBodyData(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.polls)) return data.polls;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function extractConversationId(payload: any): string | undefined {
  const data = getBodyData(payload);
  return (
    data?.id ||
    data?._id ||
    data?.conversation?.id ||
    data?.conversation?._id ||
    data?.conversationId ||
    data?.data?.id ||
    data?.data?._id
  );
}

function parseTokenUserId(token?: string): string | undefined {
  if (!token) return undefined;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
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

function assertStatus(
  response: AxiosResponse,
  expected: number | number[],
  label: string,
): void {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(response.status)) {
    throw new Error(
      `${label} failed (${response.status}): ${normalizeError(response)}`,
    );
  }
}

function requireUser(key: string): SeedUser {
  const user = USERS.find((item) => item.key === key);
  if (!user) throw new Error(`Unknown seed user: ${key}`);
  return user;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function avatarSvg(user: SeedUser, index: number): string {
  const palette = [
    ["#2563eb", "#06b6d4"],
    ["#7c3aed", "#ec4899"],
    ["#059669", "#22c55e"],
    ["#ea580c", "#facc15"],
    ["#dc2626", "#fb7185"],
    ["#4f46e5", "#818cf8"],
    ["#0891b2", "#67e8f9"],
    ["#9333ea", "#d8b4fe"],
  ];
  const [from, to] = palette[index % palette.length];
  const initial = escapeXml(
    user.displayName.replace(/[^A-Za-zÀ-ỹ]/g, "").slice(0, 1).toUpperCase(),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="512" height="512" rx="128" fill="url(#g)"/>
  <circle cx="390" cy="110" r="92" fill="#fff" opacity=".12"/>
  <text x="256" y="326" text-anchor="middle" font-family="Arial, sans-serif" font-size="230" font-weight="700" fill="#fff">${initial}</text>
</svg>`;
}

function coverSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f172a"/><stop offset=".55" stop-color="#1d4ed8"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs>
  <rect width="1200" height="630" rx="36" fill="url(#bg)"/>
  <circle cx="1030" cy="110" r="230" fill="#fff" opacity=".08"/>
  <circle cx="100" cy="590" r="270" fill="#fff" opacity=".06"/>
  <text x="90" y="250" font-family="Arial, sans-serif" font-size="92" font-weight="700" fill="#fff">ChatBE</text>
  <text x="94" y="330" font-family="Arial, sans-serif" font-size="38" fill="#dbeafe">Recruiter-ready full-stack chat demo</text>
  <text x="94" y="405" font-family="Arial, sans-serif" font-size="28" fill="#cffafe">Express · Socket.IO · DynamoDB Local · Redis · MinIO · LiveKit · Gemini</text>
</svg>`;
}

function createCloudStorage(): CloudStorage | undefined {
  if (!config.upload.cloud.enabled) return undefined;

  const uploadConfig: IUploadConfig = {
    maxFileSize: config.upload.maxFileSize,
    allowedMimeTypes: config.upload.allowedMimeTypes,
    destination: config.upload.destination,
    baseUrl: config.upload.baseUrl,
    cloudEnabled: true,
    cloudProvider: config.upload.cloud.provider,
    cloudBucket: config.upload.cloud.bucketName,
    cloudRegion: config.upload.cloud.region,
    cloudEndpoint: config.upload.cloud.endpoint,
    cloudPublicEndpoint: config.upload.cloud.publicEndpoint,
    cloudPublicBaseUrl: config.upload.cloud.publicBaseUrl,
    cloudForcePathStyle: config.upload.cloud.forcePathStyle,
    cloudAccessKeyId: config.upload.cloud.accessKeyId,
    cloudSecretAccessKey: config.upload.cloud.secretAccessKey,
  };

  return new CloudStorage(
    uploadConfig,
    config.upload.cloud.bucketName,
    config.upload.cloud.region,
  );
}

async function ensureDemoAssets(): Promise<DemoAssets> {
  console.log("\n[SEED] Step 1/8 - Upload fixed demo assets to MinIO");
  const storage = createCloudStorage();
  if (!storage) {
    console.log(
      "[SEED] Cloud storage disabled; media messages and profile images will be skipped.",
    );
    return { avatarUrls: {} };
  }

  const avatarUrls: Record<string, string> = {};
  for (const [index, user] of USERS.entries()) {
    const filename = `demo/recruiter/${user.key}-avatar.svg`;
    avatarUrls[user.key] = await storage.uploadToS3(
      Buffer.from(avatarSvg(user, index), "utf8"),
      filename,
      "image/svg+xml",
    );
  }

  const coverFilename = "demo/recruiter/chatbe-cover.svg";
  const coverBuffer = Buffer.from(coverSvg(), "utf8");
  const coverUrl = await storage.uploadToS3(
    coverBuffer,
    coverFilename,
    "image/svg+xml",
  );

  const checklistFilename = "demo/recruiter/recruiter-checklist.txt";
  const checklistBuffer = Buffer.from(
    [
      "CHATBE RECRUITER DEMO",
      "",
      "1. Login user1 and user2 in two browsers.",
      "2. Test REST chat, Socket.IO realtime, read receipt and typing.",
      "3. Open Seed Demo Group to test roles, poll, reminder and note.",
      "4. Test media upload/download through MinIO.",
      "5. Test LiveKit call and Gemini AI with configured cloud keys.",
    ].join("\n"),
    "utf8",
  );
  const checklistUrl = await storage.uploadToS3(
    checklistBuffer,
    checklistFilename,
    "text/plain; charset=utf-8",
  );

  console.log(
    `[SEED] Uploaded ${USERS.length + 2} reusable objects to ${config.upload.cloud.bucketName}.`,
  );
  return {
    avatarUrls,
    coverUrl,
    image: {
      url: coverUrl,
      filename: "chatbe-cover.svg",
      mimetype: "image/svg+xml",
      size: coverBuffer.length,
    },
    document: {
      url: checklistUrl,
      filename: "recruiter-checklist.txt",
      mimetype: "text/plain",
      size: checklistBuffer.length,
    },
  };
}

async function findUserIdByPhone(
  tableName: string,
  phone: string,
): Promise<string | null> {
  const result = await getDocClient().send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "phone-index",
      KeyConditionExpression: "phone = :phone",
      ExpressionAttributeValues: { ":phone": phone },
      Limit: 1,
    }),
  );
  return result.Items?.[0]?.id ? String(result.Items[0].id) : null;
}

function effectivePrivacy(user: SeedUser): PrivacySettings {
  return { ...DEFAULT_PRIVACY, ...(user.privacy || {}) };
}

async function ensureBaseUsers(assets: DemoAssets): Promise<void> {
  console.log(
    "\n[SEED] Step 2/8 - Initialize DynamoDB tables and restore demo accounts",
  );
  await initDynamoDBTables();

  const docClient = getDocClient();
  const tableName = getTableName(TABLE_NAMES.USERS);

  for (const user of USERS) {
    const existingId = await findUserIdByPhone(tableName, user.phone);
    const userId = existingId || uuidv7();
    const salt = bcrypt.genSaltSync(10);
    const hashPassword = bcrypt.hashSync(`${TEST_PASSWORD}.${salt}`, 10);
    const now = new Date().toISOString();
    const profile = {
      email: user.email,
      phone: user.phone,
      username: user.username,
      password: hashPassword,
      salt,
      status: "active",
      tokenVersion: 1,
      displayName: user.displayName,
      avatarUrl: assets.avatarUrls[user.key],
      coverUrl: assets.coverUrl,
      birthday: user.birthday,
      gender: user.gender,
      bio: user.bio,
      verified: { email: true, phone: true },
      privacy: effectivePrivacy(user),
      settings: { notifications: { push: true, inApp: true } },
      updatedAt: now,
    };

    if (existingId) {
      const entries = Object.entries(profile).filter(
        ([, value]) => value !== undefined,
      );
      await docClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { id: userId },
          UpdateExpression: `SET ${entries
            .map(([key]) => `#${key} = :${key}`)
            .join(", ")}`,
          ExpressionAttributeNames: Object.fromEntries(
            entries.map(([key]) => [`#${key}`, key]),
          ),
          ExpressionAttributeValues: Object.fromEntries(
            entries.map(([key, value]) => [`:${key}`, value]),
          ),
        }),
      );
      console.log(`[SEED] Account restored: ${user.key} (${userId})`);
    } else {
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            id: userId,
            ...profile,
            createdAt: now,
          },
        }),
      );
      console.log(`[SEED] Account created: ${user.key} (${userId})`);
    }
    user.id = userId;
  }
}

async function loginOneUser(user: SeedUser): Promise<void> {
  const attempts = [
    { phone: user.phone, password: TEST_PASSWORD },
    { email: user.email, password: TEST_PASSWORD },
  ];

  for (const body of attempts) {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, body, {
      validateStatus: () => true,
      headers: { "Content-Type": "application/json" },
    });
    if (response.status < 200 || response.status >= 300) continue;

    const data = getBodyData(response);
    const token = data?.accessToken;
    const bodyUserId = data?.user?.id || data?.id;
    user.token = token;
    user.id = String(
      bodyUserId || parseTokenUserId(token) || user.id || "",
    );
    if (!user.token || !user.id) {
      throw new Error(
        `Login response missing access token or user id for ${user.key}`,
      );
    }
    console.log(`[SEED] Login OK: ${user.key} (${user.id})`);
    return;
  }

  throw new Error(
    `Cannot login ${user.key}; API is unavailable or DEMO_PASSWORD does not match.`,
  );
}

async function loginAllUsers(): Promise<void> {
  console.log("\n[SEED] Step 3/8 - Login all demo accounts");
  for (const user of USERS) await loginOneUser(user);
}

async function getFriendStatus(
  user: SeedUser,
  targetUserId: string,
): Promise<FriendStatus> {
  const response = await createApi(String(user.token)).get(
    `/friend-requests/check/${targetUserId}`,
  );
  assertStatus(response, 200, "Check friend status");
  return getBodyData(response) as FriendStatus;
}

async function acceptFriendRequest(
  accepter: SeedUser,
  requestId: string,
): Promise<void> {
  const response = await createApi(String(accepter.token)).patch(
    `/friend-requests/${requestId}`,
    { status: "accepted" },
  );
  assertStatus(response, 200, "Accept friend request");
}

async function sendFriendRequest(
  sender: SeedUser,
  receiver: SeedUser,
): Promise<string> {
  const response = await createApi(String(sender.token)).post(
    `/friend-requests/${receiver.id}`,
    {},
  );
  assertStatus(response, 201, "Send friend request");
  return String(getBodyData(response)?.id || "");
}

async function ensureFriendship(
  userA: SeedUser,
  userB: SeedUser,
): Promise<void> {
  const status = await getFriendStatus(userA, String(userB.id));
  if (status.status === "ACCEPTED") {
    console.log(`[SEED] Friendship exists: ${userA.key} <-> ${userB.key}`);
    return;
  }
  if (status.status === "PENDING" && status.requestId) {
    const accepter =
      status.direction === "OUTGOING"
        ? userB
        : status.direction === "INCOMING"
          ? userA
          : undefined;
    if (accepter) {
      await acceptFriendRequest(accepter, status.requestId);
      console.log(
        `[SEED] Friendship accepted: ${userA.key} <-> ${userB.key}`,
      );
      return;
    }
  }
  if (status.status === "BLOCKED") {
    throw new Error(
      `Cannot create required friendship because ${userA.key} and ${userB.key} are blocked.`,
    );
  }

  try {
    const requestId = await sendFriendRequest(userA, userB);
    await acceptFriendRequest(userB, requestId);
  } catch (error) {
    const refreshed = await getFriendStatus(userA, String(userB.id));
    if (refreshed.status === "ACCEPTED") return;
    if (refreshed.status === "PENDING" && refreshed.requestId) {
      const accepter =
        refreshed.direction === "OUTGOING" ? userB : userA;
      await acceptFriendRequest(accepter, refreshed.requestId);
    } else {
      throw error;
    }
  }
  console.log(`[SEED] Friendship created: ${userA.key} <-> ${userB.key}`);
}

async function cancelFriendRequest(
  sender: SeedUser,
  requestId: string,
): Promise<void> {
  const response = await createApi(String(sender.token)).delete(
    `/friend-requests/${requestId}`,
  );
  assertStatus(response, [200, 204], "Cancel friend request");
}

async function ensurePendingFriendRequest(
  sender: SeedUser,
  receiver: SeedUser,
): Promise<void> {
  let status = await getFriendStatus(sender, String(receiver.id));
  if (
    status.status === "PENDING" &&
    status.direction === "OUTGOING"
  ) {
    console.log(
      `[SEED] Pending friend request exists: ${sender.key} -> ${receiver.key}`,
    );
    return;
  }

  if (status.status === "ACCEPTED") {
    const response = await createApi(String(sender.token)).delete(
      `/friendships/${receiver.id}`,
    );
    assertStatus(response, 204, "Reset accepted friendship to pending");
    status = await getFriendStatus(sender, String(receiver.id));
  }

  if (
    status.status === "PENDING" &&
    status.direction === "INCOMING" &&
    status.requestId
  ) {
    await cancelFriendRequest(receiver, status.requestId);
  }

  if (status.status === "BLOCKED") {
    console.log(
      `[SEED] Warning: cannot create pending request ${sender.key} -> ${receiver.key} because a block exists.`,
    );
    return;
  }

  await sendFriendRequest(sender, receiver);
  console.log(
    `[SEED] Pending friend request created: ${sender.key} -> ${receiver.key}`,
  );
}

async function ensureBlocked(
  blocker: SeedUser,
  blocked: SeedUser,
): Promise<void> {
  const api = createApi(String(blocker.token));
  const check = await api.get(`/blocks/${blocked.id}/check`);
  assertStatus(check, 200, "Check block status");
  if (getBodyData(check)?.isBlocked) {
    console.log(`[SEED] Block exists: ${blocker.key} -> ${blocked.key}`);
    return;
  }
  const response = await api.post(`/blocks/${blocked.id}`, {});
  assertStatus(response, 200, "Block demo user");
  console.log(`[SEED] Block created: ${blocker.key} -> ${blocked.key}`);
}

async function ensurePrivateConversation(
  userA: SeedUser,
  userB: SeedUser,
): Promise<string> {
  const response = await createApi(String(userA.token)).post(
    "/conversations/private",
    { targetUserId: userB.id },
  );
  assertStatus(response, 200, "Create/get private conversation");
  const conversationId = extractConversationId(response);
  if (!conversationId) {
    throw new Error(
      `Cannot parse private conversation id for ${userA.key} and ${userB.key}`,
    );
  }
  console.log(
    `[SEED] Private conversation ready: ${userA.key} <-> ${userB.key} (${conversationId})`,
  );
  return conversationId;
}

async function findGroupConversationByName(
  owner: SeedUser,
  groupName: string,
): Promise<any | undefined> {
  const response = await createApi(String(owner.token)).get(
    "/conversations/cursor?limit=100",
  );
  if (response.status !== 200) return undefined;
  return extractArray(response).find((conversation) => {
    const name = String(conversation?.name || "").trim();
    const type = String(conversation?.type || "").toLowerCase();
    const ownerMatches =
      !conversation?.ownerId || conversation.ownerId === owner.id;
    return (
      name === groupName &&
      ownerMatches &&
      (type === "group" || type === "")
    );
  });
}

async function ensureGroupConversation(
  owner: SeedUser,
  members: SeedUser[],
): Promise<string> {
  const api = createApi(String(owner.token));
  const existing = await findGroupConversationByName(owner, GROUP_NAME);
  if (existing?.id || existing?._id) {
    const groupId = String(existing.id || existing._id);
    const membersResponse = await api.get(`/groups/${groupId}/members`);
    assertStatus(membersResponse, 200, "List existing group members");
    const currentIds = new Set(
      extractArray(membersResponse)
        .map((item) => item?.userId)
        .filter(Boolean),
    );
    const missingMemberIds = members
      .map((item) => item.id)
      .filter(
        (id): id is string =>
          !!id && id !== owner.id && !currentIds.has(id),
      );
    if (missingMemberIds.length > 0) {
      const addResponse = await api.post(`/groups/${groupId}/members`, {
        memberIds: missingMemberIds,
      });
      assertStatus(addResponse, 200, "Add missing demo group members");
    }
    console.log(`[SEED] Reuse existing group: ${groupId}`);
    return groupId;
  }

  const response = await api.post("/groups", {
    name: GROUP_NAME,
    memberIds: members.map((item) => item.id).filter(Boolean),
  });
  assertStatus(response, 201, "Create demo group");
  const groupId = extractConversationId(response);
  if (!groupId) throw new Error("Cannot parse group id after creation");
  console.log(`[SEED] Group created: ${groupId}`);
  return groupId;
}

async function ensureSocialGraphAndConversations(): Promise<SeededConversations> {
  console.log(
    "\n[SEED] Step 4/8 - Create relationship states and conversations",
  );
  const u1 = requireUser("user1");
  const u2 = requireUser("user2");
  const u3 = requireUser("user3");
  const u4 = requireUser("user4");
  const u5 = requireUser("user5");

  await ensureFriendship(u1, u2);
  await ensureFriendship(u1, u3);
  await ensureFriendship(u1, u4);
  await ensureFriendship(u2, u3);
  await ensureFriendship(u2, u4);
  await ensureFriendship(u4, u5);
  await ensurePendingFriendRequest(u5, u1);

  return {
    private12: await ensurePrivateConversation(u1, u2),
    private13: await ensurePrivateConversation(u1, u3),
    private45: await ensurePrivateConversation(u4, u5),
    group: await ensureGroupConversation(u1, [u2, u3, u4]),
  };
}

async function loadMessages(
  viewer: SeedUser,
  conversationId: string,
): Promise<any[]> {
  const response = await createApi(String(viewer.token)).get(
    `/conversations/${conversationId}/messages?limit=100`,
  );
  assertStatus(response, 200, "Load seeded conversation messages");
  return extractArray(response);
}

async function sendMessage(
  input: SeedMessageInput,
  conversationId: string,
): Promise<any[]> {
  const response = await createApi(String(input.user.token)).post(
    `/conversations/${conversationId}/messages`,
    {
      text: input.text ? `${input.tag} ${input.text}` : input.tag,
      media: input.media,
      clientMessageId: `seed-${SEED_VERSION.toLowerCase()}-${input.tag
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()}`,
    },
  );
  assertStatus(response, 201, `Send seed message ${input.tag}`);
  return extractArray(response);
}

async function seedMessages(
  conversationId: string,
  inputs: SeedMessageInput[],
): Promise<Record<string, any>> {
  const viewer = inputs[0].user;
  const messages = await loadMessages(viewer, conversationId);
  const result: Record<string, any> = {};

  for (const input of inputs) {
    let existing = messages.find(
      (message) =>
        typeof message?.text === "string" &&
        message.text.includes(input.tag),
    );
    if (!existing) {
      const created = await sendMessage(input, conversationId);
      existing =
        created.find(
          (message) =>
            typeof message?.text === "string" &&
            message.text.includes(input.tag),
        ) || created[0];
      if (!existing) {
        throw new Error(`Cannot parse created message for ${input.tag}`);
      }
      messages.push(...created);
      await sleep(20);
    }
    result[input.tag] = existing;
  }
  console.log(
    `[SEED] Conversation ${conversationId}: ${inputs.length} message scenarios ready.`,
  );
  return result;
}

async function seedConversationMessages(
  conversations: SeededConversations,
  assets: DemoAssets,
): Promise<Record<string, any>> {
  console.log("\n[SEED] Step 5/8 - Seed searchable, link and media messages");
  const u1 = requireUser("user1");
  const u2 = requireUser("user2");
  const u3 = requireUser("user3");
  const u4 = requireUser("user4");
  const u5 = requireUser("user5");
  const allMessages: Record<string, any> = {};

  Object.assign(
    allMessages,
    await seedMessages(conversations.private12, [
      {
        tag: "[DEMO_PRIVATE_WELCOME]",
        user: u1,
        text: `${SEED_MARKER} Chào An, đây là cuộc trò chuyện chính để kiểm tra realtime.`,
      },
      {
        tag: "[DEMO_PRIVATE_REPLY]",
        user: u2,
        text: "Mình đã nhận được. Hãy mở hai trình duyệt để thử Socket.IO và typing.",
      },
      {
        tag: "[DEMO_SEARCH_KEYWORD]",
        user: u1,
        text: "Từ khóa tìm kiếm toàn cục: TUYENDUNG_CHATBE_2026.",
      },
      {
        tag: "[DEMO_LINK]",
        user: u2,
        text: "Link preview và classification: https://iamphuong.tech",
      },
      ...(assets.image
        ? [
            {
              tag: "[DEMO_IMAGE]",
              user: u1,
              text: "Ảnh này được phục vụ từ MinIO qua Cloudflare Tunnel.",
              media: [assets.image],
            },
          ]
        : []),
      ...(assets.document
        ? [
            {
              tag: "[DEMO_FILE]",
              user: u2,
              text: "File checklist để kiểm tra tải xuống và media gallery.",
              media: [assets.document],
            },
          ]
        : []),
    ]),
  );

  Object.assign(
    allMessages,
    await seedMessages(conversations.private13, [
      {
        tag: "[DEMO_AI_CONTEXT_1]",
        user: u1,
        text: `${SEED_MARKER} Sprint hiện tại cần hoàn thành đăng nhập, chat nhóm và upload trước thứ Sáu.`,
      },
      {
        tag: "[DEMO_AI_CONTEXT_2]",
        user: u3,
        text: "Bình sẽ kiểm tra frontend, Phương kiểm tra backend, ưu tiên lỗi realtime.",
      },
      {
        tag: "[DEMO_AI_CONTEXT_3]",
        user: u1,
        text: "Hãy dùng đoạn hội thoại này để thử tóm tắt, trích xuất công việc và smart reply.",
      },
    ]),
  );

  Object.assign(
    allMessages,
    await seedMessages(conversations.private45, [
      {
        tag: "[DEMO_MUTUAL_FRIEND]",
        user: u4,
        text: `${SEED_MARKER} Cuộc trò chuyện này tạo dữ liệu mutual friend và friend suggestion.`,
      },
      {
        tag: "[DEMO_MEDIA_SEARCH]",
        user: u5,
        text: "Hãy thử tìm kiếm media, link và file trong conversation.",
      },
    ]),
  );

  Object.assign(
    allMessages,
    await seedMessages(conversations.group, [
      {
        tag: "[DEMO_GROUP_WELCOME]",
        user: u1,
        text: `${SEED_MARKER} Chào mừng đến nhóm demo toàn diện dành cho nhà tuyển dụng.`,
      },
      {
        tag: "[DEMO_GROUP_ADMIN]",
        user: u2,
        text: "User2 sẽ là admin; user1 là owner; user3 và user4 là member.",
      },
      {
        tag: "[DEMO_GROUP_AGENDA]",
        user: u3,
        text: "Agenda: realtime, phân quyền, poll, reminder, note, media, call và AI.",
      },
      {
        tag: "[DEMO_GROUP_SEARCH]",
        user: u4,
        text: "Từ khóa nhóm: CHATBE_GROUP_FULL_FEATURE.",
      },
      ...(assets.image
        ? [
            {
              tag: "[DEMO_GROUP_MEDIA]",
              user: u1,
              text: "Media dùng chung trong nhóm.",
              media: [assets.image],
            },
          ]
        : []),
    ]),
  );

  return allMessages;
}

async function ensureReaction(
  user: SeedUser,
  messageId: string,
  emoji: string,
): Promise<void> {
  const api = createApi(String(user.token));
  const current = await api.get(`/messages/${messageId}/reactions`);
  assertStatus(current, 200, "List reactions");
  const reactions = getBodyData(current)?.reactions || extractArray(current);
  if (
    Array.isArray(reactions) &&
    reactions.some(
      (reaction) =>
        reaction?.userId === user.id && reaction?.emoji === emoji,
    )
  ) {
    return;
  }
  const response = await api.post(`/messages/${messageId}/react`, { emoji });
  assertStatus(response, 201, "Add demo reaction");
}

async function ensurePinnedMessage(
  user: SeedUser,
  conversationId: string,
  messageId: string,
): Promise<void> {
  const api = createApi(String(user.token));
  const current = await api.get(
    `/conversations/${conversationId}/pinned-messages`,
  );
  assertStatus(current, 200, "List pinned messages");
  if (extractArray(current).some((message) => message?.id === messageId)) return;
  const response = await api.post(`/messages/${messageId}/pin`, {});
  assertStatus(response, 200, "Pin demo message");
}

async function ensureQuotedReply(
  user: SeedUser,
  conversationId: string,
  quotedMessageId: string,
): Promise<void> {
  const messages = await loadMessages(user, conversationId);
  if (
    messages.some(
      (message) =>
        message?.quotedMessageId === quotedMessageId &&
        String(message?.text || "").includes("[DEMO_QUOTE]"),
    )
  ) {
    return;
  }
  const response = await createApi(String(user.token)).post(
    `/messages/${quotedMessageId}/quote`,
    { text: "[DEMO_QUOTE] Đây là reply có trích dẫn tin nhắn gốc." },
  );
  assertStatus(response, 201, "Create quoted reply");
}

async function ensureProfileCard(
  sender: SeedUser,
  conversationId: string,
  profileUser: SeedUser,
): Promise<void> {
  const messages = await loadMessages(sender, conversationId);
  if (
    messages.some(
      (message) =>
        message?.type === "profile_card" &&
        message?.profileCardUserId === profileUser.id,
    )
  ) {
    return;
  }
  const response = await createApi(String(sender.token)).post(
    `/conversations/${conversationId}/profile-cards`,
    { userId: profileUser.id },
  );
  assertStatus(response, 201, "Send profile card");
}

async function ensureSavedMessage(
  user: SeedUser,
  sourceMessageId: string,
): Promise<void> {
  const api = createApi(String(user.token));
  const conversations = await api.get("/conversations/cursor?limit=100");
  assertStatus(conversations, 200, "List conversations for Saved Messages");
  const savedConversation = extractArray(conversations).find(
    (conversation) =>
      conversation?.isSavedMessages === true ||
      conversation?.name === "Saved Messages",
  );
  if (savedConversation?.id) {
    const savedMessages = await loadMessages(user, savedConversation.id);
    if (
      savedMessages.some(
        (message) => message?.forwardedFromMessageId === sourceMessageId,
      )
    ) {
      return;
    }
  }
  const response = await api.post("/messages/save-to-my-document", {
    messageIds: [sourceMessageId],
  });
  assertStatus(response, 201, "Save message to My Documents");
}

async function ensureConversationPreferences(
  user: SeedUser,
  conversationId: string,
  targetUser: SeedUser,
  wallpaperUrl?: string,
): Promise<void> {
  const api = createApi(String(user.token));
  const nicknameResponse = await api.patch(
    `/conversations/${conversationId}/nickname`,
    { targetUserId: targetUser.id, nickname: "Admin demo" },
  );
  assertStatus(nicknameResponse, 200, "Set demo nickname");

  if (wallpaperUrl) {
    const wallpaperResponse = await api.patch(
      `/conversations/${conversationId}/wallpaper`,
      { wallpaperUrl },
    );
    assertStatus(wallpaperResponse, 200, "Set demo wallpaper");
  }

  const draftResponse = await api.post(
    `/conversations/${conversationId}/drafts`,
    {
      text: "Bản nháp demo — có thể sửa hoặc xóa để kiểm tra đồng bộ.",
      media: [],
    },
  );
  assertStatus(draftResponse, 200, "Save demo draft");
}

async function seedMessageActions(
  conversations: SeededConversations,
  messages: Record<string, any>,
  assets: DemoAssets,
): Promise<void> {
  console.log(
    "\n[SEED] Step 6/8 - Seed reactions, pin, quote, Saved Messages and preferences",
  );
  const u1 = requireUser("user1");
  const u2 = requireUser("user2");
  const u3 = requireUser("user3");

  const welcome = messages["[DEMO_PRIVATE_WELCOME]"];
  const searchMessage = messages["[DEMO_SEARCH_KEYWORD]"];
  const groupAgenda = messages["[DEMO_GROUP_AGENDA]"];
  if (!welcome?.id || !searchMessage?.id || !groupAgenda?.id) {
    throw new Error("Required seeded message IDs are missing");
  }

  await ensureReaction(u2, welcome.id, "👍");
  await ensureReaction(u3, groupAgenda.id, "🚀");
  await ensurePinnedMessage(
    u1,
    conversations.private12,
    searchMessage.id,
  );
  await ensurePinnedMessage(u1, conversations.group, groupAgenda.id);
  await ensureQuotedReply(
    u2,
    conversations.private12,
    welcome.id,
  );
  await ensureProfileCard(u1, conversations.private12, u3);
  await ensureSavedMessage(u1, searchMessage.id);
  await ensureConversationPreferences(
    u1,
    conversations.private12,
    u2,
    assets.coverUrl,
  );
  console.log("[SEED] Rich message actions ready.");
}

async function ensureGroupAdmin(
  owner: SeedUser,
  admin: SeedUser,
  groupId: string,
): Promise<void> {
  const api = createApi(String(owner.token));
  const membersResponse = await api.get(`/groups/${groupId}/members`);
  assertStatus(membersResponse, 200, "List group members for role setup");
  const member = extractArray(membersResponse).find(
    (item) => item?.userId === admin.id,
  );
  if (member?.role === "admin") return;
  const response = await api.post(`/groups/${groupId}/set-admin`, {
    targetUserId: admin.id,
    isAdmin: true,
  });
  assertStatus(response, 200, "Assign demo group admin");
}

async function ensureGroupSettings(
  owner: SeedUser,
  groupId: string,
): Promise<void> {
  const api = createApi(String(owner.token));
  const infoResponse = await api.get(`/groups/${groupId}/info`);
  assertStatus(infoResponse, 200, "Load group settings");
  const info = getBodyData(infoResponse);
  const settings = info?.settings || info?.conversation?.settings;
  const alreadyReady =
    settings?.allowSendLink === true &&
    settings?.allowMemberInvite === true &&
    settings?.whoCanSendMessages === "all" &&
    settings?.whoCanAddMembers === "all" &&
    settings?.utilityPermissions?.poll === "all" &&
    settings?.utilityPermissions?.reminder === "all" &&
    settings?.utilityPermissions?.note === "all";
  if (alreadyReady) return;

  const response = await api.patch(`/groups/${groupId}/settings`, {
    allowSendLink: true,
    requireApproval: false,
    allowMemberInvite: true,
    whoCanSendMessages: "all",
    whoCanAddMembers: "all",
    utilityPermissions: {
      poll: "all",
      reminder: "all",
      note: "all",
    },
  });
  assertStatus(response, 200, "Configure permissive demo group settings");
}

async function ensurePoll(
  groupId: string,
  owner: SeedUser,
  voters: SeedUser[],
): Promise<void> {
  const api = createApi(String(owner.token));
  const listResponse = await api.get(`/groups/${groupId}/polls?limit=100`);
  assertStatus(listResponse, 200, "List group polls");
  let poll = extractArray(listResponse).find(
    (item) => item?.question === POLL_QUESTION,
  );

  if (!poll) {
    const createResponse = await api.post(`/groups/${groupId}/polls`, {
      question: POLL_QUESTION,
      options: [
        "Realtime Socket.IO",
        "Chat nhóm và phân quyền",
        "AI Gemini",
        "Call LiveKit",
      ],
      isMultipleChoice: false,
      allowAddOption: true,
      allowChangeVote: true,
      showResultsBeforeClose: true,
      hideVoters: false,
    });
    assertStatus(createResponse, 201, "Create demo poll");
    poll = getBodyData(createResponse)?.poll || getBodyData(createResponse);
  }
  if (!poll?.id || !Array.isArray(poll.options) || poll.options.length < 2) {
    throw new Error("Cannot parse demo poll or its options");
  }

  for (const [index, voter] of voters.entries()) {
    const voteResponse = await createApi(String(voter.token)).post(
      `/groups/${groupId}/polls/${poll.id}/vote`,
      { optionIds: [poll.options[index % 2].id] },
    );
    assertStatus(voteResponse, 200, `Vote demo poll as ${voter.key}`);
    poll = getBodyData(voteResponse) || poll;
  }

  if (!poll.pinned) {
    const pinResponse = await api.post(
      `/groups/${groupId}/polls/${poll.id}/pin`,
      {},
    );
    assertStatus(pinResponse, 200, "Pin demo poll");
  }
}

async function ensureReminder(
  groupId: string,
  owner: SeedUser,
): Promise<void> {
  const api = createApi(String(owner.token));
  const listResponse = await api.get(`/groups/${groupId}/reminders`);
  assertStatus(listResponse, 200, "List group reminders");
  let reminder = extractArray(listResponse).find(
    (item) =>
      item?.title === REMINDER_TITLE && item?.status !== "cancelled",
  );
  if (!reminder) {
    const createResponse = await api.post(`/groups/${groupId}/reminders`, {
      title: REMINDER_TITLE,
      description:
        "Mở user1 và user2 trên hai trình duyệt để test chat realtime, call và AI.",
      remindAt: "2030-01-15T02:00:00.000Z",
      repeatRule: "none",
      notifyBeforeMinutes: 30,
    });
    assertStatus(createResponse, 201, "Create demo reminder");
    reminder = getBodyData(createResponse);
  }
  if (!reminder?.id) throw new Error("Cannot parse demo reminder");
  if (!reminder.pinned) {
    const pinResponse = await api.post(
      `/groups/${groupId}/reminders/${reminder.id}/pin`,
      {},
    );
    assertStatus(pinResponse, 200, "Pin demo reminder");
  }
}

async function ensureNote(
  groupId: string,
  owner: SeedUser,
): Promise<void> {
  const api = createApi(String(owner.token));
  const listResponse = await api.get(`/groups/${groupId}/notes`);
  assertStatus(listResponse, 200, "List group notes");
  if (
    extractArray(listResponse).some((note) => note?.title === NOTE_TITLE)
  ) {
    return;
  }
  const response = await api.post(`/groups/${groupId}/notes`, {
    title: NOTE_TITLE,
    content: [
      "1. Đăng nhập user1 và user2 ở hai cửa sổ.",
      "2. Kiểm tra typing, gửi tin, reaction, quote, pin và read receipt.",
      "3. Kiểm tra poll, reminder, note, link mời và quyền owner/admin/member.",
      "4. Kiểm tra media từ MinIO, call LiveKit và AI Gemini.",
    ].join("\n"),
  });
  assertStatus(response, 201, "Create demo group note");
}

async function ensureInviteLink(
  groupId: string,
  owner: SeedUser,
): Promise<void> {
  const response = await createApi(String(owner.token)).get(
    `/groups/${groupId}/invite-link`,
  );
  assertStatus(response, 200, "Create/get demo invite link");
}

async function ensureMessageRequest(
  sender: SeedUser,
  receiver: SeedUser,
): Promise<void> {
  const receiverApi = createApi(String(receiver.token));
  const listResponse = await receiverApi.get("/message-requests?limit=100");
  assertStatus(listResponse, 200, "List message requests");
  if (
    extractArray(listResponse).some(
      (request) => request?.requesterUserId === sender.id,
    )
  ) {
    console.log(
      `[SEED] Pending message request exists: ${sender.key} -> ${receiver.key}`,
    );
    return;
  }

  const response = await createApi(String(sender.token)).post(
    "/messages/private",
    {
      targetUserId: receiver.id,
      text: `${SEED_MARKER} [DEMO_MESSAGE_REQUEST] Xin chào, đây là tin nhắn từ một người lạ.`,
      clientMessageId: `seed-${SEED_VERSION.toLowerCase()}-message-request`,
    },
  );
  assertStatus(response, 201, "Create stranger message request");
  const status = getBodyData(response)?.messageRequestStatus;
  if (status !== "pending") {
    console.log(
      `[SEED] Warning: ${sender.key} -> ${receiver.key} was already accepted; use a clean database to see pending message-request state.`,
    );
  } else {
    console.log(
      `[SEED] Pending message request created: ${sender.key} -> ${receiver.key}`,
    );
  }
}

async function seedGroupUtilitiesAndPrivacy(
  conversations: SeededConversations,
): Promise<void> {
  console.log(
    "\n[SEED] Step 7/8 - Seed group utilities, stranger request and block/privacy states",
  );
  const u1 = requireUser("user1");
  const u2 = requireUser("user2");
  const u3 = requireUser("user3");
  const u6 = requireUser("user6");
  const u7 = requireUser("user7");

  await ensureGroupAdmin(u1, u2, conversations.group);
  await ensureGroupSettings(u1, conversations.group);
  await ensurePoll(conversations.group, u1, [u1, u2, u3]);
  await ensureReminder(conversations.group, u1);
  await ensureNote(conversations.group, u1);
  await ensureInviteLink(conversations.group, u1);
  await ensureMessageRequest(u7, u1);
  await ensureBlocked(u1, u6);
}

function printAccountsSummary(conversations?: SeededConversations): void {
  console.log("\n[SEED] ================= RECRUITER ACCOUNTS =================");
  console.log(`[SEED] API URL : ${API_BASE_URL}`);
  console.log("[SEED] Password: the value configured in DEMO_PASSWORD");
  for (const user of USERS) {
    console.log(
      `[SEED] ${user.key.padEnd(6)} | phone: ${user.phone} | email: ${user.email.padEnd(20)} | ${user.displayName}`,
    );
  }
  if (conversations) {
    console.log(`[SEED] Main private conversation: ${conversations.private12}`);
    console.log(`[SEED] Demo group               : ${conversations.group}`);
  }
  console.log("[SEED] ======================================================\n");
}

async function main(): Promise<void> {
  const usersOnly = process.argv.includes("--users-only");
  if (!TEST_PASSWORD) {
    throw new Error(
      "DEMO_PASSWORD is required when running the production recruiter seed.",
    );
  }

  console.log("\n============================================================");
  console.log("  CHATBE COMPREHENSIVE RECRUITER DATA SEED");
  console.log(`  Version: ${SEED_VERSION}`);
  console.log("============================================================");

  const assets = await ensureDemoAssets();
  await ensureBaseUsers(assets);

  if (usersOnly) {
    printAccountsSummary();
    console.log("[SEED] Done in users-only mode.");
    return;
  }

  try {
    await loginAllUsers();
  } catch (error) {
    throw new Error(
      `${normalizeError(error)} Start the API server first, then run this seed again.`,
    );
  }

  const conversations = await ensureSocialGraphAndConversations();
  const messages = await seedConversationMessages(conversations, assets);
  await seedMessageActions(conversations, messages, assets);
  await seedGroupUtilitiesAndPrivacy(conversations);

  console.log("\n[SEED] Step 8/8 - Verify recruiter baseline");
  printAccountsSummary(conversations);
  console.log("[SEED] DONE - Comprehensive recruiter demo data is ready.");
  console.log(
    "[SEED] Dynamic flows (typing, read receipt, LiveKit call and Gemini AI) should be tested interactively with user1 + user2.\n",
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\n[SEED] FAILED:", normalizeError(error));
    process.exit(1);
  });
}

export {
  API_BASE_URL,
  GROUP_NAME,
  POLL_QUESTION,
  REMINDER_TITLE,
  NOTE_TITLE,
  SEED_VERSION,
  USERS,
};
