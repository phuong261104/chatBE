import {
  callV2Service,
  CallV2ParticipantStatus,
  CallV2SessionStatus,
} from "@modules/call/usecase";
import { CallType, LivekitProvider } from "@modules/call/interface";
import { setupCallHexagon } from "@modules/call";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

describe("CallV2Service", () => {
  beforeEach(() => {
    callV2Service.resetForTests();
  });

  afterEach(() => {
    callV2Service.resetForTests();
    jest.useRealTimers();
  });

  it("creates group calls for invite-all participants", () => {
    const result = callV2Service.createCall({
      callerId: "u1",
      conversationId: "group-1",
      type: CallType.VIDEO,
      calleeIds: ["u2", "u3"],
      isGroup: true,
      livekitProvider: LivekitProvider.CLOUD,
    });

    expect(result.invitedUserIds).toEqual(["u2", "u3"]);
    expect(result.busyUserIds).toEqual([]);
    expect(result.session.participants.u1.status).toBe(CallV2ParticipantStatus.JOINED);
    expect(result.session.participants.u2.status).toBe(CallV2ParticipantStatus.RINGING);
    expect(result.session.participants.u3.status).toBe(CallV2ParticipantStatus.RINGING);
  });

  it("creates group calls for selected invitees only", () => {
    const result = callV2Service.createCall({
      callerId: "u1",
      conversationId: "group-2",
      type: CallType.AUDIO,
      calleeIds: ["u3"],
      isGroup: true,
      livekitProvider: LivekitProvider.CLOUD,
    });

    expect(Object.keys(result.session.participants).sort()).toEqual(["u1", "u3"]);
    expect(result.session.participants.u3.status).toBe(CallV2ParticipantStatus.RINGING);
  });

  it("allows active group members to join late", () => {
    const { session } = callV2Service.createCall({
      callerId: "u1",
      conversationId: "group-3",
      type: CallType.VIDEO,
      calleeIds: ["u2"],
      isGroup: true,
      livekitProvider: LivekitProvider.CLOUD,
    });

    const joined = callV2Service.joinCall(session.callId, "u3");

    expect(joined.status).toBe(CallV2SessionStatus.IN_CALL);
    expect(joined.participants.u3.status).toBe(CallV2ParticipantStatus.JOINED);
  });

  it("terminates private calls when the callee rejects", () => {
    const { session } = callV2Service.createCall({
      callerId: "u1",
      conversationId: "private-1",
      type: CallType.AUDIO,
      calleeIds: ["u2"],
      isGroup: false,
      livekitProvider: LivekitProvider.CLOUD,
    });

    const result = callV2Service.rejectCall(session.callId, "u2");

    expect(result.terminal).toBe(true);
    expect(result.session.status).toBe(CallV2SessionStatus.REJECTED);
    expect(result.session.participants.u2.status).toBe(CallV2ParticipantStatus.DECLINED);
  });

  it("times out unanswered group calls as missed when nobody joins", async () => {
    jest.useFakeTimers();
    const timeoutHandler = jest.fn();
    callV2Service.setTimeoutHandler(timeoutHandler);

    const { session } = callV2Service.createCall({
      callerId: "u1",
      conversationId: "group-timeout",
      type: CallType.AUDIO,
      calleeIds: ["u2", "u3"],
      isGroup: true,
      livekitProvider: LivekitProvider.CLOUD,
    });

    jest.advanceTimersByTime(60_000);
    await Promise.resolve();

    expect(session.status).toBe(CallV2SessionStatus.MISSED);
    expect(session.participants.u2.status).toBe(CallV2ParticipantStatus.MISSED);
    expect(session.participants.u3.status).toBe(CallV2ParticipantStatus.MISSED);
    expect(timeoutHandler).toHaveBeenCalledWith(session, ["u2", "u3"], true);
  });

  it("marks busy users while continuing group calls for available invitees", () => {
    callV2Service.createCall({
      callerId: "u1",
      conversationId: "private-busy-source",
      type: CallType.AUDIO,
      calleeIds: ["u2"],
      isGroup: false,
      livekitProvider: LivekitProvider.CLOUD,
    });

    const group = callV2Service.createCall({
      callerId: "u3",
      conversationId: "group-busy",
      type: CallType.VIDEO,
      calleeIds: ["u2", "u4"],
      isGroup: true,
      livekitProvider: LivekitProvider.CLOUD,
    });

    expect(group.busyUserIds).toEqual(["u2"]);
    expect(group.invitedUserIds).toEqual(["u4"]);
    expect(group.session.participants.u2.status).toBe(CallV2ParticipantStatus.BUSY);
    expect(group.session.participants.u4.status).toBe(CallV2ParticipantStatus.RINGING);
  });

  it("ends private calls as missed when the callee is busy", () => {
    callV2Service.createCall({
      callerId: "u1",
      conversationId: "private-busy-source-2",
      type: CallType.AUDIO,
      calleeIds: ["u2"],
      isGroup: false,
      livekitProvider: LivekitProvider.CLOUD,
    });

    const busy = callV2Service.createCall({
      callerId: "u3",
      conversationId: "private-busy-target",
      type: CallType.AUDIO,
      calleeIds: ["u2"],
      isGroup: false,
      livekitProvider: LivekitProvider.CLOUD,
    });

    expect(busy.session.status).toBe(CallV2SessionStatus.MISSED);
    expect(busy.busyUserIds).toEqual(["u2"]);
    expect(busy.session.participants.u2.status).toBe(CallV2ParticipantStatus.BUSY);
  });

  it("preserves participant outcomes for terminal call logs", () => {
    const { session } = callV2Service.createCall({
      callerId: "u1",
      conversationId: "group-log",
      type: CallType.VIDEO,
      calleeIds: ["u2"],
      isGroup: true,
      livekitProvider: LivekitProvider.CLOUD,
    });
    callV2Service.joinCall(session.callId, "u2");

    const ended = callV2Service.endCall(session.callId, "u1");
    const legacy = callV2Service.toLegacySession(ended);

    expect(ended.status).toBe(CallV2SessionStatus.ENDED);
    expect(legacy.participantOutcomes?.u1.status).toBe(CallV2ParticipantStatus.LEFT);
    expect(legacy.participantOutcomes?.u2.status).toBe(CallV2ParticipantStatus.LEFT);
  });
});

describe("call socket namespace", () => {
  it("mounts the canonical /v1/calls namespace without legacy /socket/calls", () => {
    const httpServer = createServer();
    const io = new SocketIOServer(httpServer);

    try {
      setupCallHexagon(io, {
        mdlFactory: {
          auth: (_req: unknown, _res: unknown, next: () => void) => next(),
        },
      } as any);

      const namespaces = (io as any)._nsps as Map<string, unknown>;
      expect(namespaces.has("/v1/calls")).toBe(true);
      expect(namespaces.has("/socket/calls")).toBe(false);
    } finally {
      io.close();
      httpServer.close();
    }
  });
});
