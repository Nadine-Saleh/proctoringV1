---

description: "Task list for feature 001-ai-proctoring-system"
---

# Tasks: Secure AI Proctoring System

**Input**: Design documents from `/specs/001-ai-proctoring-system/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Included by mandate of Constitution Principle II (NON-NEGOTIABLE) — integrity-critical paths (scoring, session lifecycle, submission, persistence) MUST have test coverage; integration tests MUST hit the Supabase test project (no DB mocking). Tests for purely presentational components are omitted per the same principle's "optional coverage" clause.

**Organization**: Tasks are grouped by user story for independent delivery. This is an **extension of an existing codebase** (React + Supabase), so many tasks modify or complete existing files rather than create greenfield scaffolding — each task's file path makes this explicit.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1–US4); absent for Setup / Foundational / Polish
- Each task includes an exact file path so it can be executed without additional context

## Path Conventions

Existing single-project layout (see plan.md §Project Structure): `src/` for the SPA, `supabase/` for schema + functions, `tests/` (new) at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the testing stack (Constitution Principle II prerequisite) and environment scaffolding. This phase has zero behavioral code changes.

- [X] T001 Add Vitest + Testing Library dev dependencies and wire scripts (`test`, `test:watch`, `test:detection`) in `package.json`
- [X] T002 [P] Add Playwright dev dependency, create `playwright.config.ts` at repo root with Chromium + fake-media-stream flags, add `test:e2e` script in `package.json`
- [X] T003 [P] Create `vitest.config.ts` at repo root with `jsdom` environment, `tests/setup.ts` preload, and environment-isolation guard (abort if `VITE_SUPABASE_URL` matches dev URL)
- [X] T004 [P] Create `tests/setup.ts` with Supabase test-client bootstrap, test-user seeding helpers, and per-test teardown
- [X] T005 [P] Create `tests/` directory tree: `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/fixtures/gaze-corpus/`, `tests/fixtures/scored-sessions/` (with placeholder `.gitkeep` files)
- [X] T006 Document `.env.test` requirements and Supabase test-project setup in `specs/001-ai-proctoring-system/quickstart.md` (already present — verify it matches the finalized setup script names)

**Checkpoint**: `npm run test` and `npm run test:e2e` execute with zero tests and exit cleanly. No behavior has changed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, canonical types, shared utilities, and infrastructure decisions that every user story depends on.

**⚠️ CRITICAL**: No user-story phase may begin until this phase is complete.

- [X] T007 Create migration `supabase/migrations/006_access_codes_and_submissions.sql` adding columns/tables: `exams.access_code`, `exams.proctoring_policy`, `exams.published_at`, `exams.closed_at`; new tables `student_face_references`, `verification_attempts`, `evidence_artifacts`, `evidence_packages`, `submissions` per `specs/001-ai-proctoring-system/data-model.md`. Note: `violation_events` and `instructor_alerts` tables are pre-existing in migrations 004/005 and are extended (new columns) by migration 006; they are not created fresh here.
- [X] T008 Add partial unique index on `exams.access_code WHERE status = 'published'` and indexes listed in `specs/001-ai-proctoring-system/data-model.md` §Indexes inside `supabase/migrations/006_access_codes_and_submissions.sql`
- [X] T009 Create migration `supabase/migrations/007_rls_policies_proctoring_v2.sql` with RLS policies for the five new tables (student-owned SELECT/INSERT on `student_face_references` and `verification_attempts`; instructor SELECT via `exams.instructor_id = auth.uid()` for `submissions`, `evidence_packages`, `evidence_artifacts`)
- [X] T010 [P] Create Crockford Base32 access-code generator as a Postgres function `generate_access_code()` in `supabase/migrations/006_access_codes_and_submissions.sql` (8 chars, excludes `I/L/O/U`, collision-checked against `exams WHERE status='published'`)
- [X] T011 [P] Define canonical violation taxonomy (types + severity table) in `src/types/examSession.ts` — single source of truth consumed by `violationScorer.ts`, `record_violation_batch` RPC validator, student UI, and instructor UI
- [X] T011a Update `src/types/examSession.ts` taxonomy: change `face_too_close` severity from `10` → `5` and `face_too_far` severity from `10` → `5` per FR-013c / research R12. The two distance violation types remain in the canonical enum but at `low` weight so noisy `calibration_skipped = true` sessions cannot saturate the live cheating score on posture alone.
- [X] T012 [P] Rewrite `src/utils/violationScorer.ts` to implement severity-weighted exponential decay per `research.md` R4 (half-life = 60 s; clamp `[0, 100]`; thresholds read from per-exam `proctoring_policy`)
- [X] T013 [P] Create `src/utils/idempotency.ts` helper for generating and reconciling `client_event_id` values used by offline buffering
- [X] T014 Create Supabase Storage bucket `evidence-snippets` (private) and attach storage policies in `supabase/migrations/006_access_codes_and_submissions.sql` or a co-located policy file
- [X] T015 Delete `src/services/WebSocketService.ts` and migrate its single caller (`src/pages/instructor/Proctoring.tsx`) to a Supabase Realtime subscription stub — per `research.md` R2; the full Realtime wiring lands in US3
- [X] T016 Add typecheck + lint + build CI gate in `.github/workflows/ci.yml` (or the project's existing CI file) running `npm run typecheck`, `npm run lint`, `npm run build` on every PR

**Checkpoint**: Migrations apply cleanly to the test Supabase project; `npm run typecheck && npm run lint && npm run build` pass; violation taxonomy exported from a single module.

---

## Phase 3: User Story 1 — Instructor Authors an Exam and Generates an Access Code (Priority: P1) 🎯 MVP

**Goal**: Instructor can create, publish, and review an exam; on publish, a unique 8-char access code is generated and displayed on the exam detail page.

**Independent Test**: An instructor account creates an exam with ≥ 1 question, publishes it, and receives an access code. The code is unique across currently-published exams and visible on the instructor dashboard. (spec.md §User Story 1 Independent Test)

### Tests for User Story 1

> **Write these tests FIRST and confirm they FAIL before implementation.**

- [X] T017 [P] [US1] Integration test in `tests/integration/exam-publish-access-code.test.ts`: publish an exam, assert `access_code` is 8 chars, Crockford Base32 alphabet, and unique against concurrently published exams
- [X] T018 [P] [US1] Integration test in `tests/integration/exam-publish-guards.test.ts`: attempt to publish without a question → RPC returns error; publish with duration ≤ 0 → error
- [X] T018a [P] [US1] Integration test in `tests/integration/exam-publish-min-duration.test.ts`: attempt to publish with `duration_minutes < 5` → RPC returns `duration_below_minimum` (FR-002); publish with `duration_minutes = 5` succeeds
- [X] T019 [P] [US1] Unit test in `tests/unit/access-code-format.test.ts`: assert the Crockford Base32 alphabet generator rejects `I/L/O/U` and has the expected length
- [X] T020 [P] [US1] E2E test in `tests/e2e/instructor-publish-exam.spec.ts`: log in as instructor, fill create-exam form, publish, assert code visible on detail page

### Implementation for User Story 1

- [X] T021 [US1] Extend `src/services/ExamService.ts` with `createExam`, `updateExam`, `publishExam`, `closeExam` that map to the Postgres RPCs `create_exam`, `update_exam`, `publish_exam`, `close_exam`
- [X] T022 [P] [US1] Add Postgres RPC `publish_exam(exam_id uuid)` in `supabase/migrations/006_access_codes_and_submissions.sql` that validates `≥ 1 question` and `duration_minutes ≥ 5` (FR-002), calls `generate_access_code()`, sets `status='published'`, `published_at=now()`. Returns `duration_below_minimum` when the duration guard fails.
- [X] T023 [P] [US1] Add Postgres RPC `close_exam(exam_id uuid)` that sets `status='closed'`, `closed_at=now()`, and invalidates `access_code` (sets NULL)
- [X] T024 [US1] Wire `src/pages/instructor/CreateExam.tsx` to `ExamService.createExam` / `publishExam`; add the proctoring-policy form fields (`visual_evidence_allowed`, warning/critical thresholds, `critical_sustain_seconds`, `max_verification_attempts`)
- [X] T025 [US1] Update `src/pages/instructor/Dashboard.tsx` to list exams with columns: status, access code (when published), joined / in-progress / submitted counts; aggregate counts via a single `list_my_exams()` RPC to avoid N+1 queries
- [X] T026 [P] [US1] Add Postgres RPC `list_my_exams()` returning `exams` rows joined with session count aggregates, gated by `instructor_id = auth.uid()`, in `supabase/migrations/006_access_codes_and_submissions.sql`
- [X] T027 [US1] Add instructor exam-detail view at `src/pages/instructor/ExamDetail.tsx` (new file) wired to `/instructor/exams/:examId` route — displays title, window, access code, counts; copy-to-clipboard for the code
- [X] T028 [US1] Register the new route in `src/App.tsx` behind `ProtectedRoute` with role `instructor`

**Checkpoint**: US1 fully functional independently. Instructor can publish an exam, see the code, and share it. No student-facing code has been touched. All US1 tests pass.

---

## Phase 4: User Story 2 — Student Joins an Exam by Code and Passes Identity Verification (Priority: P1)

**Goal**: A student enters a valid code, grants camera permission, completes a face-recognition identity check against their stored reference embedding, and is admitted to the exam start screen. First-time students go through a reference-capture flow before verification attempts count.

**Independent Test**: A student account with a stored reference face joins an exam using a valid code and is admitted on the first verification attempt; the session row shows `verified` and an `admitted_at` timestamp. (spec.md §User Story 2 Independent Test)

### Tests for User Story 2

- [X] T029 [P] [US2] Integration test in `tests/integration/join-exam-codes.test.ts`: invalid code, expired window, closed exam, and double-active-session all yield distinct error codes per `contracts/rpc-start-session.md`
- [X] T030 [P] [US2] Integration test in `tests/integration/verify-identity-happy-path.test.ts`: seed a `student_face_references` row, call `verify_student_identity` with a matching embedding, assert `outcome='pass'`, session moves to `verified`, `verification_attempts` row recorded
- [X] T031 [P] [US2] Integration test in `tests/integration/verify-identity-budget.test.ts`: exhaust `max_verification_attempts`, assert status moves to `verification_blocked` and an `instructor_alerts` row with `reason='verification_failed_hard'` is raised
- [X] T032 [P] [US2] Integration test in `tests/integration/verify-identity-first-capture-free.test.ts`: first verification after fresh reference capture does NOT count against the retry budget (FR-009 / R11)
- [X] T033 [P] [US2] Integration test in `tests/integration/rls-face-references.test.ts`: student A cannot SELECT student B's `student_face_references` row; instructor cannot SELECT any student's embedding
- [X] T034 [P] [US2] E2E test in `tests/e2e/student-join-verify.spec.ts`: student enters code → reference capture (three frames) → verification pass → lands on ready screen
- [X] T034a [P] [US2] Integration test in `tests/integration/start-session-calibration-write.test.ts`: call `start_exam_session` with `{ optimal_distance_cm: 47, distance_tolerance_cm: 15, calibration_skipped: false }`; assert the three columns are written verbatim onto `exam_sessions`, the response echoes them, and a second call returns `session_already_started` with the original calibration unchanged (immutability per FR-013a)
- [X] T034b [P] [US2] Integration test in `tests/integration/start-session-calibration-fallback.test.ts`: call `start_exam_session` with `{ calibration_skipped: true }` (no distance fields); assert `optimal_distance_cm = 50`, `distance_tolerance_cm = 20`, `calibration_skipped = true` are written per FR-013b
- [X] T034c [P] [US2] Integration test in `tests/integration/start-session-calibration-invalid.test.ts`: call `start_exam_session` with out-of-range values (`optimal_distance_cm = 5` or `distance_tolerance_cm = 50`) and `calibration_skipped = false`; assert error code `calibration_invalid` and no row mutation

### Implementation for User Story 2

- [X] T035 [P] [US2] Add Postgres RPC `join_exam(access_code text)` in `supabase/migrations/006_access_codes_and_submissions.sql` per `contracts/rpc-start-session.md` §join_exam. Note: `list_my_sessions()` RPC (required by T044) is also implemented in this migration at line 796 and tracked here for traceability.
- [X] T036 [P] [US2] Add Postgres RPC `verify_student_identity(session_id uuid, embedding float4[])` that compares against `student_face_references.embedding` using Euclidean distance, enforces retry budget, writes `verification_attempts` row, transitions session status, and raises `instructor_alerts` on hard block
- [X] T037 [P] [US2] Add Postgres RPC `start_exam_session(session_id uuid)` that transitions `verified → in_progress`, stamps `exam_started_at = now()` server-side (the authoritative exam clock origin per FR-002a — verification time is excluded from the student's exam duration), and returns the question list without `correct_answer` fields
- [X] T037a [US2] Create migration `supabase/migrations/009_distance_calibration.sql` adding distance calibration columns to `exam_sessions` adding columns `optimal_distance_cm numeric`, `distance_tolerance_cm numeric`, `calibration_skipped boolean NOT NULL DEFAULT false` to `public.exam_sessions` per `data-model.md` §5. Include CHECK constraints: `optimal_distance_cm BETWEEN 20 AND 100`, `distance_tolerance_cm BETWEEN 5 AND 30`, and the paired-NULL invariant (both set or both NULL). Backfill is unnecessary — defaults handle existing rows.
- [X] T037b [US2] Update the `start_exam_session` RPC in `supabase/migrations/009_distance_calibration.sql` to accept `p_calibration jsonb` (or extend its definition in 006 via `CREATE OR REPLACE FUNCTION`) to accept a second parameter `p_calibration jsonb` per `contracts/rpc-start-session.md`. Implement: (a) validate `p_calibration.calibration_skipped` is boolean; (b) when false, require `optimal_distance_cm` and `distance_tolerance_cm` in the documented ranges or return `calibration_invalid`; (c) when true, write server defaults `50` and `20`; (d) write all three columns once, treat second-call as idempotent (`session_already_started` returns existing values unchanged); (e) echo the three calibration fields in the response payload alongside `started_at` and `status`.
- [X] T037c [P] [US2] Create `src/services/DistanceCalibrationService.ts` (new) exposing `submitCalibration(sessionId, payload)` that wraps the `start_exam_session` RPC call with the calibration JSON. Two helpers: `fromCalibratedDistance(cm)` → `{ optimal_distance_cm: cm, distance_tolerance_cm: 15, calibration_skipped: false }` and `asSkipped()` → `{ calibration_skipped: true }`. Surfaces RPC errors (`calibration_invalid`, etc.) as typed return values.
- [X] T038 [US2] Create `src/services/IdentityVerificationService.ts` that (a) loads face-api.js models lazily, (b) extracts a 128-dim embedding from a `HTMLVideoElement` frame, (c) calls `verify_student_identity` RPC
- [X] T039 [P] [US2] Create `src/hooks/useReferenceCapture.ts` that captures three on-demand frames, extracts embeddings, asserts pairwise similarity, and inserts the median embedding into `student_face_references`
- [X] T040 [US2] Refactor `src/hooks/useExamSession.ts` to expose the full state machine (`awaiting_verification → verified → in_progress → submitted`) and wire it to the three join/verify/start RPCs. Note: client-side heartbeat mechanism (required by FR-022a for disconnect detection) is implemented here via `src/utils/SessionHeartbeat.ts` — sends `last_heartbeat_at` updates every 30 s; T077 reads this field to detect long-disconnected sessions.
- [X] T040a [US2] Wire `src/pages/student/Exam.tsx` so the existing `DistanceSetupModal.onComplete(distance)` callback now calls `DistanceCalibrationService.submitCalibration(sessionId, fromCalibratedDistance(distance))` instead of only setting client state. On modal abort or detection failure, fall back to `submitCalibration(sessionId, asSkipped())`. Remove the local `optimalDistanceCm` React state (the source of truth is now the persisted session field returned in `start_exam_session`'s response, which `useExamSession` exposes).
- [X] T041 [US2] Create `src/pages/student/JoinExam.tsx` (new) wired to `/exam/join`: access-code input + join CTA
- [X] T042 [US2] Create `src/pages/student/VerifyIdentity.tsx` (new) wired to `/exam/:sessionId/verify`: privacy notice (FR-032) → reference capture (if needed) → live verification → retries with guidance on failure
- [X] T043 [US2] Create `src/pages/student/ReadyToStart.tsx` (new) wired to `/exam/:sessionId/ready`: "you are verified — begin?" confirmation; camera inactive on this screen
- [X] T044 [US2] Wire `src/pages/student/Home.tsx` to route into `/exam/join` and list the student's active/past sessions via a `list_my_sessions()` RPC
- [X] T045 [US2] Register new student routes in `src/App.tsx` behind `ProtectedRoute` with role `student`; ensure session-status mismatch redirects (e.g., `in_progress` → `/exam/:sessionId`, not `/verify`)

**Checkpoint**: US2 functional independently on top of US1. A student can join an exam, pass identity verification, and land on the ready screen. No monitoring code yet; no submission code yet. All US2 tests pass.

---

## Phase 5: User Story 3 — Real-Time Behavior Monitoring and Cheating Score (Priority: P1)

**Goal**: During an active session, the system continuously detects gaze, face presence, additional persons, tab/focus loss, and camera availability; records violation events; maintains a server-authoritative cheating score that streams to the instructor dashboard in near real time. Student receives graduated non-blocking warnings.

**Independent Test**: A verified student begins the exam and deliberately triggers representative violations (gaze off, tab switch, second face). Each event is logged with timestamp + category; the cheating score increases; the instructor dashboard reflects the score within 5 seconds. (spec.md §User Story 3 Independent Test; SC-003)

### Tests for User Story 3

- [X] T046 [P] [US3] Unit test in `tests/unit/violationScorer.test.ts`: canonical enum severity weights map correctly for `low`/`medium`/`high`/`critical`, decay follows the configured half-life, total score clamps to `[0, 100]`, and simultaneous events remain additive
- [X] T047 [P] [US3] Unit test in `tests/unit/CheatingScoreService.test.ts`: threshold crossings emit the right warning/critical signals only after `critical_sustain_seconds` sustained
- [X] T048 [P] [US3] Integration test in `tests/integration/record-violation-idempotent.test.ts`: replaying the same `client_event_id` twice inserts exactly one row; `deduplicated` counter in response equals 1
- [X] T048a [P] [US3] Integration test in `tests/integration/record-violation-session-state-guard.test.ts`: calling `record_violation_batch` for a session not in `in_progress` returns `session_not_in_progress`, inserts no `violation_events` rows, and leaves score/alerts unchanged
- [X] T049 [P] [US3] Integration test in `tests/integration/record-violation-policy-guard.test.ts`: uploading an evidence-attached event under a `visual_evidence_allowed=false` policy rejects the entire batch with `evidence_policy_violation`
- [X] T050 [P] [US3] Integration test in `tests/integration/alerts-critical-sustained.test.ts`: score crossing critical for < sustain_seconds does NOT raise alert; crossing for ≥ sustain_seconds DOES raise exactly one alert
- [X] T051 [P] [US3] Integration test in `tests/integration/alerts-camera-loss.test.ts`: any `camera_unavailable` event raises an `instructor_alerts` row with `reason='camera_lost'` regardless of score
- [X] T052 [P] [US3] Detection-fixture benchmark in `tests/fixtures/scored-sessions/benchmark.test.ts`: replay recorded sessions through `violationScorer`; assert recall ≥ 90% and false-positive rate ≤ 10% against ground truth (SC-005)
- [X] T053 [P] [US3] E2E test in `tests/e2e/monitor-during-exam.spec.ts`: verified student triggers tab-blur and gaze-off; instructor tab observes score updates on the Realtime channel within 5 s
- [X] T053a [P] [US3] Unit test in `tests/unit/violationScorer-distance-severity.test.ts`: assert `face_too_close` and `face_too_far` are scored at severity 5 (per FR-013c / R12) and that 10 consecutive distance events do not push the live score past the warning threshold of 40 — guards against the regression the old severity-10 setting would have produced on a `calibration_skipped = true` session
- [X] T053b [P] [US3] Integration test in `tests/integration/distance-violation-uses-baseline.test.ts`: seed an `exam_sessions` row with `optimal_distance_cm = 45`, `distance_tolerance_cm = 15`; submit a `face_too_close` event with `metadata.estimated_distance_cm = 25` (below `45 − 15 = 30`); assert `record_violation_batch` accepts the event. Then submit a `face_too_close` with `estimated_distance_cm = 35` (within band) and assert it is rejected with `out_of_band` (or scored as zero — whichever the RPC implementation chooses; both are acceptable per the contract). Confirms there is exactly one source of truth for distance triggering.
- [X] T053c [P] [US3] E2E test in `tests/e2e/distance-calibration-end-to-end.spec.ts`: student completes `DistanceSetupModal`, submits calibration via `start_exam_session`, leans into the camera (mocked via fake-media-stream feeding a close-up face), assert a `face_too_close` event is emitted with `metadata.baseline_cm = <calibrated value>` and reaches the instructor dashboard within 5 s

### Implementation for User Story 3

- [X] T054 [US3] Add Postgres RPC `record_violation_batch(session_id uuid, events jsonb)` in `supabase/migrations/006_access_codes_and_submissions.sql` per `contracts/rpc-record-violation.md`: validates types against canonical taxonomy, enforces policy guard, recomputes score (decay on server), writes `violation_events` with `ON CONFLICT DO NOTHING`, raises `instructor_alerts` per the rules
- [X] T055 [P] [US3] Rewrite `src/services/ViolationEventService.ts` to batch events (every 2 s OR 50 events), persist to IndexedDB on network failure, and drain with retained `client_event_id` on reconnect per `research.md` R10
- [X] T056 [P] [US3] Refactor `src/services/CheatingScoreService.ts` to (a) consume authoritative `live_cheating_score` from `record_violation_batch` responses, (b) surface warning/critical state to hooks, (c) NOT compute its own score locally
- [X] T057 [P] [US3] Enhance `src/hooks/useGazeTracking.ts` to emit `gaze_off_screen` events when yaw/pitch exceed configured thresholds for the duration gate from the exam's `proctoring_policy`
- [X] T058 [P] [US3] Enhance `src/hooks/useFaceDetection.ts` to emit `face_not_visible`, `multiple_persons`, and `camera_unavailable` events with correct severities from the canonical taxonomy
- [X] T059 [P] [US3] Add `src/hooks/useTabFocusTracker.ts` (new) emitting `tab_focus_lost` events on `visibilitychange` / `blur`
- [X] T060 [US3] Refactor `src/hooks/useProctoring.ts` to orchestrate the above detection hooks and funnel all events through `ViolationEventService`. Note: evidence snippet capture during monitoring (FR-014) is implemented here via `captureViolationSnapshot()` — captures a frame at violation time and attaches it to the event when `visual_evidence_allowed=true` in the exam policy. Snippet upload via signed PUT URLs is provided by T060a (also US3) so US3 is independently deployable end-to-end.
- [X] T060b [US3] Refactor distance-violation emission in `src/hooks/useProctoring.ts` (lines 222–242): **delete** the hardcoded `faceRatio > 0.15` (too-close) and `faceRatio < 0.03` (too-far) branches. Instead, accept `optimal_distance_cm` and `distance_tolerance_cm` props (sourced from the session via `useExamSession`); convert the live face-detection box → estimated cm using the same formula `DistanceSetupModal.estimateFaceDistance` already uses (`Math.round(15 / (boxSize / 640))` clamped to `[20, 100]`); emit `face_too_close` when `estimated < optimal − tolerance` and `face_too_far` when `estimated > optimal + tolerance`. Include `{ baseline_cm, tolerance_cm, estimated_distance_cm }` in event `metadata`. Per FR-013a / R12, this becomes the sole authoritative trigger for these two violation types.
- [X] T060a [P] [US3] Create `src/services/EvidenceSnippetService.ts` (new) with the upload half only: requests signed PUT URLs from Supabase Storage and uploads captured snippets when `visual_evidence_allowed=true`. The signed-GET (playback) half is implemented in T080 under US4. Pulled forward from US4 to keep the US3 checkpoint genuinely independent.
- [X] T061 [US3] Refactor `src/hooks/useViolationTracker.ts` to aggregate events and read the authoritative score from `CheatingScoreService`; remove any local scoring logic
- [X] T062 [US3] Wire `src/pages/student/Exam.tsx` to display graduated non-blocking warnings when `CheatingScoreService` reports `warning_threshold_crossed` or on individual severity ≥ 10 events (FR-016)
- [X] T063 [US3] Wire `src/pages/instructor/Proctoring.tsx` to subscribe to Supabase Realtime channel `oversight:exam:<examId>` per `contracts/realtime-channels.md`; display per-session score tiles + alert feed; implement reconnection reconciliation query
- [X] T063a [P] [US3] In `src/pages/instructor/Proctoring.tsx`, on each per-session score tile, render a "Calibration skipped" badge (small orange chip with `ArrowLeftRight` lucide icon) when the session has `calibration_skipped = true` per FR-013b. Also surface the persisted `optimal_distance_cm` value in the tile's expanded view so reviewers know which baseline produced the distance violations they are seeing.
- [X] T064 [US3] Ensure camera lifecycle cleanup in `src/pages/student/Exam.tsx` (`useEffect` teardown releases MediaStream tracks on unmount / navigation / submit)
- [X] T064a [US3] Add instructor-invoked explicit session termination control (FR-020a): implement `ExamSessionService.terminateByInstructor(sessionId)` in `src/services/examSessionService.ts`; add a "Terminate Session" button (shown only on `in_progress` sessions) with a confirmation modal in `src/pages/instructor/Proctoring.tsx`; on confirm, call the service method and reflect `terminated` status in local session state
- [X] T065 [P] [US3] Populate `tests/fixtures/gaze-corpus/` with a minimum of 30 short recorded-frame clips + annotations covering each violation type (this is the ground-truth corpus Principle II demands)
- [X] T066 [P] [US3] Populate `tests/fixtures/scored-sessions/` with 10 end-to-end recorded sessions + expected violation timelines for the benchmark in T052
- [X] T067 [US3] Add Chrome DevTools Performance trace evidence to a new `docs/perf-baseline.md` measuring detection-loop fps and main-thread p95 on a baseline laptop (Constitution Principle IV — measurement, not guessing)

**Checkpoint**: US3 functional independently given US1 + US2. Instructor observes live score updates; students see warnings; events persist through offline windows; benchmark meets SC-005 targets.

---

## Phase 6: User Story 4 — Submission Delivers Grade and Flagged Evidence to the Instructor (Priority: P2)

**Goal**: Student submission (manual or auto) finalizes answers, computes auto-gradable grade, assembles evidence package, and delivers both to the instructor dashboard idempotently.

**Independent Test**: A student completes an exam with at least two flagged incidents and submits. The instructor dashboard shows the final grade, ordered flagged-incident timeline, and (if policy permits) playable evidence snippets within 60 s of submission. (spec.md §User Story 4 Independent Test; SC-004)

### Tests for User Story 4

- [X] T068 [P] [US4] Integration test in `tests/integration/submit-exam-idempotent.test.ts`: calling `submit-exam` twice for the same session returns the same submission_id with `idempotent_hit=true` on the second call; exactly one `submissions` row exists
- [X] T069 [P] [US4] Integration test in `tests/integration/submit-exam-auto-grading.test.ts`: MCQ/T-F/short-answer auto-grading matches expected scores per `research.md` R8; free-response items land in `grade_status='partial_pending_review'`
- [X] T070 [P] [US4] Integration test in `tests/integration/submit-exam-auto-window-close.test.ts`: invoke `auto_submit_expired_sessions` after the window closes; verified/in-progress sessions move to `auto_submitted` with `submit_reason='auto_window_close'`
- [X] T071 [P] [US4] Integration test in `tests/integration/submit-exam-evidence-package.test.ts`: after submission, an `evidence_packages` row exists with `violation_summary` matching the `violation_events` aggregate; a corresponding `submission_ready` Realtime event fires on `oversight:exam:<examId>`
- [X] T072 [P] [US4] Integration test in `tests/integration/evidence-retention-purge.test.ts`: an `evidence_artifacts` row past `expires_at` with `retained_for_case=false` is deleted by the purge job; bucket object is removed; rows with `retained_for_case=true` survive
- [X] T073 [P] [US4] Integration test in `tests/integration/policy-no-snippets-audit.test.ts`: across sessions with `visual_evidence_allowed=false`, zero rows exist in `evidence_artifacts` and zero objects in the bucket (SC-010 audit)
- [X] T074 [P] [US4] E2E test in `tests/e2e/submission-delivery.spec.ts`: student submits; instructor sees grade + timeline + playable snippet within 60 s

### Implementation for User Story 4

- [X] T075 [US4] Create Supabase Edge Function `supabase/functions/submit-exam/index.ts` per `contracts/rpc-submit-exam.md`: freezes answers, computes auto-grade, assembles evidence package, inserts `submissions` with `ON CONFLICT DO NOTHING`, transitions session status
- [X] T076 [P] [US4] Add auto-grading utility in `src/utils/autoGrade.ts` (or server-side helper in the Edge Function) implementing comparison for `multiple_choice_single`, `multiple_choice_multi`, `true_false`, `short_answer_exact`
- [X] T077 [US4] Create Supabase Edge Function `supabase/functions/auto-submit-expired/index.ts` (scheduled on a 60 s cron) that selects expired or long-disconnected sessions and POSTs to `submit-exam` with the service-role key; `submit_reason='auto_window_close'` or `'auto_disconnect'`
- [X] T078 [P] [US4] Create Supabase Edge Function `supabase/functions/purge-expired-evidence/index.ts` (scheduled nightly) that deletes `evidence_artifacts` rows past `expires_at` with `retained_for_case=false` and their bucket objects
- [X] T079 [US4] Refactor `src/services/ExamSubmissionService.ts` to invoke the `submit-exam` Edge Function, handle `idempotent_hit`, and surface user-friendly success/error states
- [X] T080 [P] [US4] Extend `src/services/EvidenceSnippetService.ts` (created in T060a) with the playback half: requests signed GET URLs for the instructor `SubmissionDetail.tsx` view (T084). The upload half is already in place from T060a.
- [X] T081 [US4] Wire `src/pages/student/Exam.tsx` "Submit" button to `ExamSubmissionService`; show success confirmation with the returned `submission_id`
- [X] T082 [US4] Wire `src/pages/student/Results.tsx` to display the student's own grade + status (never the evidence details — those are instructor-only)
- [X] T083 [US4] Wire `src/pages/instructor/Results.tsx` to list submissions for an exam (grade, final_cheating_score, grade_status) via a `list_exam_submissions(exam_id)` RPC gated by instructor ownership
- [X] T084 [US4] Create `src/pages/instructor/SubmissionDetail.tsx` (new) at `/instructor/exams/:examId/results/:sessionId`: shows answers, auto-grade breakdown, cheating-score timeline of violation events, and signed-URL snippet playback (if policy allowed capture)
- [X] T084a [P] [US4] In `src/pages/instructor/SubmissionDetail.tsx`, render the persisted calibration baseline (`optimal_distance_cm`, `distance_tolerance_cm`) at the top of the violation timeline. When `calibration_skipped = true`, show a prominent "Calibration skipped — distance events were measured against the conservative default of 50 cm ± 20 cm" notice (FR-013b / FR-025), so reviewers can discount distance-derived violations during adjudication (FR-028).
- [X] T085 [P] [US4] Add Postgres RPC `list_exam_submissions(exam_id uuid)` returning submissions joined with evidence summary, gated by `exam.instructor_id = auth.uid()`, in `supabase/migrations/006_access_codes_and_submissions.sql`
- [X] T086 [US4] Register new instructor routes in `src/App.tsx` behind `ProtectedRoute` with role `instructor`

**Checkpoint**: US4 functional independently given US1 + US2 + US3. The full loop closes: instructor authored → student joined, verified, took, submitted → instructor sees grade + evidence. All US4 tests pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Constitutional gates, performance validation, cleanup, and the quickstart smoke test. No new features.

- [X] T087 [P] Run `npm run typecheck` — resolve all errors; fail the phase if any remain (Constitution Principle I)
- [X] T088 [P] Run `npm run lint` — resolve all errors and new warnings introduced by this feature (Constitution Principle I)
- [X] T089 [P] Run `npm run build` — verify initial-route bundle is ≤ 500 KB gzipped; if over, lazy-load the heaviest offenders (`face-api.js` weights, MediaPipe vision) from `public/` via dynamic import (Constitution Principle IV)
- [X] T090 [P] Accessibility audit on new/updated pages (`JoinExam.tsx`, `VerifyIdentity.tsx`, `ReadyToStart.tsx`, `Exam.tsx`, `Proctoring.tsx`, `SubmissionDetail.tsx`, `CreateExam.tsx`, `ExamDetail.tsx`): keyboard reachability, text alternatives, color-plus-icon redundancy (Constitution Principle III)
- [X] T091 [P] Verify no inline `style={}` blocks or non-`lucide-react` icons were introduced, using a repo-wide grep documented in `docs/style-audit.md` (Constitution Principle III)
- [X] T092 [P] Remove any now-dead code left behind by the WebSocketService retirement, old local score computation in `CheatingScoreService`, or stale imports — flagged by ESLint `no-unused-vars`; no commented-out blocks retained (Constitution Principle I)
- [ ] T093 Run the quickstart smoke test from `specs/001-ai-proctoring-system/quickstart.md` §"Smoke test — the full happy path" end-to-end; record timings against SC-001 (≤ 5 min to publish), SC-002 (≤ 90 s verification), SC-004 (≤ 60 s delivery), and SC-006 (≤ 30 s for the instructor to locate a specific student's evidence timeline from the exam dashboard after submissions close — measured by stopwatch from `Results.tsx` open to `SubmissionDetail.tsx` for the target student, using whatever search/sort affordances the instructor list exposes)
- [ ] T094 [P] Long-session memory test: run a 2-hour scripted session against a baseline device, capture `performance.memory` over time, assert bounded growth (Constitution Principle IV — long-session memory bound)
- [X] T095 Author PR-description template update in `.github/PULL_REQUEST_TEMPLATE.md` requiring (a) which principles touched, (b) how Principle II was satisfied, (c) performance measurement evidence for Principle IV (Constitution §Development Workflow & Quality Gates)

**Checkpoint**: All gates pass; feature ready for merge.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no prior dependencies.
- **Foundational (Phase 2)**: depends on Setup. **Blocks all user stories.**
- **US1 (Phase 3)**: depends on Foundational. Independent of US2/US3/US4.
- **US2 (Phase 4)**: depends on Foundational. Integrates with US1 via `exams` but is independently testable with a seeded exam.
- **US3 (Phase 5)**: depends on Foundational. Integrates with US2 via `exam_sessions` but is independently testable with a seeded `verified` session.
- **US4 (Phase 6)**: depends on Foundational. Integrates with US3 (consumes `violation_events`) and US2 (consumes `exam_sessions`) but is independently testable with seeded `in_progress` sessions + events.
- **Polish (Phase 7)**: depends on the user stories the team intends to ship.

### Within Each User Story

- Tests MUST be written first and MUST FAIL before implementation begins.
- Migrations / RPCs before service / hook changes that call them.
- Service layer before UI wiring.
- UI wiring before E2E tests.

### Parallel Opportunities

- Phase 1 tasks T002–T005 are all `[P]`.
- Phase 2 tasks T010–T013 are `[P]` (different files, no interdependency); T007–T009 are sequential (all edit the same migration file family).
- Within each user story, test tasks `[P]` can all run in parallel; implementation tasks `[P]` can run in parallel; tasks without `[P]` edit the same file or depend on prior output.
- With a multi-developer team, US1, US2, US3, US4 can run in parallel after Foundational completes, as long as each developer consumes the Foundational migrations as an input contract.

---

## Parallel Example: Phase 2 Foundational

```bash
# After T007–T009 (migration + RLS, sequential) complete, run in parallel:
Task T010: "Crockford Base32 generator function in supabase/migrations/006_..."
Task T011: "Canonical violation taxonomy in src/types/examSession.ts"
Task T012: "Exponential-decay scorer in src/utils/violationScorer.ts"
Task T013: "Idempotency helper in src/utils/idempotency.ts"
```

## Parallel Example: User Story 3 Tests

```bash
# Before any US3 implementation task runs, kick off all tests in parallel:
Task T046: "Unit test in tests/unit/violationScorer.test.ts"
Task T047: "Unit test in tests/unit/CheatingScoreService.test.ts"
Task T048: "Integration test in tests/integration/record-violation-idempotent.test.ts"
Task T049: "Integration test in tests/integration/record-violation-policy-guard.test.ts"
Task T050: "Integration test in tests/integration/alerts-critical-sustained.test.ts"
Task T051: "Integration test in tests/integration/alerts-camera-loss.test.ts"
Task T052: "Detection benchmark in tests/fixtures/scored-sessions/benchmark.test.ts"
Task T053: "E2E test in tests/e2e/monitor-during-exam.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational) — migrations + taxonomy + scorer.
3. Complete Phase 3 (US1) — instructor can publish an exam and get a code.
4. **STOP and VALIDATE**: run T017–T020 + quickstart §1 steps 1–2. If the instructor can author and publish an exam, the MVP is demonstrable.

