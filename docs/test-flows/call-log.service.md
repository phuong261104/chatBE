# call-log.service.test.ts

Purpose: verify terminal call sessions are written into chat history correctly.

Business flows:
- Completed calls create a call message with duration and update conversation last message.
- Missed calls increment unread count for recipients except the caller.
- Rejected and cancelled calls create terminal call metadata without duration.
- A session with an existing `loggedMessageId` does not create duplicate call messages or socket events.

