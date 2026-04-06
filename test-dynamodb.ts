import axios from "axios";

const BASE_URL = "http://localhost:3000/v1";

let accessToken = "";
let testUserId = "";
let testUserId2 = "";
let testPhone = "0987654321";
let testPhone2 = "0987654322";
let testEmail = "testdynamo@example.com";
let testEmail2 = "testdynamo2@example.com";
let testPassword = "Test123456!";
let testUsername = "testdynamo";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testAuth(): Promise<void> {
  console.log("\n=== Testing Auth APIs ===");

  try {
    const registerRes = await api.post("/auth/register", {
      phone: testPhone,
      email: testEmail,
      password: testPassword,
      username: testUsername,
      displayName: "Test DynamoDB User",
    });
    console.log("[PASS] Register:", registerRes.data?.data?.user?.email || "OK");
    testUserId = registerRes.data?.data?.user?.id || registerRes.data?.data?.id || "";
  } catch (err: any) {
    const msg = err.response?.data?.msg || err.response?.data?.message || "";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
      console.log("[INFO] User already exists, trying to login");
    } else {
      console.log("[FAIL] Register:", JSON.stringify(err.response?.data) || err.message || err.toString());
    }
  }

  try {
    const registerRes2 = await api.post("/auth/register", {
      phone: testPhone2,
      email: testEmail2,
      password: testPassword,
      username: "testdynamo2",
      displayName: "Test DynamoDB User 2",
    });
    testUserId2 = registerRes2.data?.data?.user?.id || registerRes2.data?.data?.id || "";
    console.log("[PASS] Register User 2:", testUserId2 ? "OK" : "missing");
  } catch (err: any) {
    const msg = err.response?.data?.msg || err.response?.data?.message || "";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
      console.log("[INFO] User 2 already exists, trying to login");
      try {
        const loginRes2 = await api.post("/auth/login", {
          email: testEmail2,
          password: testPassword,
        });
        testUserId2 = loginRes2.data?.data?.user?.id || loginRes2.data?.data?.id || "";
        console.log("[PASS] Login User 2:", testUserId2 ? "OK" : "missing");
      } catch (loginErr: any) {
        console.log("[FAIL] Login User 2:", JSON.stringify(loginErr.response?.data) || loginErr.message);
      }
    } else {
      console.log("[FAIL] Register User 2:", JSON.stringify(err.response?.data) || err.message || err.toString());
    }
  }

  try {
    const loginRes = await api.post("/auth/login", {
      email: testEmail,
      password: testPassword,
    });
    accessToken = loginRes.data?.data?.accessToken;
    if (!testUserId) {
      testUserId = loginRes.data?.data?.user?.id || loginRes.data?.data?.id || testUserId;
    }
    console.log("[PASS] Login:", accessToken ? "OK" : "missing token");
  } catch (err: any) {
    console.log("[FAIL] Login:", JSON.stringify(err.response?.data) || err.message || err.toString());
  }

  if (!testUserId2) {
    try {
      const loginRes2 = await api.post("/auth/login", {
        email: testEmail2,
        password: testPassword,
      });
      testUserId2 = loginRes2.data?.data?.user?.id || loginRes2.data?.data?.id || "";
      console.log("[PASS] Login User 2:", testUserId2 ? "OK" : "missing");
    } catch (loginErr2: any) {
      console.log("[FAIL] Login User 2:", JSON.stringify(loginErr2.response?.data) || loginErr2.message);
    }
  }
}

async function testUser(): Promise<void> {
  console.log("\n=== Testing User APIs ===");

  if (!accessToken) {
    console.log("[SKIP] No access token, skipping user tests");
    return;
  }

  api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

  try {
    const res = await api.get("/profile");
    console.log("[PASS] Get Profile:", res.data?.data ? "OK" : "missing data");
  } catch (err: any) {
    console.log("[FAIL] Get Profile:", err.response?.data || err.message);
  }

  try {
    const res = await api.patch("/profile", {
      displayName: "Updated DynamoDB Name",
    });
    console.log("[PASS] Update Profile:", res.data?.data ? "OK" : "missing data");
  } catch (err: any) {
    console.log("[FAIL] Update Profile:", err.response?.data || err.message);
  }

  try {
    const res = await api.get("/users");
    console.log("[PASS] List Users:", res.data?.data?.length !== undefined ? `${res.data.data.length} users` : "OK");
  } catch (err: any) {
    console.log("[FAIL] List Users:", err.response?.data || err.message);
  }

  if (testUserId) {
    try {
      const res = await api.get(`/users/${testUserId}`);
      console.log("[PASS] Get User Detail:", res.data?.data ? "OK" : "missing data");
    } catch (err: any) {
      console.log("[FAIL] Get User Detail:", err.response?.data || err.message);
    }
  }
}

