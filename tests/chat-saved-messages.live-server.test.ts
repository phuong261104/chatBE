const BASE_URL = process.env.LIVE_BACKEND_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.TEST_PASSWORD || "Test123456!";
const RUN_ID = process.env.TEST_RUN_ID || Date.now().toString().slice(-9);
const liveDescribe = process.env.RUN_LIVE_SERVER_CHAT_E2E === "true" ? describe : describe.skip;

type HttpResponse<T = any> = { status: number; data: T; headers: Headers };
type Session = {
  accessToken: string;
  userId: string;
  email: string;
  phone: string;
  deviceId: string;
};

let userCounter = 0;

const idsOf = (items: Array<{ id: string }> = []) => items.map((item) => item.id);
const dataOf = (response: HttpResponse) => (response.data as any)?.data;
const selfPairKey = (userId: string) => `self_${userId}`;

function nextPhone() {
  userCounter += 1;
  const suffix = `${RUN_ID.replace(/\D/g, "").slice(-8)}${String(userCounter).padStart(2, "0")}`;
  return `+84${suffix}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function eventually(assertion: () => Promise<void> | void, timeoutMs = 12_000, intervalMs = 250) {
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
  override?: { deviceId?: string },
): Promise<HttpResponse<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": override?.deviceId || session?.deviceId || `saved-messages-live-${RUN_ID}-anon`,
      "X-Device-Type": "desktop-web",
      "X-Device-Platform": "web",
      "X-Display-Label": "Saved Messages Live Server E2E",
      "X-Device-Location": "Saved Messages Live Server E2E",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

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

async function registerUser(label: string): Promise<Session> {
  const email = `saved-messages-live-${RUN_ID}-${label}@chatbe.io`;
  const phone = nextPhone();
  const deviceId = `saved-messages-live-${RUN_ID}-${label}`;
  const response = await request(
    "POST",
    "/v1/auth/register",
    {
      email,
      phone,
      password: PASSWORD,
      displayName: `Saved Messages ${label}`,
      sendVerificationEmail: false,
    },
    undefined,
    { deviceId },
  );

  expect([200, 201]).toContain(response.status);
  const payload = dataOf(response);
  if (payload?.accessToken) {
    return { accessToken: payload.accessToken, userId: payload.user.id, email, phone, deviceId };
  }

  const login = await request(
    "POST",
    "/v1/auth/login",
    { email, phone, password: PASSWORD },
    undefined,
    { deviceId },
  );
  expect(login.status).toBe(200);
  const loginPayload = dataOf(login);
  expect(loginPayload?.accessToken).toBeTruthy();
  return { accessToken: loginPayload.accessToken, userId: loginPayload.user.id, email, phone, deviceId };
}

async function sendPrivateMessage(
  owner: Session,
  target: Session,
  text: string,
  media?: any[],
) {
  const response = await request(
    "POST",
    "/v1/messages/private",
    { targetUserId: target.userId, text, ...(media ? { media } : {}) },
    owner,
  );
  expect(response.status).toBe(201);
  const payload = dataOf(response);
  expect(payload.conversation?.id).toBeTruthy();
  expect(payload.messages?.length).toBeGreaterThan(0);
  return payload as { conversation: any; messages: any[] };
}

liveDescribe("Saved Messages against a real running server", () => {
  jest.setTimeout(90_000);

  it("returns saved_messages type and sorts Saved Messages by normal activity", async () => {
    const owner = await registerUser("owner");
    const firstTarget = await registerUser("first");
    const secondTarget = await registerUser("second");
    const sourceTarget = await registerUser("source");

    const initialList = await request("GET", "/v1/conversations?page=1&limit=10", undefined, owner);
    expect(initialList.status).toBe(200);
    const savedMessages = dataOf(initialList).find((conversation: any) => conversation.isSavedMessages);
    expect(savedMessages).toEqual(
      expect.objectContaining({
        pairKey: selfPairKey(owner.userId),
        name: "Saved Messages",
        type: "saved_messages",
        isSelfChat: true,
        isSavedMessages: true,
      }),
    );

    const firstChat = await sendPrivateMessage(owner, firstTarget, `first normal ${RUN_ID}`);
    await sleep(150);
    const secondChat = await sendPrivateMessage(owner, secondTarget, `second normal ${RUN_ID}`);

    await eventually(async () => {
      const response = await request("GET", "/v1/conversations?page=1&limit=10", undefined, owner);
      expect(response.status).toBe(200);
      expect(idsOf(dataOf(response)).slice(0, 3)).toEqual([
        secondChat.conversation.id,
        firstChat.conversation.id,
        savedMessages.id,
      ]);
    });

    const detail = await request("GET", `/v1/conversations/${savedMessages.id}`, undefined, owner);
    expect(detail.status).toBe(200);
    expect(dataOf(detail).conversation).toEqual(
      expect.objectContaining({
        id: savedMessages.id,
        type: "saved_messages",
        isSavedMessages: true,
      }),
    );

    const selfMessage = await request(
      "POST",
      "/v1/messages/private",
      { targetUserId: owner.userId, text: `self note ${RUN_ID}` },
      owner,
    );
    expect(selfMessage.status).toBe(201);
    expect(dataOf(selfMessage).conversation).toEqual(
      expect.objectContaining({
        id: savedMessages.id,
        type: "saved_messages",
        isSavedMessages: true,
      }),
    );

    const source = await sendPrivateMessage(owner, sourceTarget, `source needle ${RUN_ID}`);
    const save = await request(
      "POST",
      "/v1/saved-messages/messages",
      { messageIds: idsOf(source.messages) },
      owner,
    );
    expect(save.status).toBe(201);
    expect(dataOf(save).conversation).toEqual(
      expect.objectContaining({
        id: savedMessages.id,
        name: "Saved Messages",
        type: "saved_messages",
        isSelfChat: true,
        isSavedMessages: true,
      }),
    );

    await eventually(async () => {
      const cursor = await request("GET", "/v1/conversations/cursor?limit=10", undefined, owner);
      expect(cursor.status).toBe(200);
      expect((cursor.data as any).data[0]).toEqual(
        expect.objectContaining({
          id: savedMessages.id,
          type: "saved_messages",
          isSavedMessages: true,
        }),
      );
    });
  });

  it("keeps delete-for-me cutoff after private chat and Saved Messages are recreated", async () => {
    const owner = await registerUser("delete-owner");
    const target = await registerUser("delete-target");
    const savedSource = await registerUser("delete-source");

    const oldPrivate = await sendPrivateMessage(
      owner,
      target,
      `old private cutoff ${RUN_ID}`,
      [
        {
          url: `https://cdn.test/live-delete-old-private-${RUN_ID}.pdf`,
          filename: `live-delete-old-private-${RUN_ID}.pdf`,
          mimetype: "application/pdf",
          size: 100,
        },
      ],
    );

    const deletePrivate = await request(
      "DELETE",
      `/v1/conversations/${oldPrivate.conversation.id}`,
      undefined,
      owner,
    );
    expect(deletePrivate.status).toBe(200);
    expect(dataOf(deletePrivate)).toEqual(
      expect.objectContaining({
        conversationId: oldPrivate.conversation.id,
        deletedAt: expect.any(String),
      }),
    );

    await eventually(async () => {
      const list = await request("GET", "/v1/conversations?page=1&limit=20", undefined, owner);
      expect(list.status).toBe(200);
      expect(idsOf(dataOf(list))).not.toContain(oldPrivate.conversation.id);
    });

    await sleep(150);
    const newPrivate = await sendPrivateMessage(
      target,
      owner,
      `new private cutoff ${RUN_ID}`,
      [
        {
          url: `https://cdn.test/live-delete-new-private-${RUN_ID}.pdf`,
          filename: `live-delete-new-private-${RUN_ID}.pdf`,
          mimetype: "application/pdf",
          size: 101,
        },
      ],
    );
    expect(newPrivate.conversation.id).toBe(oldPrivate.conversation.id);

    await eventually(async () => {
      const list = await request("GET", "/v1/conversations?page=1&limit=20", undefined, owner);
      expect(list.status).toBe(200);
      expect(idsOf(dataOf(list))).toContain(oldPrivate.conversation.id);

      const loaded = await request(
        "GET",
        `/v1/conversations/${oldPrivate.conversation.id}/messages`,
        undefined,
        owner,
      );
      expect(loaded.status).toBe(200);
      const loadedIds = idsOf(dataOf(loaded).messages);
      expect(loadedIds).not.toEqual(expect.arrayContaining(idsOf(oldPrivate.messages)));
      expect(loadedIds).toEqual(expect.arrayContaining(idsOf(newPrivate.messages)));

      const search = await request(
        "GET",
        `/v1/conversations/${oldPrivate.conversation.id}/search?query=cutoff`,
        undefined,
        owner,
      );
      expect(search.status).toBe(200);
      const searchIds = idsOf(dataOf(search).messages);
      expect(searchIds).not.toEqual(expect.arrayContaining(idsOf(oldPrivate.messages)));
      expect(searchIds).toEqual(expect.arrayContaining(idsOf(newPrivate.messages)));

      const files = await request(
        "GET",
        `/v1/conversations/${oldPrivate.conversation.id}/media?type=file`,
        undefined,
        owner,
      );
      expect(files.status).toBe(200);
      const fileUrls = dataOf(files).files.map((file: any) => file.url);
      expect(fileUrls).not.toContain(`https://cdn.test/live-delete-old-private-${RUN_ID}.pdf`);
      expect(fileUrls).toContain(`https://cdn.test/live-delete-new-private-${RUN_ID}.pdf`);
    });

    const initialList = await request("GET", "/v1/conversations?page=1&limit=20", undefined, owner);
    expect(initialList.status).toBe(200);
    const savedMessages = dataOf(initialList).find((conversation: any) => conversation.isSavedMessages);
    expect(savedMessages).toEqual(
      expect.objectContaining({
        name: "Saved Messages",
        type: "saved_messages",
        isSavedMessages: true,
      }),
    );

    const oldSource = await sendPrivateMessage(
      owner,
      savedSource,
      `old saved cutoff ${RUN_ID}`,
      [
        {
          url: `https://cdn.test/live-delete-old-saved-${RUN_ID}.pdf`,
          filename: `live-delete-old-saved-${RUN_ID}.pdf`,
          mimetype: "application/pdf",
          size: 200,
        },
      ],
    );
    const oldSave = await request(
      "POST",
      "/v1/saved-messages/messages",
      { messageIds: idsOf(oldSource.messages) },
      owner,
    );
    expect(oldSave.status).toBe(201);
    const oldSavedMessageIds = idsOf(dataOf(oldSave).messages);
    expect(dataOf(oldSave).conversation).toEqual(
      expect.objectContaining({
        id: savedMessages.id,
        type: "saved_messages",
        isSavedMessages: true,
      }),
    );

    const deleteSaved = await request(
      "DELETE",
      `/v1/conversations/${savedMessages.id}`,
      undefined,
      owner,
    );
    expect(deleteSaved.status).toBe(200);
    expect(dataOf(deleteSaved)).toEqual(
      expect.objectContaining({
        conversationId: savedMessages.id,
        deletedAt: expect.any(String),
      }),
    );

    await eventually(async () => {
      const list = await request("GET", "/v1/conversations?page=1&limit=20", undefined, owner);
      expect(list.status).toBe(200);
      expect(idsOf(dataOf(list))).not.toContain(savedMessages.id);
    });

    await sleep(150);
    const newSource = await sendPrivateMessage(
      owner,
      savedSource,
      `new saved cutoff ${RUN_ID}`,
      [
        {
          url: `https://cdn.test/live-delete-new-saved-${RUN_ID}.pdf`,
          filename: `live-delete-new-saved-${RUN_ID}.pdf`,
          mimetype: "application/pdf",
          size: 201,
        },
      ],
    );
    const newSave = await request(
      "POST",
      "/v1/saved-messages/messages",
      { messageIds: idsOf(newSource.messages) },
      owner,
    );
    expect(newSave.status).toBe(201);
    const newSavedMessageIds = idsOf(dataOf(newSave).messages);
    expect(dataOf(newSave).conversation).toEqual(
      expect.objectContaining({
        id: savedMessages.id,
        name: "Saved Messages",
        type: "saved_messages",
        isSelfChat: true,
        isSavedMessages: true,
      }),
    );

    await eventually(async () => {
      const list = await request("GET", "/v1/conversations?page=1&limit=20", undefined, owner);
      expect(list.status).toBe(200);
      expect(idsOf(dataOf(list))).toContain(savedMessages.id);

      const loaded = await request(
        "GET",
        `/v1/conversations/${savedMessages.id}/messages`,
        undefined,
        owner,
      );
      expect(loaded.status).toBe(200);
      const loadedIds = idsOf(dataOf(loaded).messages);
      expect(loadedIds).not.toEqual(expect.arrayContaining(oldSavedMessageIds));
      expect(loadedIds).toEqual(expect.arrayContaining(newSavedMessageIds));

      const search = await request(
        "GET",
        `/v1/conversations/${savedMessages.id}/search?query=cutoff`,
        undefined,
        owner,
      );
      expect(search.status).toBe(200);
      const searchIds = idsOf(dataOf(search).messages);
      expect(searchIds).not.toEqual(expect.arrayContaining(oldSavedMessageIds));
      expect(searchIds).toEqual(expect.arrayContaining(newSavedMessageIds));

      const files = await request(
        "GET",
        `/v1/conversations/${savedMessages.id}/media?type=file`,
        undefined,
        owner,
      );
      expect(files.status).toBe(200);
      const fileUrls = dataOf(files).files.map((file: any) => file.url);
      expect(fileUrls).not.toContain(`https://cdn.test/live-delete-old-saved-${RUN_ID}.pdf`);
      expect(fileUrls).toContain(`https://cdn.test/live-delete-new-saved-${RUN_ID}.pdf`);
    });
  });
});
