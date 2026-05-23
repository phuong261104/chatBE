# chat-socket-rate-limiter.test.ts

Purpose: protect Socket.IO event rate-limit behavior.

Business flows:
- Known event types use their configured per-minute limits.
- Unknown event types use the default limit.
- Counters are isolated by user and event type.
- Limits reset after the one-minute window.
