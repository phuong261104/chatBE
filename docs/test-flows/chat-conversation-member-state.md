# chat-conversation-member-state.test.ts

Purpose: protect per-member conversation state handlers.

Business flows:
- Pin/unpin rejects duplicate state changes and updates active memberships only.
- Mute/unmute sets and clears `muteUntil`.
- Archive/unarchive rejects duplicate state changes.
- Total unread excludes archived, left, and pending memberships.
- Member listing excludes inactive members and the requested excluded user.
