# Socket.IO Chat Events Checklist

This checklist is for frontend integration against the current `/messages`
namespace. It is intentionally narrower than
`docs/SOCKET_IO_BACKEND_REFERENCE.md`.

Checked against:

- `src/modules/chat/constants/socket-events.ts`
- `src/modules/chat/infras/transport/socket/register-handlers.ts`
- `src/modules/chat/infras/transport/socket/connection.handlers.ts`
- `src/modules/chat/infras/transport/socket/message.handlers.ts`
- `src/modules/chat/infras/transport/socket/reaction.handlers.ts`
- `src/modules/chat/infras/transport/socket/conversation.handlers.ts`
- `src/modules/chat/infras/transport/socket/member.handlers.ts`
- `src/modules/chat/infras/transport/socket/notifiers.ts`

## Namespace Rules

| Need | Namespace |
| --- | --- |
| Chat business events | `/messages` |
| Room subscription outside chat business flow | root `/` with `subscribeConversation` / `unsubscribeConversation` |
| Presence lookup | root `/` with `getOnlineStatus` / `getBatchOnlineStatus` |
| Root heartbeat with `pong` response | root `/` with `ping` |
| `/messages` heartbeat | `/messages` with `heartbeat` or `ping`; no `pong` payload is emitted |

Connect with the standard Socket.IO path `/socket.io` and JWT token in
`auth.token`, `query.token`, or `Authorization: Bearer <jwt>`.

## Client -> Server Checklist

All events below are registered on `/messages`.

| Event | Payload | Handler |
| --- | --- | --- |
| `heartbeat` | ignored | presence touch |
| `ping` | ignored | presence touch |
| `joinGroup` | `{ conversationId }` | `handleJoinGroup` |
| `leaveGroup` | `{ conversationId }` | `handleLeaveGroup` |
| `messageSeen` | `{ conversationId, lastSeenMessageId }` | `handleMessageSeen` |
| `messageDelivered` | `{ conversationId, lastDeliveredMessageId }` | `handleMessageDelivered` |
| `markAllSeen` | `{ conversationId }` | `handleMarkAllSeen` |
| `typing:start` | `{ toUserId }` or `{ groupId }` | `handleTypingStart` |
| `typing:stop` | `{ toUserId }` or `{ groupId }` | `handleTypingStop` |
| `sendMessage` | `{ conversationId, text?, media?, ttlSeconds? }` | `handleSendMessage` |
| `editMessage` | `{ messageId, text }` | `handleEditMessage` |
| `deleteMessage` | `{ messageId }` | `handleDeleteMessage` |
| `revokeMessage` | `{ messageId }` | `handleRevokeMessage` |
| `deleteMessageForEveryone` | `{ messageId }` | `handleDeleteMessageForEveryone` |
| `forwardMessages` | `{ messageIds, targetConversationIds }` | `handleForwardMessages` |
| `quoteMessage` | `{ conversationId, quotedMessageId, text?, media? }` | `handleQuoteMessage` |
| `addReaction` | `{ messageId, emoji }` | `handleAddReaction` |
| `removeReaction` | `{ messageId, emoji? }` | `handleRemoveReaction` |
| `pinConversation` | `{ conversationId }` | `handlePinConversation` |
| `unpinConversation` | `{ conversationId }` | `handleUnpinConversation` |
| `archiveConversation` | `{ conversationId }` | `handleArchiveConversation` |
| `unarchiveConversation` | `{ conversationId }` | `handleUnarchiveConversation` |
| `muteConversation` | `{ conversationId, muteUntil?, duration? }` | `handleMuteConversation` |
| `unmuteConversation` | `{ conversationId }` | `handleUnmuteConversation` |
| `pinMessage` | `{ messageId }` | `handlePinMessage` |
| `unpinMessage` | `{ messageId }` | `handleUnpinMessage` |
| `addMembers` | `{ groupId, memberIds }` | `handleAddMembers` |
| `removeMember` | `{ groupId, targetUserId }` | `handleRemoveMember` |
| `setAdmin` | `{ groupId, targetUserId, isAdmin }` | `handleSetAdmin` |
| `transferOwner` | `{ groupId, newOwnerId }` | `handleTransferOwner` |
| `approveMember` | `{ groupId, userIdToApprove }` | `handleApproveMember` |
| `rejectMember` | `{ groupId, userIdToReject }` | `handleRejectMember` |
| `updateGroupSettings` | `{ groupId, allowSendLink?, requireApproval?, allowMemberInvite?, whoCanSendMessages?, whoCanAddMembers?, utilityPermissions? }` | `handleUpdateGroupSettings` |
| `updateGroupInfo` | `{ groupId, name?, avatarUrl? }` | `handleUpdateGroupInfo` |
| `dissolveGroup` | `{ groupId }` | `handleDissolveGroup` |
| `createPoll` | `{ conversationId, question, options, isMultipleChoice?, allowAddOption?, showResultsBeforeClose?, expiresAt? }` | `handleCreatePoll` |
| `votePoll` | `{ pollId, optionIds }` | `handleVotePoll` |
| `closePoll` | `{ pollId }` | `handleClosePoll` |
| `pinPoll` | `{ pollId }` | `handlePinPoll` |
| `unpinPoll` | `{ pollId }` | `handleUnpinPoll` |
| `createReminder` | `{ conversationId, title, description?, remindAt }` | `handleCreateReminder` |
| `updateReminder` | `{ reminderId, title?, description?, remindAt?, status? }` | `handleUpdateReminder` |
| `deleteReminder` | `{ reminderId, conversationId? }` | `handleDeleteReminder` |
| `createNote` | `{ conversationId, title, content }` | `handleCreateNote` |
| `updateNote` | `{ noteId, title?, content? }` | `handleUpdateNote` |
| `deleteNote` | `{ noteId, conversationId? }` | `handleDeleteNote` |
| `voice_message` | `{ conversationId, mediaUrl, duration? }` | `handleVoiceMessage` |
| `location_share` | `{ conversationId, latitude, longitude, accuracy? }` | `handleLocationShare` |

