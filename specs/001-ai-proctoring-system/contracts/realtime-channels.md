# Contract: Supabase Realtime Channels

**Feature**: 001-ai-proctoring-system
**Exposed to**: authenticated `instructor` role (primary consumer); `student` role (score feedback only)
**Shape**: Supabase Realtime (Postgres changes + authenticated subscriptions)

All live delivery flows through Supabase Realtime. Per research R2, no separate WebSocket channel exists after this feature merges.

---

## Channel: `oversight:exam:<exam_id>`

### Filter
Postgres changes on:
- `exam_sessions` where `exam_id = <exam_id>`
- `instructor_alerts` where `exam_id = <exam_id>`
- `submissions` where `exam_id = <exam_id>`

RLS governs who may subscribe: only the exam's `instructor_id` (or an explicit co-instructor listed on the exam) receives payloads. Other subscribers see zero events.

### Events delivered

| Event | Trigger | Payload shape |
|-------|---------|---------------|
| `session_score_update` | UPDATE on `exam_sessions.live_cheating_score` | `{ session_id, student_id, live_cheating_score, status }` |
| `session_status_change` | UPDATE on `exam_sessions.status` | `{ session_id, student_id, old_status, new_status, reason? }` |
| `alert_raised` | INSERT on `instructor_alerts` | `{ alert_id, session_id, student_id, reason, raised_at }` |
| `alert_acknowledged` | UPDATE on `instructor_alerts.acknowledged_at` | `{ alert_id, acknowledged_by, acknowledged_at }` |
| `submission_ready` | INSERT on `submissions` (any) | `{ submission_id, session_id, student_id, grade_status, final_cheating_score }` |

### Delivery guarantees

- At-least-once. Consumers MUST dedupe by the payload's primary id (`alert_id`, `submission_id`, `session_id`).
- Messages during a subscriber's disconnect are not retained indefinitely. On reconnect, the dashboard MUST reconcile by issuing a one-shot query for (a) sessions in non-terminal states, (b) unacknowledged alerts, (c) submissions since last known timestamp. This reconciliation is part of the dashboard bootstrap and is tested in the integration suite.

---

## Channel: `session:student:<session_id>`

### Filter
Postgres changes on:
- `exam_sessions` where `id = <session_id>` AND `student_id = auth.uid()`

Used by the student client to observe its own session state changes (e.g., if an instructor terminates the session).

### Events delivered

| Event | Trigger | Payload shape |
|-------|---------|---------------|
| `status_change` | UPDATE on `exam_sessions.status` | `{ old_status, new_status }` |
| `score_update` | UPDATE on `exam_sessions.live_cheating_score` | `{ live_cheating_score, warning_threshold_crossed, critical_threshold_crossed }` |

### Boundary

The student's client uses this channel for displayed score / threshold warnings. The authoritative score value still comes from `record_violation_batch` responses; this channel's role is to push instructor-initiated state changes to the student in real time (e.g., termination).

---

## Non-channels

The following MUST NOT be exposed as realtime channels:

- `violation_events` — these are high-frequency rows; the instructor dashboard receives aggregates via `exam_sessions.live_cheating_score` updates and singular `instructor_alerts` rows. Subscribing directly to `violation_events` would flood the instructor's browser and violate the Performance constitutional principle.
- `student_answers` — no legitimate realtime reason to surface another student's in-progress answers.
- `student_face_references` — never broadcast; embedding reads are RPC-only.

---

## Client reconnection contract

On reconnect after transient loss:

1. Re-subscribe to the same channel(s).
2. Issue a reconciliation query (see Delivery guarantees above).
3. Merge reconciliation results into local state, using message primary ids to dedupe against already-held entries.

The dashboard MUST NOT assume channel continuity; the reconcile step is required on every reconnect.
