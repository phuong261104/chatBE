# chat-v2-behavior.test.ts

Purpose: protect core canonical chat business rules at usecase level with mocked repositories.

Business flows:
- Edit can be bounded by a 30 second window when the canonical flow passes that limit.
- Group owner leaving transfers ownership to the oldest active admin.
- Quote replies keep quote metadata, including split media messages and call-message previews.
- Re-adding a left group member restores active membership without stale admin, archive, unread, or hidden state.
- Forwarding allows call messages but rejects system messages.
- System or inactive messages cannot be reacted to.
- Loading messages respects the member `hiddenAt` cutoff.

