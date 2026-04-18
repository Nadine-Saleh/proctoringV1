# Contract: `record_violation_batch` RPC

**Feature**: 001-ai-proctoring-system
**Exposed to**: authenticated `student` role, via Supabase RPC
**Shape**: Postgres function

Accepts a batch of derived violation signals from the active session, recomputes the session's live cheating score, and — where policy and severity permit — registers evidence-artifact linkage. This is the ONLY write path for violation events; all client batching flows funnel through it.

---

## Input

```jsonc
{
  "session_id": "uuid",
  "events": [
    {
      "client_event_id": "uuid-or-stable-string",
      "type": "gaze_off_screen",
      "severity": 3,
      "client_captured_at": "ISO-8601 UTC",
      "metadata": { "gaze_yaw_deg": 42.1 },
      "evidence": {
        "captured": true,
        "bucket_path": "sessions/<uuid>/<uuid>.webm",
        "content_type": "video/webm",
        "byte_length": 184322
      }
    }
  ]
}
```

- `events` MUST contain 1..50 entries per call.
- `client_event_id` MUST be unique per event per session; idempotency is enforced by `UNIQUE (session_id, client_event_id)` on `violation_events`.
- `severity` MUST match the canonical table in `src/utils/violationScorer.ts` for the given `type`. Deviations are rejected.
- `evidence` is OPTIONAL and MUST be omitted (or `captured: false`) when `exam.proctoring_policy.visual_evidence_allowed = false`. The RPC enforces this; a client that submits evidence against a disallowing policy receives `evidence_policy_violation` and the entire batch is rejected atomically.
- `bucket_path` refers to an object already uploaded to the `evidence-snippets` private bucket via a signed PUT URL issued by a separate RPC.

---

## Response

```jsonc
{
  "accepted": 4,
  "deduplicated": 1,
  "rejected": 0,
  "live_cheating_score": 42.7,
  "crossed_warning_threshold": false,
  "crossed_critical_threshold": false,
  "instructor_alert_raised": false
}
```

- `accepted` = rows newly inserted.
- `deduplicated` = rows that matched an existing `client_event_id` (replay after reconnect).
- `rejected` = rows that failed validation individually (e.g., unknown type); the rest of the batch still commits.
- Score and threshold booleans reflect the state **after** the batch is applied.
- Per-call atomicity: the batch commits in a single transaction; if any row fails a policy check (`evidence_policy_violation`), the entire batch is rolled back and `rejected = events.length`.

---

## Error codes

- `session_not_in_progress` — session status is not `in_progress`.
- `session_not_owned` — `session.student_id ≠ auth.uid()`.
- `batch_too_large` — more than 50 events.
- `unknown_violation_type` — at least one event carries a type not in the taxonomy.
- `severity_mismatch` — at least one event's severity disagrees with the canonical table.
- `evidence_policy_violation` — evidence attached under a disallowing policy (whole batch rejected).
- `exam_window_closed` — server clock is past the exam window; client should cease uploads.

---

## Server-side side-effects

1. Insert `violation_events` rows (with `ON CONFLICT (session_id, client_event_id) DO NOTHING`).
2. For each event with `evidence.captured = true` AND policy allows, insert matching `evidence_artifacts` row and set `violation_events.evidence_artifact_id`.
3. Recompute `exam_sessions.live_cheating_score` using the decay formula from research R4 (computed server-side so a client cannot under-report).
4. If the recomputed score crosses `critical_threshold` AND has been ≥ `critical_threshold` for `critical_sustain_seconds`, insert an `instructor_alerts` row with `reason = 'critical_score_sustained'`. Supabase Realtime publishes this to the instructor dashboard.
5. If any event type is `camera_unavailable`, insert an `instructor_alerts` row with `reason = 'camera_lost'` (regardless of score).
6. If any event type is `multiple_persons`, insert an `instructor_alerts` row with `reason = 'multiple_persons'` (regardless of score) — but coalesced: only one alert per session per 30 s for this reason.

---

## Client-side contract

- Clients MUST buffer events in IndexedDB when offline and replay with their original `client_event_id` on reconnect (research R10). This is how FR-018 / SC-009 (no loss, no duplicates) is guaranteed end-to-end.
- Clients MUST NOT compute the authoritative score themselves — the displayed student-side score is derived from the RPC response only.
- Clients MUST NOT attempt to upload evidence when the exam's `proctoring_policy.visual_evidence_allowed = false`. Even if they did, the RPC rejects the batch (FR-020, SC-010).
