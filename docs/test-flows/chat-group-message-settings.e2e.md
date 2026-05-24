# chat-group-message-settings.e2e.test.ts

Purpose: verify group message settings are enforced through REST and Socket.IO flows.

Business flows:
- `whoCanSendMessages: "admins"` blocks normal members from sending through canonical HTTP.
- Admin socket sends still succeed and emit `receiveMessage` to active visible members.
- `allowSendLink: false` blocks link messages without creating link classifications.
- Plain text messages still work after link sending is disabled.
