# chat-profile-card.e2e.test.ts

Purpose: verify v2 profile-card messages through REST and realtime emission.

Business flows:
- Profile-card messages are persisted and update conversation last message metadata.
- Active visible members receive enriched profile-card socket payloads.
- Block relationships prevent sharing hidden profile cards.
