# Phase 1 Data Model: Secure AI Proctoring System

**Feature**: 001-ai-proctoring-system
**Date**: 2026-04-17
**Scope**: Persistent entities, fields, relationships, validation rules, and state transitions. Types are expressed in Postgres / Supabase terms because the persistence layer is the single source of truth for shape; client-side types in `src/types/examSession.ts` mirror this model.

All tables have `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at timestamptz DEFAULT now()`, and `updated_at timestamptz DEFAULT now()` unless noted. All timestamps are `timestamptz` in UTC.

---

## Entity Catalogue

### 1. `exams`

An instructor-authored assessment.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `instructor_id` | uuid NOT NULL | FK → `auth.users.id`; owning instructor |
| `title` | text NOT NULL | 1..200 chars |
| `description` | text | optional, ≤ 2000 chars |
| `starts_at` | timestamptz NOT NULL | scheduled window start |
| `duration_minutes` | int NOT NULL | > 0; ≤ 480 (8 h cap) |
| `status` | text NOT NULL | enum: `draft` \| `published` \| `closed` |
| `proctoring_policy` | jsonb NOT NULL | `{ visual_evidence_allowed: bool, warning_threshold: int, critical_threshold: int, critical_sustain_seconds: int, max_verification_attempts: int }` |
| `access_code` | text | 8-char Crockford Base32; NULL once closed |
| `published_at` | timestamptz | set on transition to `published` |
| `closed_at` | timestamptz | set on transition to `closed` |

**Constraints**:
- `UNIQUE (access_code) WHERE status IN ('published')` (partial unique index; codes may be re-minted after close).
- `CHECK (duration_minutes > 0 AND duration_minutes <= 480)`
- `CHECK (status IN ('draft','published','closed'))`
- At least one row in `exam_questions` referencing this exam before `status` may transition to `published` (enforced in `publish_exam` RPC).

**State transitions**:

```
draft ──► published ──► closed
        (on publish)    (when window ends or instructor disables)
```

- `draft → published`: requires title, ≥ 1 question, `starts_at` in the future (or within grace), `duration_minutes > 0`. Access code generated at this transition.
- `published → closed`: automatic when `starts_at + duration_minutes` has elapsed for all joined sessions, or manual via `close_exam` RPC. Access code invalidated.
- No backwards transitions in v1.

---

### 2. `exam_questions`

Questions belonging to an exam. Ordered by `position`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `exam_id` | uuid NOT NULL | FK → `exams.id` ON DELETE CASCADE |
| `position` | int NOT NULL | 1-indexed within exam; UNIQUE (exam_id, position) |
| `type` | text NOT NULL | enum: `multiple_choice_single` \| `multiple_choice_multi` \| `true_false` \| `short_answer_exact` \| `free_response` |
| `prompt` | text NOT NULL | |
| `options` | jsonb | array of choice objects; NULL for `true_false`, `short_answer_exact`, `free_response` |
| `correct_answer` | jsonb | type-dependent shape (see below); NULL for `free_response` |
| `points` | int NOT NULL | > 0; default 1 |

`correct_answer` shapes:
- `multiple_choice_single`: `{ "option_id": "<uuid>" }`
- `multiple_choice_multi`: `{ "option_ids": ["<uuid>", ...] }` — match is exact-set.
- `true_false`: `{ "value": true | false }`
- `short_answer_exact`: `{ "accepted": ["paris", "Paris", "PARIS"] }` — normalized case-insensitive, trimmed.
- `free_response`: NULL — human-graded.

---

### 3. `student_face_references`

A student's stored face embedding used for identity verification. Raw images are never stored (see research R3).

| Field | Type | Notes |
|-------|------|-------|
| `student_id` | uuid PK | FK → `auth.users.id`; one reference per student |
| `embedding` | float4[] NOT NULL | length 128 (face-api.js descriptor) |
| `quality_score` | float | 0..1; from enrollment consistency check |
| `captured_at` | timestamptz NOT NULL | default now() |
| `replaced_at` | timestamptz | non-null when user re-enrolls (kept for audit; see RLS) |

**Validation**:
- `CHECK (array_length(embedding, 1) = 128)`
- `CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1))`

