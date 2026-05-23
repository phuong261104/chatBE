import { SocketRateLimiter } from "@modules/chat/infras/transport/socket/rate-limiter";

describe("SocketRateLimiter", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("allows requests until the configured event limit is reached", () => {
    const limiter = new SocketRateLimiter();

    for (let i = 0; i < 60; i++) {
      expect(limiter.check("user-id", "sendMessage")).toBe(true);
    }
    expect(limiter.check("user-id", "sendMessage")).toBe(false);
  });

  it("uses independent counters per user and event type", () => {
    const limiter = new SocketRateLimiter();

    for (let i = 0; i < 30; i++) {
      expect(limiter.check("user-id", "typing")).toBe(true);
    }
    expect(limiter.check("user-id", "typing")).toBe(false);
    expect(limiter.check("user-id", "sendMessage")).toBe(true);
    expect(limiter.check("other-user", "typing")).toBe(true);
  });

  it("resets counters after the one minute window", () => {
    const limiter = new SocketRateLimiter();

    for (let i = 0; i < 30; i++) {
      expect(limiter.check("user-id", "unknownEvent")).toBe(true);
    }
    expect(limiter.check("user-id", "unknownEvent")).toBe(false);

    jest.advanceTimersByTime(60_001);
    expect(limiter.check("user-id", "unknownEvent")).toBe(true);
  });
});
