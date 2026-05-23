# chat-group-permissions.test.ts

Purpose: protect pure group permission helpers.

Business flows:
- Partial group settings keep default nested utility permissions.
- Active, owner, admin, and manager checks account for role and conversation ownership metadata.
- Restricted utilities require owner/admin when configured.
- Poll result visibility hides other voters before close for normal members.
