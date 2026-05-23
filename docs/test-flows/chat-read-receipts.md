# chat-read-receipts.test.ts

Purpose: protect read-receipt query and batch mark-read behavior.

Business flows:
- Read receipts exclude the sender and return `Date` values.
- Missing messages return a not-found error.
- Batch mark-read ignores own, missing, already-read, and other-conversation messages.
- The member state stores the latest read message by `createdAt`.
