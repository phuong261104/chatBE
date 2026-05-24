# call-v2.service.test.ts

Purpose: verify call lifecycle rules without HTTP or LiveKit dependencies.

Business flows:
- Group calls invite all members or selected invitees depending on request data.
- Active group members may join a call late.
- Private calls terminate when the callee rejects or is busy.
- Unanswered group calls become missed only when nobody joins.
- Busy users are excluded while available invitees continue in group calls.
- Terminal call logs preserve participant outcomes for later history views.