**RLS** (enforced in migration):
- Student may `INSERT` and `SELECT` their own row.
- No role except the student may `SELECT` the raw embedding; verification is performed via the `verify_student_identity` RPC, which returns only pass/fail + confidence, never the vector.

---

### 4. `verification_attempts`

Every face-verification attempt during join.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `student_id` | uuid NOT NULL | FK → `auth.users.id` |
| `exam_id` | uuid NOT NULL | FK → `exams.id` |
| `attempted_at` | timestamptz NOT NULL DEFAULT now() | server-authoritative |
| `outcome` | text NOT NULL | enum: `pass` \| `fail` \| `capture_error` |
| `confidence` | float | distance metric from embedding compare; NULL on `capture_error` |
| `counted_against_budget` | bool NOT NULL DEFAULT true | false for first-time-enrollment capture attempts |

**Validation**: `CHECK (outcome IN ('pass','fail','capture_error'))`

---

### 5. `exam_sessions`

A single student's sitting for one exam.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `exam_id` | uuid NOT NULL | FK → `exams.id` |
| `student_id` | uuid NOT NULL | FK → `auth.users.id` |
| `admitted_at` | timestamptz | server-authoritative; set when verification passes |
| `started_at` | timestamptz | set when student enters the question flow after admit |
| `submitted_at` | timestamptz | set at submission |
| `status` | text NOT NULL | enum: `awaiting_verification` \| `verification_blocked` \| `verified` \| `in_progress` \| `submitted` \| `auto_submitted` \| `terminated` |
| `live_cheating_score` | float NOT NULL DEFAULT 0 | 0..100 |
| `last_score_update_at` | timestamptz | for decay math |
| `submit_reason` | text | `manual` \| `auto_window_close` \| `auto_disconnect` \| NULL |
| `optimal_distance_cm` | numeric | calibrated baseline per FR-013a; written once at `start_exam_session`, immutable thereafter; NULL until then |
| `distance_tolerance_cm` | numeric | tolerance band around `optimal_distance_cm` per FR-013a; default 15 (or 20 on the FR-013b fallback path); written with `optimal_distance_cm` |
| `calibration_skipped` | boolean NOT NULL DEFAULT false | true when the FR-013b conservative defaults (50 ± 20) were applied because client-side calibration could not complete |

**Constraints**:
- `UNIQUE (exam_id, student_id) WHERE status NOT IN ('terminated','verification_blocked')` — one active session per student per exam.
- `CHECK (live_cheating_score >= 0 AND live_cheating_score <= 100)`
- `CHECK (optimal_distance_cm IS NULL OR (optimal_distance_cm BETWEEN 20 AND 100))`
- `CHECK (distance_tolerance_cm IS NULL OR (distance_tolerance_cm BETWEEN 5 AND 30))`
- `CHECK ((optimal_distance_cm IS NULL AND distance_tolerance_cm IS NULL) OR (optimal_distance_cm IS NOT NULL AND distance_tolerance_cm IS NOT NULL))` — both set together or both NULL.

**State transitions**:

```
awaiting_verification ─► verified ─► in_progress ─► submitted ─► (terminal)
                    │                          │
                    ├─► verification_blocked   ├─► auto_submitted (window close / disconnect)
                    │    (attempts exhausted)  │
                    └─► terminated (admin/instructor action at any point)
```

---

### 6. `violation_events`

A single detected integrity deviation within a session. Append-only.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid NOT NULL | FK → `exam_sessions.id` |
| `client_event_id` | text NOT NULL | client-generated, for idempotency |
| `type` | text NOT NULL | enum (from violation taxonomy) |
| `severity` | smallint NOT NULL | 1..25 (matches severity table in `violationScorer.ts`) |
| `client_captured_at` | timestamptz NOT NULL | client clock (diagnostic only) |
| `server_recorded_at` | timestamptz NOT NULL DEFAULT now() | authoritative |
| `evidence_artifact_id` | uuid | FK → `evidence_artifacts.id`; NULL if policy disables visual evidence |
| `metadata` | jsonb | type-specific details (e.g., gaze angle, detected face count) |

