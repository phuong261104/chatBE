# Frontend Call Integration Guide V2

Updated: 2026-05-15

This guide is source-verified against:

- `src/modules/call/infras/transport/http/call-v2.routes.ts`
- `src/modules/call/infras/transport/http/call-v2.controller.ts`
- `src/modules/call/infras/transport/call-v2-socket.service.ts`
- `src/modules/call/usecase/call-v2.service.ts`

Use this guide for the new LiveKit cloud call implementation. The legacy V1 call API and socket namespace still exist, but new frontend work should use V2.

## 1. Correct V2 Surface

| Area | Use | Do not use for V2 |
|---|---|---|
| REST prefix | `/v2/calls/*` | `/calls/v2/*` |
| Socket namespace | `/v2/calls` | `/socket/calls` |
| Accept/join action | `POST /v2/calls/{callId}/join` | `POST /calls/v2/{callId}/answer` |
| Joined event | `call:joined` | `call:answered` |
| Declined event | `call:declined` | `call:rejected` |

V2 session statuses:

```ts
type CallV2SessionStatus =
  | "ringing"
  | "in-call"
  | "ended"
  | "missed"
  | "rejected"
  | "cancelled";
```

V2 participant statuses:

```ts
type CallV2ParticipantStatus =
  | "invited"
  | "ringing"
  | "joined"
  | "declined"
  | "missed"
  | "left"
  | "busy";
```

## 2. REST Endpoints

All endpoints require `Authorization: Bearer <accessToken>`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v2/calls` | Create private/group call |
| `GET` | `/v2/calls/conversations/{conversationId}/active` | Get active call by conversation |
| `GET` | `/v2/calls/active-by-conversation/{conversationId}` | Alias for active call |
| `POST` | `/v2/calls/{callId}/join` | Join call and get LiveKit token |
| `POST` | `/v2/calls/{callId}/leave` | Leave call |
| `POST` | `/v2/calls/{callId}/reject` | Reject/decline call |
| `POST` | `/v2/calls/{callId}/missed` | Mark call missed |
| `POST` | `/v2/calls/{callId}/end` | End call |
| `DELETE` | `/v2/calls/{callId}` | End call alias |
| `GET` | `/v2/calls/{callId}/token` | Get token for an existing participant |

### Create Call

```http
POST /v2/calls
Content-Type: application/json
Authorization: Bearer <token>

{
  "conversationId": "conversation-id",
  "type": "audio",
  "inviteAll": true,
  "inviteeIds": ["user-id-1", "user-id-2"]
}
```

Rules:

- `type` is `"audio"` or `"video"`.
- Private calls do not need `inviteeIds`; backend resolves the other active private member.
- Group calls can use `inviteAll: true` or a selected `inviteeIds` list.
- If a private callee is busy, backend returns `409`.
- If some group invitees are busy, backend still creates the call for available invitees and returns `busyUserIds`.

Success response:

```json
{
  "data": {
    "call": {
      "callId": "call-id",
      "callerId": "caller-id",
      "conversationId": "conversation-id",
      "type": "audio",
      "isGroup": true,
      "livekitProvider": "cloud",
      "roomName": "call-v2-conversation-id-xxxxxxxx",
      "status": "ringing",
      "createdAt": 1710000000000,
      "calleeIds": ["user-id-1"],
      "participants": {
        "caller-id": { "userId": "caller-id", "status": "joined", "joinedAt": 1710000000000 },
        "user-id-1": { "userId": "user-id-1", "status": "ringing", "invitedAt": 1710000000000 }
      },
      "busyUserIds": []
    },
    "invitedUserIds": ["user-id-1"],
    "busyUserIds": []
  }
}
```

### Join Call And Connect LiveKit

```http
POST /v2/calls/{callId}/join
Authorization: Bearer <token>
```

```json
{
  "data": {
    "call": {
      "callId": "call-id",
      "status": "in-call"
    },
    "token": "livekit-jwt",
    "wsUrl": "wss://...",
    "roomName": "call-v2-...",
    "livekitProvider": "cloud"
  }
}
```

Frontend uses `token`, `wsUrl`, and `roomName` to connect with `livekit-client`.

### Leave / Reject / Missed / End

```http
POST /v2/calls/{callId}/leave
POST /v2/calls/{callId}/reject
POST /v2/calls/{callId}/missed
POST /v2/calls/{callId}/end
DELETE /v2/calls/{callId}
```

Terminal responses may include `callMessage`. When present, refresh the conversation last message or append the returned call log message.

## 3. Socket.IO V2

Connect once after login:

```ts
import { io } from "socket.io-client";

const callSocket = io(`${BASE_URL}/v2/calls`, {
  auth: { token: accessToken, deviceId },
  transports: ["websocket", "polling"],
  path: "/socket.io",
});
```

Client -> server events:

| Event | Payload | Meaning |
|---|---|---|
| `call:join` | `{ "callId": "call-id" }` | Join socket room `call:{callId}` only |
| `call:leave` | `{ "callId": "call-id" }` | Leave socket room only |

Server -> client events:

| Event | Typical payload | UI action |
|---|---|---|
| `call:incoming` | `{ callId, callerId, conversationId, type, roomName, status, livekitProvider, apiVersion }` | Show incoming call modal |
| `call:ongoing` | `callData` | Sync caller/current device call state |
| `call:joined` | `{ callId, conversationId?, userId?, status?, participant?, socketOnly? }` | Update participant state; `socketOnly` means room join acknowledgement |
| `call:left` | `{ callId, conversationId, userId, status }` | Mark participant left |
| `call:declined` | `{ callId, conversationId, userId, status }` | Mark participant declined |
| `call:missed` | `{ callId, conversationId, userId?, missedUserIds?, status }` | Mark missed/timeout |
| `call:busy` | `{ callId, conversationId, busyUserIds }` | Show busy state |
| `call:ended` | `{ callId, conversationId, status, endedAt, endedBy, callMessage }` | Close call UI and refresh chat |

## 4. Required Frontend State

Recommended minimal state:

```ts
type CallState = {
  callId: string | null;
  conversationId: string | null;
  type: "audio" | "video" | null;
  status: CallV2SessionStatus | null;
  participants: Record<string, {
    userId: string;
    status: CallV2ParticipantStatus;
    invitedAt?: number;
    joinedAt?: number;
    leftAt?: number;
    endedAt?: number;
  }>;
  roomName: string | null;
  token: string | null;
  wsUrl: string | null;
  livekitProvider: "cloud" | null;
  busyUserIds: string[];
};
```

Frontend UI should support:

- Incoming call modal with accept/reject buttons.
- Outgoing ringing state with cancel/end action.
- Active call screen using LiveKit room connection.
- Participant list with per-user statuses.
- Busy state for private/group calls.
- Missed/rejected/ended terminal states.
- Reconnect flow: call `GET /v2/calls/conversations/{conversationId}/active` when opening a conversation or restoring app state.

## 5. End-to-End Flows

### Outgoing Call

1. User taps audio/video call.
2. Frontend calls `POST /v2/calls`.
3. Frontend connects `/v2/calls` socket if not connected.
4. Frontend emits `call:join` with the returned `callId` to join the socket room.
5. Caller UI shows ringing.
6. When a participant joins, frontend receives `call:joined`.
7. Caller can call `POST /v2/calls/{callId}/join` to get LiveKit token if the product wants caller to connect immediately; otherwise connect when call becomes `in-call`.
8. End with `POST /v2/calls/{callId}/end` or `DELETE /v2/calls/{callId}`.

### Incoming Call

1. Frontend receives `call:incoming`.
2. Show incoming call modal.
3. Reject: call `POST /v2/calls/{callId}/reject`.
4. Accept: emit `call:join`, then call `POST /v2/calls/{callId}/join`.
5. Use returned `token`, `wsUrl`, `roomName` to connect LiveKit.
6. On `call:ended`, disconnect LiveKit and close call UI.

### Missed Call

1. If incoming call modal times out client-side, call `POST /v2/calls/{callId}/missed`.
2. Backend also has a server-side timeout, default 60 seconds.
3. Listen to `call:missed` and `call:ended` to keep all devices in sync.

## 6. Implementation Checklist

- [ ] Install `livekit-client` and `socket.io-client`.
- [ ] Add a dedicated Call V2 API service using `/v2/calls/*`.
- [ ] Add a dedicated Call V2 socket client using namespace `/v2/calls`.
- [ ] Remove V2 usage of `/calls/v2`, `/socket/calls`, `answer`, `call:answered`, `call:rejected`.
- [ ] Implement incoming, outgoing, active, missed, busy, rejected, ended UI states.
- [ ] Refresh active call on app foreground and conversation open.
- [ ] Refresh chat/conversation when `call:ended` includes `callMessage`.
- [ ] Use Swagger `/api-docs` for exact schemas and error examples.

## 7. Legacy V1 Reference

Only keep this for old screens that have not migrated:

- REST: `/v1/calls/*`
- Socket namespace: `/socket/calls`
- Legacy accept endpoint/event: `POST /v1/calls/{callId}/answer`, `call:answered`

Do not mix legacy V1 socket events with V2 call REST calls.