async function testMessaging(): Promise<void> {
  console.log("\n=== Testing Messaging APIs ===");

  if (!accessToken) {
    console.log("[SKIP] No access token, skipping messaging tests");
    return;
  }

  try {
    const res = await api.post("/conversations/private", {
      targetUserId: testUserId2,
    });
    console.log("[PASS] Get/Create Private Conversation:", res.data?.data ? "OK" : "missing data");
  } catch (err: any) {
    const resp = err.response?.data;
    console.log("[FAIL] Get/Create Private Conversation:", `participantId=${testUserId2}, data=${JSON.stringify(resp)}`);
  }

  try {
    const res = await api.get("/conversations");
    console.log("[PASS] List Conversations:", res.data?.data?.length !== undefined ? `${res.data.data.length} conversations` : "OK");
  } catch (err: any) {
    console.log("[FAIL] List Conversations:", err.response?.data || err.message);
  }

  try {
    const res = await api.get("/conversations/unread-count");
    console.log("[PASS] Get Unread Count:", res.data?.data?.count !== undefined ? res.data.data.count : "OK");
  } catch (err: any) {
    console.log("[FAIL] Get Unread Count:", err.response?.data || err.message);
  }

  try {
    const res = await api.post("/groups", {
      name: "Test DynamoDB Group",
      memberIds: [testUserId2, testUserId],
    });
    console.log("[PASS] Create Group:", res.data?.data ? "OK" : "missing data");
  } catch (err: any) {
    console.log("[FAIL] Create Group:", err.response?.data || err.message);
  }
}

async function testFriendRequest(): Promise<void> {
  console.log("\n=== Testing Friend Request APIs ===");

  if (!accessToken || !testUserId2) {
    console.log("[SKIP] No access token or user2, skipping friend request tests");
    return;
  }

  try {
    const res = await api.post(`/friend-requests/${testUserId2}`);
    console.log("[PASS] Send Friend Request:", res.data?.data ? "OK" : "missing data");
  } catch (err: any) {
    console.log("[FAIL] Send Friend Request:", err.response?.data || err.message);
  }

  try {
    const res = await api.get("/friend-requests/received");
    console.log("[PASS] Get Received Requests:", res.data?.data?.length !== undefined ? `${res.data.data.length} requests` : "OK");
  } catch (err: any) {
    console.log("[FAIL] Get Received Requests:", err.response?.data || err.message);
  }

  try {
    const res = await api.get("/friend-requests/sent");
    console.log("[PASS] Get Sent Requests:", res.data?.data?.length !== undefined ? `${res.data.data.length} requests` : "OK");
  } catch (err: any) {
    console.log("[FAIL] Get Sent Requests:", err.response?.data || err.message);
  }
}

async function testFriendship(): Promise<void> {
  console.log("\n=== Testing Friendship APIs ===");

  if (!accessToken) {
    console.log("[SKIP] No access token, skipping friendship tests");
    return;
  }

  try {
    const res = await api.get("/friendships");
    console.log("[PASS] Get Friends List:", res.data?.data?.length !== undefined ? `${res.data.data.length} friends` : "OK");
  } catch (err: any) {
    console.log("[FAIL] Get Friends List:", err.response?.data || err.message);
  }
}

async function testBlock(): Promise<void> {
  console.log("\n=== Testing Block APIs ===");

  if (!accessToken) {
    console.log("[SKIP] No access token, skipping block tests");
    return;
  }

  try {
    const res = await api.get("/blocks");
    console.log("[PASS] Get Blocked Users:", res.data?.data?.length !== undefined ? `${res.data.data.length} blocked` : "OK");
  } catch (err: any) {
    console.log("[FAIL] Get Blocked Users:", err.response?.data || err.message);
  }
}

async function testPost(): Promise<void> {
  console.log("\n=== Testing Post APIs ===");

  if (!accessToken) {
    console.log("[SKIP] No access token, skipping post tests");
    return;
  }

  try {
    const res = await api.post("/posts", {
      content: "Test post from DynamoDB",
    });
    console.log("[PASS] Create Post:", res.data?.data ? "OK" : "missing data");
  } catch (err: any) {
    console.log("[FAIL] Create Post:", err.response?.data || err.message);
  }

  try {
    const res = await api.get("/posts");
    console.log("[PASS] Get Feed:", res.data?.data?.length !== undefined ? `${res.data.data.length} posts` : "OK");
  } catch (err: any) {
    console.log("[FAIL] Get Feed:", err.response?.data || err.message);
  }
}

async function testStory(): Promise<void> {
  console.log("\n=== Testing Story APIs ===");

  if (!accessToken) {
    console.log("[SKIP] No access token, skipping story tests");
    return;
  }

  try {
    const res = await api.get("/stories");
    console.log("[PASS] Get Stories:", res.data?.data?.length !== undefined ? `${res.data.data.length} stories` : "OK");
  } catch (err: any) {
    console.log("[FAIL] Get Stories:", err.response?.data || err.message);
  }
}

async function testMyCloud(): Promise<void> {
  console.log("\n=== Testing My Cloud APIs ===");

  if (!accessToken) {
    console.log("[SKIP] No access token, skipping my-cloud tests");
    return;
  }

  try {
    const res = await api.get("/my-cloud");
    console.log("[PASS] Get Cloud Items:", res.data?.data?.length !== undefined ? `${res.data.data.length} items` : "OK");
  } catch (err: any) {
    console.log("[FAIL] Get Cloud Items:", err.response?.data || err.message);
  }
}

async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("  DynamoDB Integration Test Suite");
  console.log("  DB_TYPE: dynamodb");
  console.log("=".repeat(50));

  await sleep(1000);

  await testAuth();
  await testUser();
  await testMessaging();
  await testFriendRequest();
  await testFriendship();
  await testBlock();
  await testPost();
  await testStory();
  await testMyCloud();

  console.log("\n" + "=".repeat(50));
  console.log("  Test Complete!");
  console.log("=".repeat(50) + "\n");
}

main().catch(console.error);
