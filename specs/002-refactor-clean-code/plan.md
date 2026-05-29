# Implementation Plan: Refactor for Clean Code & Junior-Friendly Structure

**Branch**: `002-refactor-clean-code` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-refactor-clean-code/spec.md`

## Summary

Restructure the existing ProctoringV2 codebase into **feature-module-first** layout (`src/features/<feature>/{components,hooks,services,types,index.ts}`) with shared primitives in `src/shared/` and cross-cutting infrastructure in `src/lib/`. Enforce documented size and complexity budgets, separate UI from data-access / model-inference, consolidate duplicated logic, and apply consistent naming. Ship as a sequence of small, behavior-preserving PRs each leaving the app runnable and tests green. No framework migration, no feature changes.

## Technical Context

**Language/Version**: TypeScript 5.5 (strict), React 18.3, Node.js 18+ (tooling)
**Primary Dependencies**: Vite 5.4, react-router-dom 7.13, Tailwind 3.4, @supabase/supabase-js 2.57, @mediapipe/tasks-vision 0.10, face-api.js 0.22, lucide-react 0.344
**Storage**: Supabase (Postgres) + Supabase Storage (private bucket / signed URLs) + Supabase Realtime — *no schema change in scope*
**Testing**: Vitest (unit + integration), Playwright (E2E), fixture-based detection-engine benchmarks
**Target Platform**: Latest two stable Chrome/Edge/Firefox; Safari best-effort; desktop only
**Project Type**: Web application (single-page React frontend + Supabase backend; no separate Node service in this repo)
**Performance Goals**: ≥10 fps detection pipeline; exam UI ≥30 fps; per-frame work p95 ≤16 ms; initial route ≤500 KB gzipped
**Constraints**: Must preserve all user-visible behavior (FR-007); no per-frame allocation regressions in detection paths; no DB schema changes
**Scale/Scope**: ~50 source files, ~12k LOC, 6 user-facing feature areas (exam-session, proctoring-detection, alerts, scoring, evidence, dashboards) + auth + identity-verification

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. Code Quality** | ✅ ALIGNED | Refactor's explicit goal *is* the principle. Each PR runs typecheck/lint/build and obeys single-responsibility. Size budget formalises the principle's intent. |
| **II. Testing Standards** | ✅ ALIGNED | Mandatory-coverage paths (`violationScorer`, `CheatingScoreService`, `examSessionService`, `useExamSession`, `ExamSubmissionService`, `StudentAnswerService`) keep their tests. File moves preserve import paths via barrel re-exports during transition; tests run before & after each PR. No mocking of Supabase introduced. |
| **III. UX Consistency** | ✅ ALIGNED | No visual changes; Tailwind, lucide-react, react-router-dom routing, ProtectedRoute guard, and event taxonomy are all preserved. Behavior parity is enforced by FR-007 + smoke checklist. |
| **IV. Performance** | ✅ ALIGNED | Refactor MUST NOT regress fps/latency/bundle (Edge Case #5, FR-007). Plan forbids inserting per-frame allocations or extra indirection in `lib/gaze/*` and detection hooks. Bundle is re-measured after each PR touching lazy-loaded ML model boundaries. |

**Initial Constitution Check**: PASS — no violations; Complexity Tracking table left empty.

**Post-Design Constitution Check** (after Phase 1): PASS — feature-module layout does not introduce new abstractions or runtime indirection on hot paths; barrel re-exports compile-time only; no new dependencies. See `research.md` §Performance Safety.

## Project Structure

### Documentation (this feature)

```text
specs/002-refactor-clean-code/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions: layout, budgets, conventions, migration order
├── data-model.md        # Phase 1 — feature-module catalog (logical model of the refactor)
├── quickstart.md        # Phase 1 — junior-developer onboarding walkthrough (validates SC-001)
├── contracts/
│   ├── module-entry-point.md   # Required shape of each `src/features/<x>/index.ts`
│   ├── shared-primitive.md     # Rules for promotion from feature to shared
│   └── smoke-checklist.md      # Manual flows for FR-009 / SC-005
└── tasks.md             # Phase 2 (NOT created here — produced by /speckit.tasks)
```

### Source Code (repository root)

**Current** (pre-refactor — for reference only):

```text
src/
├── App.tsx
├── main.tsx
├── components/      # 8 components — mixed: feature-specific + shared
├── context/         # AppContext
├── data/            # mockData.ts (legacy)
├── examSession/     # legacy index.ts barrel
├── hooks/           # 10 hooks — mixed: feature-specific + cross-feature
├── lib/
│   ├── gaze/        # GazeTrackingEngine (framework-agnostic)
│   └── supabase/    # Supabase client setup
├── pages/           # auth/, instructor/, student/
├── services/        # 14 service classes — mixed concerns
├── types/           # examSession.ts, index.ts
└── utils/           # violationScorer, OfflineQueue, SessionHeartbeat, idempotency, uuid
```

**Target** (post-refactor):

```text
src/
├── App.tsx                          # Routing only
├── main.tsx                         # Bootstrap only
├── index.css
│
├── app/                             # App-level wiring (router, providers)
│   ├── router.tsx                   # Route table (extracted from App.tsx)
│   ├── providers.tsx                # AppContext + future providers
│   └── ProtectedRoute.tsx           # Moved from components/
│
├── features/                        # ONE FOLDER PER USER-FACING CAPABILITY
│   ├── auth/
│   │   ├── components/              # Login/Signup forms
│   │   ├── hooks/useAuth.ts
│   │   ├── services/authService.ts
│   │   ├── pages/                   # Signup.tsx, Login.tsx (from pages/auth)
│   │   └── index.ts                 # Public entry point (FR-010)
│   ├── exam-session/                # Student exam-taking flow
│   │   ├── components/              # ExamSubmissionModal, question UI
│   │   ├── hooks/                   # useExamSession, useExamAnswers, useTabFocusTracker
│   │   ├── services/                # examSessionService, ExamSubmissionService, StudentAnswerService
│   │   ├── pages/                   # Exam.tsx (decomposed)
│   │   ├── types.ts                 # examSession types
│   │   └── index.ts
│   ├── proctoring-detection/        # Gaze + face + liveness + distance
│   │   ├── components/              # CalibrationModal, DistanceSetupModal, LivenessCheckModal, GazeTrackingOverlay
│   │   ├── hooks/                   # useGazeTracking, useFaceDetection, useLivenessCheck, useProctoring, useReferenceCapture
│   │   ├── engine/                  # GazeTrackingEngine (moved from lib/gaze) — kept framework-agnostic
│   │   ├── services/                # FaceDetectionService, LivenessDetectionModule, DistanceCalibrationService, IdentityVerificationService
│   │   └── index.ts
│   ├── alerts/                      # Instructor alerts
│   │   ├── services/                # instructorAlertService, InstructorAlertDatabaseService
│   │   ├── hooks/                   # (alert subscription hook if extracted)
│   │   └── index.ts
│   ├── scoring/                     # Violation scoring + cheating-score aggregation
│   │   ├── services/CheatingScoreService.ts
│   │   ├── hooks/useViolationTracker.ts
│   │   ├── utils/violationScorer.ts
│   │   ├── components/ViolationExplanation.tsx
│   │   └── index.ts
│   ├── evidence/
│   │   ├── services/                # EvidenceSnippetService, ViolationEventService
│   │   └── index.ts
│   ├── identity-verification/
│   │   ├── pages/VerifyIdentity.tsx
│   │   ├── services/IdentityVerificationService.ts
│   │   └── index.ts
│   ├── instructor-dashboard/
│   │   ├── pages/                   # Dashboard.tsx, CreateExam.tsx, ExamDetail.tsx, Proctoring.tsx, SubmissionDetail.tsx, Results.tsx
│   │   ├── components/              # Dashboard-only components extracted from large pages
│   │   ├── services/ExamService.ts
│   │   └── index.ts
│   └── student-home/
│       ├── pages/                   # Home.tsx, Results.tsx
│       └── index.ts
│
├── shared/                          # Cross-feature reusable primitives (FR-003)
│   ├── components/                  # Navigation, generic Card/Modal/Badge primitives extracted during dedup
│   ├── hooks/                       # Generic hooks promoted from features
│   └── ui/                          # Tailwind tokens, common class compositions
│
├── lib/                             # Cross-cutting infrastructure (FR-011)
│   ├── supabase/                    # Existing client setup
│   ├── offline/                     # OfflineQueue, SessionHeartbeat, idempotency
│   ├── id/                          # uuid
│   └── logger/                      # (extracted from scattered console.* calls if dedup'd)
│
└── types/                           # Truly global types only; feature-local types move into features
    └── index.ts
```

tests/ remains structured as it is today (`unit/`, `integration/`, `fixtures/`, `e2e/`); test imports update to point at new module entry points but no test logic changes.

**Structure Decision**: **Web application — feature-module layout under `src/features/`**, shared primitives under `src/shared/`, cross-cutting infrastructure under `src/lib/`. Rejected alternatives: (a) keep current type-first layout (fails SC-001 — juniors must scan three folders to touch one feature); (b) split into separate npm packages / monorepo (over-engineering for ~50 files, fails the "no framework migration" assumption). The chosen layout aligns directly with the spec's Feature Module / Shared Primitive / Cross-Cutting Service entities.

## Complexity Tracking

> No constitutional violations to justify. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | | |
