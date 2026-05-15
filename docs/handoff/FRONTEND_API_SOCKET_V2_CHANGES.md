# Frontend Handoff: API va Socket V2

Tai lieu nay tong hop cac thay doi moi cho frontend. Cac API `/v1` va socket namespace cu van giu nguyen de app cu tiep tuc hoat dong. Frontend chi can migrate sang cac endpoint/socket duoi day khi muon dung nghiep vu moi.

## Nguyen tac chung

- REST v2 dung prefix `/v2`.
- Call socket v2 dung namespace `/v2/calls`.
- Call socket cu `/socket/calls` va REST `/v1/calls` khong doi.
- Cac response duoi day van dung convention hien tai cua backend voi field `data` khi controller tra thanh cong.
- Auth giong v1: gui bearer token qua middleware REST, socket gui `auth.token` hoac `Authorization: Bearer <token>`.

## Call V2

### REST Endpoints

| Method | Path | Muc dich |
| --- | --- | --- |
| `POST` | `/v2/calls` | Tao call private/group |
| `GET` | `/v2/calls/conversations/:conversationId/active` | Lay call dang active theo conversation |
| `GET` | `/v2/calls/active-by-conversation/:conversationId` | Alias lay call active |
| `POST` | `/v2/calls/:callId/join` | Join call, tra LiveKit token |
| `POST` | `/v2/calls/:callId/leave` | Roi call |
| `POST` | `/v2/calls/:callId/reject` | Tu choi call |
| `POST` | `/v2/calls/:callId/missed` | Danh dau missed |
| `POST` | `/v2/calls/:callId/end` | Ket thuc call |
| `DELETE` | `/v2/calls/:callId` | Ket thuc call |
| `GET` | `/v2/calls/:callId/token` | Lay LiveKit token cho participant hop le |

### Tao Call

`POST /v2/calls`

```json
{
  "conversationId": "conversation-id",
  "type": "audio",
  "inviteAll": true,
  "inviteeIds": ["user-id-1", "user-id-2"]
}
```

Quy tac:

- `type`: `"audio"` hoac `"video"`.
- Private call khong can truyen `inviteeIds`; backend lay thanh vien con lai trong private conversation.
- Group call ho tro:
  - `inviteAll: true`: moi tat ca active members tru caller.
  - `inviteeIds`: moi danh sach thanh vien duoc chon.
- Neu user busy:
  - Private call: backend tra `409` va `busyUserIds`.
  - Group call: van tao call cho user available, response co `busyUserIds`.

Response thanh cong:

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

### Join Call

`POST /v2/calls/:callId/join`

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

Frontend dung `token`, `wsUrl`, `roomName` de join LiveKit. Camera toggle, mic toggle, front/back camera la logic client LiveKit.

### Call Status

Session status:

- `ringing`
- `in-call`
- `ended`
- `missed`
- `rejected`
- `cancelled`

Participant status:

- `invited`
- `ringing`
- `joined`
- `declined`
- `missed`
- `left`
- `busy`

### Timeout

- Default backend timeout: 60 giay.
- Private call timeout: ket thuc call va log missed.
- Group call timeout:
  - Neu chua co callee nao join: ket thuc call missed.
  - Neu da co callee join: chi mark cac nguoi chua tra loi la missed, call tiep tuc.

## Call Socket V2

Namespace:

```ts
io(`${BASE_URL}/v2/calls`, {
  auth: { token, deviceId }
});
```

Client co the emit:

| Event | Payload | Ghi chu |
| --- | --- | --- |
| `call:join` | `{ "callId": "call-id" }` | Chi join socket room `call:{callId}` |
| `call:leave` | `{ "callId": "call-id" }` | Chi leave socket room |

Server events:

| Event | Khi nao nhan |
| --- | --- |
| `call:incoming` | User duoc moi vao call |
| `call:ongoing` | Caller tao call hoac can dong bo call dang dien ra |
| `call:joined` | Co participant join |
| `call:left` | Co participant leave |
| `call:declined` | Co participant reject |
| `call:missed` | Participant missed/timeout |
| `call:busy` | Co user busy |
| `call:ended` | Call terminal: ended/missed/rejected/cancelled |

Vi du listener:

```ts
callSocket.on("call:incoming", (payload) => {
  // show incoming call UI
});

callSocket.on("call:joined", (payload) => {
  // update participant list/state
});

callSocket.on("call:ended", (payload) => {
  // close call UI, refresh conversation last message if callMessage exists
});
```

## Chat V2

### Conversation List

| Method | Path | Ghi chu |
| --- | --- | --- |
| `GET` | `/v2/conversations` | Mac dinh loai hidden conversations |
| `GET` | `/v2/conversations/cursor` | Mac dinh loai hidden conversations |

Hidden conversation khong xuat hien trong list v2. Muon xem lai can unlock bang PIN.

### Gui Tin Nhan Private Dau Tien