## Server -> Client Checklist

| Event | Payload |
| --- | --- |
| `user:online` | `{ userId, socketId, timestamp, visibility, isOnline, online, lastSeen }` |
| `user:offline` | `{ userId, timestamp, visibility, isOnline, online, lastSeen }` |
| `receiveMessage` | `{ message, conversationId }` |
| `message:edited` | `{ conversationId, message }` |
| `message:deleted` | `{ conversationId, messageId, deletedBy }` |
| `message:revoked` | `{ conversationId, messageId, revokedBy }` |
| `message:deleted_for_everyone` | `{ conversationId, messageId, deletedBy }` |
| `message:pinned` | `{ conversationId, message }` |
| `message:unpinned` | `{ conversationId, message }` |
| `message:quoted` | `{ conversationId, message, quotedMessageId }` |
| `message:reaction` | `{ messageId, reaction }` |
| `message:reaction:remove` | `{ messageId, userId, emoji? }` |
| `message:reactions:clear` | `{ messageId, userId }` when notifier is invoked |
| `message:reaction_summary` | `{ messageId, summary }` when notifier is invoked |
| `message:recall` | `{ messageId, recallBy }` when notifier is invoked |
| `message:edit_start` | `{ messageId, userId }` when notifier is invoked |
| `message:edit_end` | `{ messageId, userId }` when notifier is invoked |
| `messageSeen` | `{ conversationId, userId, lastSeenMessageId }` |
| `messageDelivered` | `{ conversationId, userId, lastDeliveredMessageId }` |
| `typing:start` | `{ userId, toUserId }` or `{ userId, groupId }` |
| `typing:stop` | `{ userId, toUserId }` or `{ userId, groupId }` |
| `conversation:created` | `{ conversation, systemMessage? }` or group creation payload from notifier |
| `conversation:members_added` | `{ conversationId, newMembers, addedBy? }` |
| `conversation:member_removed` | `{ conversationId, removedUserId, removedBy? }` |
| `conversation:updated` | `{ conversationId, data }` |
| `conversation:pin_toggled` | `{ conversationId, pinnedBy, pinned }` |
| `conversation:archived_toggled` | `{ conversationId, userId, archived }` |
| `conversation:mute_changed` | `{ conversationId, userId, mutedBy, muted?, muteUntil?, duration? }` |
| `group:member_left` | `{ conversationId, leftUserId, leftBy }` |
| `group:dissolved` | `{ conversationId, dissolvedBy }` |
| `group:renamed` | `{ conversationId, newName, renamedBy }` |
| `group:avatar_changed` | `{ conversationId, avatarUrl, changedBy }` |
| `group:admin_changed` | `{ conversationId, targetUserId, isAdmin, changedBy? }` |
| `group:owner_transferred` | `{ conversationId, oldOwnerId, newOwnerId }` |
| `group:member_approved` | `{ conversationId, userId, member, approvedBy? }` |
| `group:member_rejected` | `{ conversationId, userId, rejectedBy? }` |
| `group:settings_updated` | `{ conversationId, settings }` |
| `poll:new` | `{ conversationId, poll, createdBy? }` |
| `poll:vote` | `{ conversationId, pollId, poll, votedBy? }` |
| `poll:closed` | `{ conversationId, pollId, poll, closedBy }` |
| `poll:pinned` | `{ conversationId, pollId, poll, pinnedBy }` |
| `poll:unpinned` | `{ conversationId, pollId, poll, unpinnedBy }` |
| `group:reminder_created` | `{ conversationId, reminder, createdBy }` |
| `group:reminder_updated` | `{ conversationId, reminder, updatedBy }` |
| `group:reminder_deleted` | `{ conversationId, reminderId, deletedBy }` |
| `group:note_created` | `{ conversationId, note, createdBy }` |
| `group:note_updated` | `{ conversationId, note, updatedBy }` |
| `group:note_deleted` | `{ conversationId, noteId, deletedBy }` |
| `voice_message` | `{ message, conversationId }` |
| `location_share` | `{ conversationId, userId, location: { latitude, longitude, accuracy? } }` |
| `online_status` | `{ userId, isOnline }` when notifier is invoked |
| `user_presence` | `{ userId, lastSeen }` when notifier is invoked |

## Implementation Notes

- `messageSeen` and `messageDelivered` on `/messages` require
  `lastSeenMessageId` and `lastDeliveredMessageId`; older examples using
  `messageId` are not correct for the current handlers.
- Member/admin socket actions use `groupId`, not `conversationId`, in their
  payloads.
- Direct socket `deleteMessage` emits `message:deleted` only to the user who
  deleted the message. Other server paths can broadcast `message:deleted` by
  calling the notifier.
- `group:member_joined` exists in `SocketEvent`, but no active emitter is wired
  in current source.
- `subscribeConversation`, `unsubscribeConversation`, `getOnlineStatus`,
  `getBatchOnlineStatus`, and root `ping` are implemented on `/`, not
  `/messages`.

## Rate Limits

Rate limits are enforced by `SocketRateLimiter` on these chat actions:

| Event | Limit |
| --- | --- |
| `sendMessage` | 60/min |
| `typing:start` | 30/min |
| `addReaction` | 60/min |
| `editMessage` | 30/min |
| `deleteMessage` | 30/min |
| `forwardMessages` | 30/min |
| `quoteMessage` | 60/min |

Frontend should handle ack responses with
`{ success: false, error: "Rate limit exceeded..." }`.
