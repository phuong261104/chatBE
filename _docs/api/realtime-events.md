# Realtime Events Guide (Socket.IO)

Tai lieu mo ta event realtime dang duoc backend phat va nhan.

## Namespaces

1. `/messages`
2. `/friends`
3. Root namespace cho presence

## Namespace /messages

### Client -> Server

`joinGroup`

```json
{
  "conversationId": "uuid"
}
```

Ack mau:

```json
{
  "success": true,
  "message": "Joined group <id>"
}
```

`leaveGroup`

```json
{
  "conversationId": "uuid"
}
```

`messageSeen`

```json
{
  "conversationId": "uuid",
  "lastSeenMessageId": "uuid"
}
```

`messageDelivered`

```json
{
  "conversationId": "uuid",
  "lastDeliveredMessageId": "uuid"
}
```

`typing:start` hoac `typing:stop`

```json
{
  "toUserId": "uuid"
}
```

Hoac:

```json
{
  "groupId": "uuid"
}
```

### Server -> Client

`receiveMessage`

```json
{
  "conversationId": "uuid",
  "message": {}
}
```

`messageSeen`

```json
{
  "conversationId": "uuid",
  "userId": "uuid",
  "lastSeenMessageId": "uuid"
}
```

`messageDelivered`

```json
{
  "conversationId": "uuid",
  "userId": "uuid",
  "lastDeliveredMessageId": "uuid"
}
```

Danh sach event khac:

1. `conversation:created`
2. `conversation:members_added`
3. `conversation:member_removed`
4. `conversation:updated`
5. `message:revoked`
6. `message:edited`
7. `message:pinned`
8. `message:unpinned`
9. `message:reaction`
10. `message:reaction:remove`
11. `message:reactions:clear`
12. `typing:start`
13. `typing:stop`

## Namespace /friends

Server -> Client:

1. `friend_request:received`
2. `friend_request:accepted`
3. `friend_request:rejected`
4. `friend_request:canceled`
5. `friendship:unfriended` (co ham notify, nhung hien tai luong HTTP unfriend dang comment event)

Payload event mau:

```json
{
  "type": "FRIEND_REQUEST_RECEIVED",
  "data": {},
  "timestamp": "2026-03-28T10:00:00.000Z"
}
```

## Root namespace (presence)

Server -> Client:

`user:online`

```json
{
  "userId": "uuid"
}
```

`user:offline`

```json
{
  "userId": "uuid"
}
```

Client -> Server:

`heartbeat` dung de gia han online state.

## Khuyen nghi tich hop FE

1. Dang ky listener mot lan sau login va cleanup khi logout hoac unmount.
2. Join user room ngay sau connect; joinGroup khi vao man hinh chat group.
3. Neu dung optimistic UI, can rollback khi API fail nhung event den tre.
4. Co dedup theo `message.id` de tranh render trung event.
