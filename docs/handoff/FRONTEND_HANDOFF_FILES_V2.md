# Frontend Handoff Files V2

Updated: 2026-05-15

This is the source-checked reading packet for frontend implementation.

| Order | File / URL | Required? | What frontend should use it for | Source status |
|---|---|---:|---|---|
| 1 | `docs/FE_INTEGRATION_GUIDE_V2.md` | Yes | Main REST + socket integration flow, endpoint inventory, migration checklist | Checked against `src/index.ts` and route files |
| 2 | `docs/SOCKET_EVENTS_V2_REFERENCE.md` | Yes | Socket.IO namespaces/events for root, `/messages`, `/v2/calls`, `/friends`, `/blocks`, My Cloud | Checked against socket services/constants |
| 3 | `docs/handoff/FRONTEND_API_SOCKET_V2_CHANGES.md` | Yes | Quick V1 -> V2 behavior changes and migration notes | Checked against V2 route/socket files |
| 4 | `docs/handoff/FRONTEND_CALL_INTEGRATION_GUIDE.md` | Yes, if calls are implemented | LiveKit cloud call flow, REST calls, socket events, UI state requirements | Updated to current `/v2/calls` API |
| 5 | `http://localhost:3000/api-docs` | Yes | Exact request/response schemas, enum values, error codes | Generated from `docs/swagger/*` |
| 6 | `docs/SOCKET_FRIENDS_BLOCKS_REFERENCE.md` | Reference | Detailed friendship/block socket payload examples | Matches `/friends` and `/blocks` socket services |
| 7 | `docs/CHAT_WEBSOCKET_EVENTS_CHECKLIST.md` | Reference | Chat websocket QA checklist and known caveats | Updated root namespace caveat |

Backend coverage summary for frontend:

| Module | Backend status | Frontend action |
|---|---|---|
| Auth | Complete under `/v1/auth/*` | Implement login/register/token/session/password flows |
| User V2 | Complete under `/v2/users/*` | Implement profile, privacy, presence, search, suggestions |
| Chat V2 | Complete under `/v2/conversations/*`, `/v2/messages/*`, `/v2/groups/*` | Implement conversations, message requests, hidden chats, TTL, group settings |
| Calls V2 | Complete under `/v2/calls/*` and socket `/v2/calls` | Use LiveKit cloud token from `join`; do not use legacy answer flow |
| Media | Complete under `/v1/media/*` | Implement multipart and presigned upload flows |
| Friendships / Blocks | Complete under `/v1` and `/v2` aliases | Implement friend request/list/block UIs and socket notifications |
| My Cloud | Complete under `/v1/my-cloud/*` | Implement cloud item, trash, sharing, upload, collections |
| AI | Complete under `/v1/ai/*` | Implement summarize, smart reply, tone adjust, translate, language detect |

Do not hand off only the call guide by itself. The call guide depends on auth, socket auth, Swagger schemas, and the V2 changes document.
