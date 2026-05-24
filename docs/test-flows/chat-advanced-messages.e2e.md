# chat-advanced-messages.e2e.test.ts

Purpose: verify advanced message workflows through the canonical HTTP surface and the chat socket namespace.

Business flows:
- Send message through `/v1/conversations/:id/messages`; receivers get `receiveMessage`; TTL messages disappear after expiry.
- Socket `sendMessage` must behave like canonical HTTP, including `ttlSeconds`, `expiresAt`, and `expireAtEpoch`.
- Edit is allowed only inside the 30 second window for both `/v1/messages/:id` and socket `editMessage`.
- Delivered/read are tested through v1 HTTP fallback and socket because no canonical HTTP route exists.
- Recall/delete-for-everyone replace content with `"Tin nhắn đã được thu hồi"` within 24 hours; delete-for-me is local to the actor.
- Reply, forward, pin, and reactions are covered on current HTTP fallback routes plus socket equivalents.
- Private chat allows both users to pin; group chat only allows owner/admin to pin.

