# Implementation Plan: Secure AI Proctoring System

**Branch**: `001-ai-proctoring-system` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ai-proctoring-system/spec.md`

## Summary

Deliver an end-to-end proctored-exam workflow on top of the existing React + Supabase codebase. Instructors author exams and receive a unique access code; students join by code and pass a browser-side face-recognition check before the exam starts; before the exam clock starts, the student also completes a one-time per-session distance-calibration step that establishes their `optimal_distance_cm` baseline (server-persisted on `exam_sessions`, with a soft `50 cm ± 20 cm` fallback flagged via `calibration_skipped`); during the exam, the client continuously derives violation signals (gaze, face presence, extra persons, focus loss, camera availability, and face-to-camera distance against the calibrated baseline) and maintains a severity-weighted cheating score that streams to an instructor oversight dashboard in near real time; on submission, the system assembles a grade-plus-evidence package — including the calibration baseline so distance violations remain auditable — and delivers it to the instructor dashboard idempotently. Raw frames are never persisted server-side; only derived events and — when exam policy permits — short evidence snippets are retained, with all access mediated by Supabase Row Level Security.

## Technical Context

**Language/Version**: TypeScript 5.5 (strict), React 18.3, Node.js 18+ for tooling
**Primary Dependencies**: Vite 5, `react-router-dom` 7, Tailwind 3, `@supabase/supabase-js` 2.57, `@mediapipe/tasks-vision` 0.10, `face-api.js` 0.22, `lucide-react`
**Storage**: Supabase (Postgres) for exams, sessions, events, submissions, alerts; Supabase Storage (private bucket, signed URLs) for visual evidence snippets; Supabase Realtime channels for live score + alert delivery
**Testing**: Vitest + Testing Library for unit/component; Playwright (headless Chromium) for UI end-to-end; integration tests run against a dedicated Supabase *test* project (per Constitution Principle II — no DB mocking on integrity-critical paths); a fixed fixture corpus of recorded video frames drives detection-engine validation
**Target Platform**: Latest two stable releases of Chrome, Edge, Firefox on desktop/laptop (integrated GPU, ≥ 8 GB RAM baseline). Mobile/tablet out of scope for v1.
**Project Type**: Web application — single SPA + Supabase backend-as-service. Frontend is the primary codebase; backend = Supabase schema, RLS policies, and Edge Functions.
**Performance Goals**: Detection loop ≥ 10 fps sustained; exam UI ≥ 30 fps; per-frame work ≤ 16 ms p95 on main thread (otherwise moved to Web Worker); instructor dashboard score update ≤ 5 s from detected behavior (SC-003); submission-to-delivery ≤ 60 s p99 (SC-004).
**Constraints**: Raw camera frames MUST NOT be persisted server-side; only derived signals and (policy-permitting) short snippets may be uploaded. Initial route bundle ≤ 500 KB gzipped; ML models lazy-loaded. Violation events batched + debounced before upload; realtime channels MUST tolerate disconnect/reconnect without loss. Supabase RLS is the security boundary — client code MUST NOT rely on UI hiding.
**Scale/Scope**: Up to ~50 concurrent students per instructor on the live oversight UI; cohorts up to a few thousand per exam (live oversight is summary + alert-driven at that scale); up to ~10 000 derived events per 2-hour session; visual-evidence snippets ~1–3 s each, capped per session.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Each principle from `.specify/memory/constitution.md` v1.0.0 is evaluated below.

**I. Code Quality (NON-NEGOTIABLE)** — ✅ Pass.
The plan commits to `npm run typecheck`, `npm run lint`, `npm run build` gates on every PR, single-responsibility services/hooks, no dead code, and comment discipline. No new patterns that would erode existing type-safety boundaries.

**II. Testing Standards (NON-NEGOTIABLE)** — ⚠ Pass with documented prerequisite.
The repository has no test runner configured today. This feature cannot ship without the mandatory coverage listed in Principle II, so Phase 0 research will finalize the testing stack and add it as the first task cluster in `/speckit.tasks`. Mocking the database is explicitly prohibited on integrity-critical paths — a dedicated Supabase *test* project will be used for integration tests. Detection-engine tuning MUST be validated against a fixed fixture corpus before merge.

**III. User Experience Consistency** — ✅ Pass.
All new UI uses Tailwind only, `lucide-react` icons only, routing through `react-router-dom`, role-based guards via `ProtectedRoute`. The violation taxonomy (event types + severity tiers) is defined once in `src/types/` and reused across student warnings, instructor alerts, and evidence packages — no surface may silently omit a type. The `face_too_close` / `face_too_far` types added under FR-013c are registered at severity = `low` (5) in the canonical taxonomy and surfaced on every dependent surface; instructor surfaces additionally show the session's `calibration_skipped` flag (FR-013b) so distance events can be discounted appropriately.

**IV. Performance Requirements** — ✅ Pass (with specific enforcements).
Detection loop targets ≥ 10 fps; per-frame > 16 ms p95 triggers Web-Worker offload before merge. ML models lazy-loaded (not in initial chunk). Violation uploads batched. Long-session memory bounded (tensor release per frame; instructor dashboard paginates event history). Any PR claiming performance gains MUST include measurement evidence (Chrome DevTools trace or scripted benchmark).

**Additional constitutional sections** (Compliance/Privacy/Platform, Workflow) — ✅ Pass.
Raw frames never persisted; RLS enforced; latest-two-browsers support; Safari best-effort; feature branch `001-ai-proctoring-system` already created; PR checklist will enumerate principles touched.

**Net**: No unjustified violations. One documented prerequisite (stand up the testing stack) is surfaced for Phase 0 and moved into Complexity Tracking only if it becomes a blocker later. Proceeding to Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-proctoring-system/
├── plan.md                 # This file
├── research.md             # Phase 0 — decisions & rationale
├── data-model.md           # Phase 1 — entities, fields, state machines
├── contracts/              # Phase 1 — RPC / realtime / UI route contracts
│   ├── rpc-start-session.md
│   ├── rpc-submit-exam.md
│   ├── rpc-record-violation.md
│   ├── realtime-channels.md
│   └── ui-routes.md
├── quickstart.md           # Phase 1 — how to run & test this feature
├── checklists/
│   └── requirements.md     # Spec quality checklist (already written)
└── tasks.md                # Phase 2 — produced by /speckit.tasks
```