### Incremental Delivery

1. Setup + Foundational → Foundation ready.
2. Add US1 → Test → Demo (MVP — "I can author exams and share codes").
3. Add US2 → Test → Demo ("students can join and verify their identity").
4. Add US3 → Test → Demo ("we can watch students in real time and score their behavior").
5. Add US4 → Test → Demo ("grades + evidence reach the instructor after submission"). This is the full product loop.
6. Polish → Merge.

### Parallel Team Strategy

With multiple developers after Foundational completes:

- Developer A: US1 (instructor authoring) — works mostly in `src/pages/instructor/` + `ExamService`.
- Developer B: US2 (join + verification) — works mostly in `src/pages/student/Join*`, `Verify*`, `IdentityVerificationService`.
- Developer C: US3 (monitoring) — works mostly in `src/hooks/`, `src/services/ViolationEventService.ts`, `CheatingScoreService.ts`, and the `record_violation_batch` RPC.
- Developer D: US4 (submission + delivery) — works in `supabase/functions/`, `ExamSubmissionService`, `SubmissionDetail.tsx`.

Integration happens through the Foundational migrations and the canonical taxonomy in `src/types/examSession.ts`.

---

## Notes

- `[P]` marks tasks that edit different files with no incomplete-task dependency.
- `[Story]` label (US1–US4) is traceability only; setup / foundational / polish tasks carry no story label.
- Tests MUST fail before implementation in each user-story phase. Commit the failing tests; implement until they pass.
- Every merge-bound PR MUST pass `npm run typecheck && npm run lint && npm run build && npm run test` (Constitution §Development Workflow).
- The detection-fixture benchmark in T052 is a hard gate per Constitution Principle II — threshold changes MUST show before/after numbers.
