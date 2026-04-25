# Contract: `join_exam` + `verify_student_identity` + `start_exam_session` RPCs

**Feature**: 001-ai-proctoring-system
**Exposed to**: authenticated `student` role, via Supabase RPC
**Shape**: Postgres functions invoked through the `@supabase/supabase-js` client

The student-join flow is a three-step RPC sequence, separated because each step has distinct preconditions and must be independently retryable.

---

## `join_exam(access_code text) → JoinExamResponse`

Validates the code and creates (or returns the existing) `exam_sessions` row in `awaiting_verification` state. This RPC does **not** admit the student; it only establishes the session anchor.

### Input

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `access_code` | text | yes | 8-char Crockford Base32; uppercased before lookup |

Caller MUST be authenticated as a `student`. Calling as `instructor` returns `403`.

### Response (`JoinExamResponse`)

```jsonc
{
  "session_id": "uuid",
  "exam": {
    "id": "uuid",
    "title": "string",
    "description": "string | null",
    "starts_at": "ISO-8601 UTC",
    "duration_minutes": 120,
    "proctoring_policy": {
      "visual_evidence_allowed": true,
      "warning_threshold": 30,
      "critical_threshold": 60,
      "critical_sustain_seconds": 10,
      "max_verification_attempts": 3
    }
  },
  "requires_reference_capture": true | false,
  "verification_attempts_remaining": 3
}
```

### Error codes

- `invalid_code` — code not found or outside any published exam's active set.
- `exam_window_not_open` — current server time is before `starts_at` or after `starts_at + duration_minutes`.
- `exam_closed` — exam status is `closed`.
- `already_active_session` — student has an active session for this exam on another device/tab.
- `verification_blocked` — student previously exhausted attempts for this exam.

### Server-side guarantees

- Session is created with `status = 'awaiting_verification'` and `admitted_at = NULL`.
- No violation events may be recorded against this session until `status` advances.
- `requires_reference_capture = true` iff no `student_face_references` row exists for the caller.

---

## `verify_student_identity(session_id uuid, embedding float4[]) → VerificationResponse`

Compares the supplied live embedding against the stored reference and returns pass/fail. The embedding is computed on the client (research R3) — the raw reference is never returned to the client.

### Input

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `session_id` | uuid | yes | must belong to the authenticated student and be in `awaiting_verification` |
| `embedding` | float4[128] | yes | live-capture embedding |

### Response (`VerificationResponse`)

```jsonc
{
  "outcome": "pass" | "fail",
  "confidence": 0.42,
  "attempts_remaining": 2,
  "blocked": false,
  "session_status": "verified" | "awaiting_verification" | "verification_blocked"
}
```

### Error codes

- `session_not_found` — not owned or wrong status.
- `reference_missing` — no `student_face_references` row; caller must run reference capture first.
- `capture_invalid` — embedding dimension mismatch or NaN values.
- `verification_blocked` — budget exhausted at call time.

### Server-side guarantees

- A `verification_attempts` row is inserted on every call with `outcome`, `confidence`, `counted_against_budget = true` (unless this is the first verification after a fresh reference capture, in which case the first attempt is not counted).
- On `outcome = 'pass'`: `exam_sessions.admitted_at = now()`, `status → 'verified'`.
- On `outcome = 'fail'` with budget left: status remains `awaiting_verification`.
- On budget exhaustion: `status → 'verification_blocked'`, an `instructor_alerts` row raised with `reason = 'verification_failed_hard'`.

---

## `start_exam_session(session_id uuid) → StartResponse`

Transitions a `verified` session into `in_progress` and returns the question list. Separate from `verify_student_identity` so the client can present a "you are verified — ready to begin?" screen without starting the clock.

### Input

| Field | Type | Required |
|-------|------|----------|
| `session_id` | uuid | yes |

### Response (`StartResponse`)

```jsonc
{
  "session": {
    "id": "uuid",
    "started_at": "ISO-8601 UTC",
    "status": "in_progress"
  },
  "questions": [
    {
      "id": "uuid",
      "position": 1,
      "type": "multiple_choice_single",
      "prompt": "...",
      "options": [ { "id": "uuid", "label": "..." } ],
      "points": 1
    }
  ]
}
```

Note: `correct_answer` is **never** returned to students.

### Error codes

- `session_not_verified` — session is not in `verified` status.
- `exam_window_closed` — current time ≥ `exam.starts_at + duration_minutes`.
- `session_already_started` — idempotent: returns existing `started_at`, no state change.

---

## Cross-RPC invariants

- The three RPCs MUST be independently idempotent for the same caller within a short retry window: `join_exam` returns the existing session; `verify_student_identity` treats identical `(session_id, embedding)` within 2 s as the same attempt (deduplicated server-side via a recent-attempt check); `start_exam_session` is idempotent on `session_id`.
- All timestamps are server-authoritative (research R6).
- RLS on the underlying tables ensures a student can only reach their own session rows; these RPCs additionally check `session.student_id = auth.uid()`.
