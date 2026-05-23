# chat-message-action-rules.test.ts

Purpose: protect message action guard and preview helper behavior.

Business flows:
- Deleted, revoked, hidden, and system messages cannot be forwarded, quoted, or reacted to.
- Message previews remain stable for text, media, call, system, profile-card, and link messages.
- Forwarding text with URLs upgrades message type to link.
- Media types map to search/media classification types.