**Canonical violation types** (kept in sync with `src/types/examSession.ts`):
- `gaze_off_screen`
- `face_not_visible`
- `multiple_persons`
- `tab_focus_lost`
- `camera_unavailable`
- `face_too_close` — severity `low` (5); fires when live distance < `exam_sessions.optimal_distance_cm − distance_tolerance_cm` (FR-013a/c)
- `face_too_far` — severity `low` (5); fires when live distance > `exam_sessions.optimal_distance_cm + distance_tolerance_cm` (FR-013a/c)
- `audio_anomaly` (reserved; not in v1 detection scope)

**Uniqueness**: `UNIQUE (session_id, client_event_id)` — enforces idempotent batch uploads (research R10).

---

### 7. `evidence_artifacts`

Optional short clip/snapshot captured around a high-severity violation.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid NOT NULL | FK → `exam_sessions.id` |
| `bucket_path` | text NOT NULL | path within the `evidence-snippets` Supabase Storage bucket |
| `captured_at` | timestamptz NOT NULL | server-side recorded |
| `expires_at` | timestamptz NOT NULL | default `captured_at + interval '30 days'` |
| `retained_for_case` | bool NOT NULL DEFAULT false | set true by instructor action to bypass purge |
| `content_type` | text NOT NULL | e.g., `image/jpeg`, `video/webm` |
| `byte_length` | int NOT NULL | |

**Invariants**:
- Row exists only if the exam's `proctoring_policy.visual_evidence_allowed = true` at time of capture.
- Nightly Edge Function deletes rows AND bucket objects where `expires_at < now() AND NOT retained_for_case`.

---

### 8. `submissions`

Final state of a student's answers for an exam. One row per session on transition to `submitted` / `auto_submitted`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid NOT NULL UNIQUE | FK → `exam_sessions.id` |
| `exam_id` | uuid NOT NULL | FK → `exams.id` (denormalized for instructor queries) |
| `student_id` | uuid NOT NULL | FK → `auth.users.id` (denormalized) |
| `submitted_at` | timestamptz NOT NULL DEFAULT now() | server-authoritative |
| `submit_reason` | text NOT NULL | `manual` \| `auto_window_close` \| `auto_disconnect` |
| `auto_graded_score` | numeric | points earned on auto-graded items; NULL if no auto-gradable items |
| `auto_graded_max` | numeric | points possible on auto-graded items |
| `final_grade` | numeric | populated when `grade_status = 'auto_final'` or after instructor review |
| `grade_status` | text NOT NULL | enum: `auto_final` \| `partial_pending_review` \| `fully_pending_review` |
| `final_cheating_score` | float NOT NULL | snapshot of `live_cheating_score` at submission |
| `evidence_package_id` | uuid | FK → `evidence_packages.id`; set when assembly completes |

**Uniqueness**: `UNIQUE (session_id)` — a session submits exactly once. Duplicate submit attempts are absorbed by the `submit_exam` RPC via `ON CONFLICT DO NOTHING`.

---

### 9. `student_answers`

Per-question answers recorded during the session. Upsert on change; final snapshot is frozen at submission.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid NOT NULL | FK → `exam_sessions.id` |
| `question_id` | uuid NOT NULL | FK → `exam_questions.id` |
| `answer` | jsonb NOT NULL | type-specific shape mirroring `correct_answer` |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | |
| `frozen_at` | timestamptz | set at submission; after this, row is immutable |

**Uniqueness**: `UNIQUE (session_id, question_id)` — one row per question per session.

---

### 10. `evidence_packages`

Instructor-ready bundle assembled at submission. Thin pointer; content is derived/assembled, not stored redundantly.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `submission_id` | uuid NOT NULL UNIQUE | FK → `submissions.id` |
| `assembled_at` | timestamptz NOT NULL DEFAULT now() | |
| `violation_summary` | jsonb NOT NULL | `{ by_type: {type: count}, total_count: int, max_severity: int }` |
| `timeline_version` | int NOT NULL DEFAULT 1 | bumps if the instructor re-assembles after metadata edits |

The full timeline is retrieved by joining `violation_events` for the session; this row exists to provide an assembly audit trail and to version summaries.

