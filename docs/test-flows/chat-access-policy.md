# chat-access-policy.test.ts

Purpose: protect chat access-policy rules independently from HTTP and Socket.IO.

Business flows:
- Private conversations require both users to be active and unblocked in both directions.
- Group member validation rejects duplicates and self-adds before repository lookups.
- Active-member listing excludes pending and left members.
- Group-only and hidden-message checks return domain errors.
