# Contract: `submit_exam` Edge Function + `auto_submit_expired_sessions` Job

**Feature**: 001-ai-proctoring-system
**Exposed to**: authenticated `student` role, via Supabase Edge Function (HTTP)
**Shape**: Edge Function that wraps a Postgres transaction

The submission step finalizes answers, computes auto-gradable scores, assembles the evidence package, and raises instructor-visible delivery records in a single atomic transaction. Implemented as an Edge Function (rather than a plain RPC) so delivery retries and evidence-package assembly can be orchestrated server-side with service-role privileges while RLS still guards read paths.

---

## POST `/functions/v1/submit-exam`

### Input

```jsonc
{
  "session_id": "uuid",
  "submit_reason": "manual",
  "client_submitted_at": "ISO-8601 UTC"
}
```

- `submit_reason` MUST be `"manual"` when called by the student. `"auto_window_close"` and `"auto_disconnect"` are set only by the scheduled auto-submit job, which calls this Edge Function with the service-role key.
- `client_submitted_at` is diagnostic only (not used for any decision).

Caller MUST be authenticated. The Edge Function verifies `session.student_id = auth.uid()` before proceeding unless invoked with the service-role key.

---

## Response

```jsonc
{
  "submission_id": "uuid",
  "idempotent_hit": false,
  "grade_status": "partial_pending_review",
  "auto_graded_score": 7,
  "auto_graded_max": 10,
  "final_grade": null,
  "final_cheating_score": 42.7,
  "evidence_package_id": "uuid",
  "submitted_at": "ISO-8601 UTC"
}
```

- `idempotent_hit = true` when the session already has a `submissions` row; the existing row is returned unchanged (FR-027).
- `final_grade` is non-null only when `grade_status = 'auto_final'`.

---

## Error codes

- `session_not_found_or_not_owned`
- `session_not_eligible` — status is not `in_progress` (nor `verified` at window close for auto-submit).
- `exam_window_already_closed` — manual submit attempts made after auto-submit already ran return the existing submission via idempotency.

---

## Server-side flow (transactional)

1. **Freeze answers**: UPDATE `student_answers SET frozen_at = now()` for the session. No further writes accepted after this point.
2. **Compute auto-grade**: for each `student_answer`, if the linked `exam_question.type` is auto-gradable (research R8), compare against `correct_answer` and accumulate points. Sum into `auto_graded_score`.
3. **Decide `grade_status`**:
   - `auto_final` if all questions are auto-gradable.
   - `partial_pending_review` if some are auto-gradable and others are `free_response`.
   - `fully_pending_review` if none are auto-gradable.
4. **Snapshot cheating score**: read `exam_sessions.live_cheating_score` into `final_cheating_score`.
5. **Insert `submissions`** with `ON CONFLICT (session_id) DO NOTHING RETURNING *`. If no row returned (conflict), re-SELECT and return it as `idempotent_hit = true`.
6. **Assemble `evidence_packages`** row: build `violation_summary` from aggregated `violation_events` for the session.
7. **Update `exam_sessions`**: `status = 'submitted'` or `'auto_submitted'` (based on `submit_reason`), `submitted_at = now()`, `submit_reason = <input>`.
8. **Publish realtime**: the UPDATE on `exam_sessions` triggers the instructor dashboard's Realtime subscription. The instructor sees the submission appear with its grade + evidence link within the delivery SLA (SC-004).

---

## Auto-submit job: `auto_submit_expired_sessions`

A scheduled Edge Function (Supabase cron; runs every 60 s) that:

1. Selects `exam_sessions` with `status IN ('verified','in_progress')` and the parent exam's window has closed (`starts_at + duration_minutes < now()`).
2. For each, calls the submission path with `submit_reason = 'auto_window_close'` using the service-role key.
3. Also selects sessions in `in_progress` whose `last_score_update_at` is older than the configured disconnect-grace (default 10 minutes) — submits with `submit_reason = 'auto_disconnect'`.

Job is idempotent: re-runs against already-submitted sessions are no-ops via the `submissions.session_id` uniqueness + `ON CONFLICT DO NOTHING`.

---

## Interaction with instructor dashboard

The instructor's results view reads from `submissions` joined with `exam_sessions`, `evidence_packages`, and (lazily) `violation_events` for the per-student timeline. Evidence snippet playback uses short-TTL signed URLs generated on-demand from bucket paths — **never** long-lived public URLs.