`POST /v2/messages/private`

```json
{
  "targetUserId": "target-user-id",
  "text": "Xin chao",
  "media": [],
  "ttlSeconds": 3600
}
```

Quy tac:

- Neu hai user la active friends: tao/lay private conversation va gui tin binh thuong.
- Neu khong phai friend va khong bi block: tao message request, member receiver o status `pending`.
- Neu bi block: backend tra `403`.
- `ttlSeconds` optional; neu co thi message tu het han theo `expiresAt`/`expireAtEpoch`.

Response:

```json
{
  "data": {
    "conversation": {},
    "messages": [],
    "messageRequestStatus": "pending"
  }
}
```

Socket bo sung cho message request:

| Event | Payload |
| --- | --- |
| `message-request:incoming` | `{ conversationId, fromUserId, message }` |

### Message Requests

| Method | Path | Muc dich |
| --- | --- | --- |
| `GET` | `/v2/message-requests` | List pending private message requests |
| `POST` | `/v2/message-requests/:conversationId/accept` | Accept request, receiver thanh active member |
| `POST` | `/v2/message-requests/:conversationId/reject` | Reject request |

### Hidden Conversations

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/v2/conversations/:conversationId/hide` | `{ "pin": "1234" }` |
| `POST` | `/v2/conversations/:conversationId/unlock` | `{ "pin": "1234" }` |
| `POST` | `/v2/conversations/:conversationId/unhide` | `{ "pin": "1234" }` |

Ghi chu frontend:

- PIN khong luu plain text tren backend; backend luu bcrypt hash theo member metadata.
- List v2 an hidden conversation.
- Khi gui/edit message qua v2, backend chi emit normal message notification cho active members khong hidden conversation do.

### Gui Tin Nhan Trong Conversation

`POST /v2/conversations/:conversationId/messages`

```json
{
  "text": "noi dung",
  "media": [],
  "ttlSeconds": 60
}
```

Backend tu phan biet private/group conversation. Group message v2 ton trong setting `whoCanSendMessages`.

### Edit Message V2

`PUT /v2/messages/:messageId`

```json
{
  "text": "noi dung moi"
}
```

Khac v1:

- V2 chi cho edit trong 30 giay tu `createdAt`.
- V1 van giu behavior cu.

### Group V2

| Method | Path | Muc dich |
| --- | --- | --- |
| `POST` | `/v2/groups` | Tao group, memberIds phai la active friends va khong bi block |
| `POST` | `/v2/groups/:groupId/members` | Them member, selected users phai la active friends va khong bi block |
| `POST` | `/v2/groups/:groupId/leave` | Owner leave se auto-transfer owner |
| `PATCH` | `/v2/groups/:groupId/settings` | Cap nhat group settings |

`PATCH /v2/groups/:groupId/settings`

```json
{
  "allowSendLink": true,
  "requireApproval": false,
  "allowMemberInvite": true,
  "whoCanSendMessages": "admins"
}
```

`whoCanSendMessages`:

- `"all"`: tat ca active members co the gui.
- `"admins"`: chi admins duoc gui group message.

Owner leave v2:

- Transfer cho oldest active admin.
- Neu khong co admin khac, transfer cho oldest active member.
- Neu khong con ai, group duoc dua ve trang thai khong con active member.

## Message Fields Moi

Frontend nen support cac field optional sau:

```ts
type MessageV2Extra = {
  forwardedFrom?: string;
  forwardedFromMessageId?: string;
  expiresAt?: string;
  expireAtEpoch?: number;
  quotedMessageId?: string;
  quotedMessagePreview?: string;
  call?: {
    callId: string;
    roomName: string;
    callType: "audio" | "video";
    status: "completed" | "missed" | "rejected" | "cancelled";
    participantOutcomes?: Record<string, {
      status: string;
      joinedAt?: string;
      leftAt?: string;
      endedAt?: string;
    }>;
  };
};
```

Ghi chu:

- Forward labels dung `forwardedFrom` va `forwardedFromMessageId`.
- Quote UI dung `quotedMessageId` va `quotedMessagePreview`; media/link split messages cung co metadata nay.
- Self-destruct messages co `expiresAt` va `expireAtEpoch`; frontend nen an/khong pin/khong search local neu da het han.

## Frontend Migration Checklist

- Khong doi app cu dang goi `/v1`.
- Tao client call moi connect namespace `/v2/calls`.
- Doi luong answer call cu sang `POST /v2/calls/:callId/join`.
- Cap nhat UI group call theo participant status thay vi chi session status.
- Xu ly `busyUserIds` khi tao call group/private.
- Them man hinh/list cho `/v2/message-requests`.
- Them flow hide/unlock/unhide conversation bang PIN.
- Khi tao/add group o v2, hien loi neu selected user khong phai active friend hoac bi block.
- Support `ttlSeconds` khi gui self-destruct message va render expired state o client.
