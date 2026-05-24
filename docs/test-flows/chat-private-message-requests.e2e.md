# chat-private-message-requests.e2e.test.ts

Purpose: verify private message request behavior across REST and Socket.IO.

Business flows:
- Non-friend private messages create a pending request and emit `message-request:incoming`.
- Pending requests are listed for the receiver.
- Accepted requests stay accepted for later messages.
- Blocked relationships reject private messages without creating messages.
