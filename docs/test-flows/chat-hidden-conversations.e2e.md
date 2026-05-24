# chat-hidden-conversations.e2e.test.ts

Purpose: verify hidden conversation APIs and list filtering.

Business flows:
- Hidden conversations disappear from /v1 conversation lists.
- Wrong hidden PIN rejects unlock.
- Correct hidden PIN unlocks detail without un-hiding.
- Unhide restores the conversation to /v1 lists.