### Source Code (repository root)

This feature slots into the existing single-SPA layout. No new top-level directories are introduced except `tests/` (currently absent).

```text
src/
├── pages/
│   ├── auth/                  # Login, Signup (existing)
│   ├── instructor/            # Dashboard, CreateExam, Results, Proctoring (existing)
│   └── student/               # Home, Exam, Results (existing)
├── components/                # Shared presentational components (existing)
├── context/                   # Auth + session context providers (existing)
├── hooks/
│   ├── useAuth.ts             # existing
│   ├── useExamSession.ts      # extended (admit → in-progress → submitted)
│   ├── useExamAnswers.ts      # existing
│   ├── useProctoring.ts       # orchestrates detection hooks
│   ├── useFaceDetection.ts    # face presence / identity
│   ├── useGazeTracking.ts     # gaze direction
│   ├── useLivenessCheck.ts    # anti-spoofing on identity step
│   └── useViolationTracker.ts # aggregates events → CheatingScoreService
├── services/
│   ├── authService.ts
│   ├── ExamService.ts                   # new: CRUD for exams, access-code gen
│   ├── examSessionService.ts            # admit, state transitions
│   ├── ExamSubmissionService.ts         # submit + grade + evidence package
│   ├── StudentAnswerService.ts
│   ├── ViolationEventService.ts         # batched uploads, offline buffer
│   ├── CheatingScoreService.ts          # aggregate, decay, thresholds
│   ├── InstructorAlertDatabaseService.ts   # persistence (insert/select/ack alerts via Supabase)
│   ├── instructorAlertService.ts           # in-process pub/sub for the live oversight UI
│   ├── FaceDetectionService.ts
│   ├── LivenessDetectionModule.ts
│   └── DistanceCalibrationService.ts        # new: writes optimal_distance_cm + tolerance + calibration_skipped to exam_sessions via start_exam_session RPC (FR-013a/b)
│   # NOTE: WebSocketService.ts retired in favor of Supabase Realtime — see research.md R2 and tasks.md T015
├── lib/
│   └── gaze/GazeTrackingEngine.ts
├── types/
│   └── examSession.ts                   # canonical violation taxonomy lives here
├── utils/
│   ├── violationScorer.ts
│   └── uuid.ts
├── data/                                # mock/fixture seed data for local dev
└── App.tsx                              # route table + ProtectedRoute wiring

supabase/
├── migrations/                          # existing migrations + new additions
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   ├── 003_fix_rls_recursion.sql
│   ├── 004_cheating_score_functions.sql
│   ├── 005_rls_policies_cheating_system.sql
│   └── 006_access_codes_and_submissions.sql   # new — added under this feature
├── functions/                                  # Edge Functions (new subtree)
│   ├── submit-exam/                            # idempotent submission + delivery
│   └── assemble-evidence/                      # builds evidence package
└── seed.sql

tests/                                          # NEW — added under this feature
├── unit/
│   ├── violationScorer.test.ts
│   ├── CheatingScoreService.test.ts
│   └── useExamSession.test.ts
├── integration/                                # hit real Supabase test project
│   ├── exam-lifecycle.test.ts
│   ├── submission-idempotency.test.ts
│   └── rls-boundaries.test.ts
├── e2e/                                        # Playwright
│   ├── instructor-publish-exam.spec.ts
│   ├── student-join-verify-take.spec.ts
│   └── submission-delivery.spec.ts
└── fixtures/
    ├── gaze-corpus/                            # recorded frames for detection tests
    └── scored-sessions/                        # ground-truth violation timelines
```

**Structure Decision**: Single-project layout retained. All new work lands in the existing `src/` tree under established subdirectories, plus new `supabase/functions/` for the idempotent submission/evidence Edge Function and a new top-level `tests/` tree. This preserves the codebase's current navigation model and avoids a breaking reorganization.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified.**

No justified violations at this time.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| *(none)*  | *(n/a)*    | *(n/a)*                              |

Notes on items deliberately surfaced but not counted as violations:

- **No test runner exists yet** → this is a *prerequisite*, not a constitutional exemption. Testing will be stood up at the start of `/speckit.tasks` before any integrity-critical code merges.
- **Live-channel decision (resolved)**: Supabase Realtime is the chosen authoritative mechanism (research.md R2). The legacy `src/services/WebSocketService.ts` has been retired by tasks.md T015 to preserve "no dead code" (Principle I).