---

### 11. `instructor_alerts`

Real-time-raised alert rows. The Supabase Realtime subscription feeding the oversight dashboard is filtered on `exam_id` → instructor's owned exams.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `exam_id` | uuid NOT NULL | FK → `exams.id` (for channel filtering + RLS) |
| `session_id` | uuid NOT NULL | FK → `exam_sessions.id` |
| `reason` | text NOT NULL | `critical_score_sustained` \| `camera_lost` \| `verification_failed_hard` \| `multiple_persons` |
| `raised_at` | timestamptz NOT NULL DEFAULT now() | |
| `acknowledged_at` | timestamptz | null until instructor acknowledges |
| `acknowledged_by` | uuid | FK → `auth.users.id` |

---

## Relationship Diagram

```
auth.users (instructor)───1:N──┐
                                ├──► exams ──1:N──► exam_questions
                                │     │
                                │     └──1:N──► exam_sessions ──1:1──► submissions ──1:1──► evidence_packages
                                │                     │
                                │                     ├──1:N──► violation_events ──0..1──► evidence_artifacts
                                │                     ├──1:N──► student_answers
                                │                     └──1:N──► instructor_alerts
                                │
                                └───1:N──► verification_attempts

auth.users (student) ──1:1──► student_face_references
auth.users (student) ──1:N──► exam_sessions
auth.users (student) ──1:N──► verification_attempts
```

## Validation Rules Cross-Referenced with Functional Requirements

| FR | Enforced by |
|----|-------------|
| FR-001 (exam fields) | `exams` column NOT NULLs + `proctoring_policy` jsonb shape check |
| FR-002 (≥ 1 question before publish) | `publish_exam` RPC guard |
| FR-003 (unique code) | `UNIQUE` index on `exams.access_code` where status = 'published' |
| FR-004 (code invalidation) | `close_exam` RPC sets `access_code = NULL` |
| FR-007 (reject invalid/expired) | `join_exam` RPC validates code + window + existing session |
| FR-008 (require verification) | `exam_sessions.admitted_at` is NULL until `verify_student_identity` RPC returns pass |
| FR-010 (bounded retries) | `max_verification_attempts` in `proctoring_policy`; RPC counts against budget |
| FR-012 (admit record) | `verification_attempts` row + `exam_sessions.admitted_at` |
| FR-014 (violation categorization) | `violation_events.type` + `severity` |
| FR-015 (decay aggregate) | `exam_sessions.live_cheating_score` updated via `record_violation_batch` RPC |
| FR-018 (offline buffering) | `violation_events.client_event_id` UNIQUE (idempotent replay) |
| FR-020 (no snippets under policy) | Check in `record_violation_batch` — artifact row rejected if policy disallows |
| FR-022 (auto-submit on close) | Scheduled Edge Function runs `auto_submit_expired_sessions` |
| FR-023 (auto-grade) | `submit_exam` RPC computes `auto_graded_score` |
| FR-025 (evidence package) | `evidence_packages` row assembled in `submit_exam` RPC |
| FR-027 (idempotent delivery) | `submissions` UNIQUE on `session_id`; RPC uses ON CONFLICT |
| FR-029 (instructor access only) | RLS policies on all tables: `exam.instructor_id = auth.uid()` for instructor reads |
| FR-030 (no raw frames) | `student_face_references.embedding` only; no image column; bucket policy |
| FR-031 (server clock) | All admit/submit timestamps populated by Postgres `now()` inside RPCs |

## Indexes (beyond primary keys and uniqueness)

- `exams (instructor_id, status)` — instructor dashboard listing
- `exam_sessions (exam_id, status)` — proctoring dashboard live list
- `exam_sessions (student_id, status)` — student's active-exams screen
- `violation_events (session_id, server_recorded_at)` — timeline assembly + realtime change feed
- `violation_events (server_recorded_at)` — nightly purge job
- `instructor_alerts (exam_id, acknowledged_at)` — dashboard filtering
- `evidence_artifacts (expires_at) WHERE NOT retained_for_case` — purge job scan
- `submissions (exam_id, submitted_at)` — instructor results view
