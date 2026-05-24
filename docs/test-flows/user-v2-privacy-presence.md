# user-v2-privacy-presence.test.ts

Purpose: verify user privacy, presence, and stranger-message policy rules.

Business flows:
- Presence is hidden when the viewer disables online visibility.
- Non-friends cannot see private profile fields.
- Stranger messages are blocked when the receiver's privacy setting disallows them.
- Friend messages remain allowed even when strangers are blocked.
- Last seen is updated only after the final active socket unregisters.

