export {};

const BASE_URL = process.env.LIVE_BACKEND_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.TEST_PASSWORD || "Test123456!";
const RUN_ID = process.env.TEST_RUN_ID || Date.now().toString().slice(-9);
const liveDescribe = process.env.RUN_LIVE_SERVER_AUTH_E2E === "true" ? describe : describe.skip;

type Platform = "web" | "app";
type HttpResponse<T = any> = { status: number; data: T; headers: Headers };

let userCounter = 0;

const dataOf = (response: HttpResponse) => (response.data as any)?.data;

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
    "X-Device-Location": "Live Auth E2E",
    "User-Agent": platform === "app" ? "ChatBE-E2E-App/1.0" : "ChatBE-E2E-Web/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T = any>(
  method: string,
  path: string,
  body?: unknown,
  override: {
    deviceId?: string;
    platform?: Platform;
    displayLabel?: string;
    accessToken?: string;
  } = {},
): Promise<HttpResponse<T>> {
  const deviceId = override.deviceId || `auth-unverified-live-${RUN_ID}-anon`;
  const platform = override.platform || "web";
  const displayLabel = override.displayLabel || "Auth Unverified Email Live E2E";

  let response: Response | null = null;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: deviceHeaders(deviceId, platform, displayLabel, override.accessToken),
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

async function registerUnverifiedEmailUser(label: string) {
  const email = `auth-unverified-live-${RUN_ID}-${label}@chatbe.io`;
  const phone = nextPhone();
  const deviceId = `auth-unverified-live-${RUN_ID}-${label}-web`;

  const response = await request(
    "POST",
    "/v1/auth/register",
    {
      email,
      phone,
      password: PASSWORD,
      displayName: `Auth Unverified ${label}`,
      sendVerificationEmail: true,
    },
    { deviceId, displayLabel: `${label} web` },
  );

  expect([200, 201]).toContain(response.status);
  expect(dataOf(response)).toEqual(
    expect.objectContaining({
      pendingVerification: true,
      email,
    }),
  );

  return { email, phone };
}

liveDescribe("auth unverified-email live-server E2E against a running backend", () => {
  jest.setTimeout(45_000);

  it("returns unverified email by phone through the real backend without auth", async () => {
    const user = await registerUnverifiedEmailUser("lookup");

    const lookup = await request(
      "GET",
      `/v1/auth/unverified-email?phone=${encodeURIComponent(user.phone)}`,
    );
    expect(lookup.status).toBe(200);
    expect(dataOf(lookup)).toEqual({ email: user.email });

    const unknownPhone = `+849${RUN_ID.replace(/\D/g, "").padEnd(9, "9").slice(0, 9)}`;
    const unknownLookup = await request(
      "GET",
      `/v1/auth/unverified-email?phone=${encodeURIComponent(unknownPhone)}`,
    );
    expect(unknownLookup.status).toBe(404);

    const invalidLookup = await request("GET", "/v1/auth/unverified-email");
    expect(invalidLookup.status).toBe(422);
  });
});
