# Phase 1 Data Model: Feature-Module Catalog

> This refactor introduces no database schema changes. The "data model" here is the **logical model of the refactored codebase** — the entities defined in the spec (Feature Module, Shared Primitive, Cross-Cutting Service) made concrete.

## Entities

### Feature Module

A self-contained directory under `src/features/<name>/` owning one user-facing capability.

**Fields** (directory contents):

| Field | Required | Description |
|---|---|---|
| `index.ts` | yes | Public entry point — re-exports the feature's external surface only. |
| `components/` | optional | Feature-specific React components. |
| `hooks/` | optional | Feature-specific React hooks. |
| `services/` | optional | Feature-specific business logic / data-access. |
| `engine/` | optional | Framework-agnostic logic (used today by `proctoring-detection`). |
| `pages/` | optional | Page-level components routed from `app/router.tsx`. |
| `types.ts` | optional | Feature-local types. Cross-feature types live in `src/types/`. |
| `README.md` | optional | One-paragraph description if non-obvious. |

**Validation rules**:

- The folder name MUST be `kebab-case` and MUST match a name in the canonical feature list below.
- Every cross-feature import MUST resolve to the feature's `index.ts`. Reaching into `features/<x>/services/foo` from another feature is forbidden (enforced via ESLint `no-restricted-imports`).
- A feature MUST NOT import from another feature's internals; it MAY import from `shared/` and `lib/`.
- A component file in this feature MUST NOT import from `@supabase/supabase-js`, `face-api.js`, or `@mediapipe/*` directly — those imports belong in services / engine.
- Total LOC of any single file in the module MUST respect the size budget (research.md §R2) or carry an exemption comment.

**State transitions** (per migration PR):

```
[exists in old layout]
       │  PR moves files, adds barrel, updates imports
       ▼
[exists in new layout, old paths re-export]   ← app still runs, tests pass
       │  cleanup PR removes re-exports
       ▼
[exists in new layout only]
```

**Canonical feature list** (8 modules):

| Feature | Owns | Source today |
|---|---|---|
| `auth` | login/signup, session, role context | `services/authService.ts`, `hooks/useAuth.ts`, `pages/auth/*`, `context/AppContext.tsx` (role half) |
| `exam-session` | student exam taking & submission | `services/examSessionService.ts`, `services/ExamSubmissionService.ts`, `services/StudentAnswerService.ts`, `hooks/useExamSession.ts`, `hooks/useExamAnswers.ts`, `hooks/useTabFocusTracker.ts`, `pages/student/Exam.tsx`, `components/ExamSubmissionModal.tsx`, `types/examSession.ts` |
| `proctoring-detection` | gaze, face, liveness, distance, camera lifecycle | `lib/gaze/GazeTrackingEngine.ts`, `services/FaceDetectionService.ts`, `services/LivenessDetectionModule.ts`, `services/DistanceCalibrationService.ts`, `hooks/useGazeTracking.ts`, `hooks/useFaceDetection.ts`, `hooks/useLivenessCheck.ts`, `hooks/useProctoring.ts`, `hooks/useReferenceCapture.ts`, `components/{CalibrationModal, DistanceSetupModal, LivenessCheckModal, GazeTrackingOverlay}.tsx` |
| `alerts` | instructor alerting | `services/instructorAlertService.ts`, `services/InstructorAlertDatabaseService.ts` |
| `scoring` | violation scoring & cheating-score | `utils/violationScorer.ts`, `services/CheatingScoreService.ts`, `hooks/useViolationTracker.ts`, `components/ViolationExplanation.tsx` |
| `evidence` | evidence snippets & violation events persistence | `services/EvidenceSnippetService.ts`, `services/ViolationEventService.ts` |
| `identity-verification` | pre-exam identity check | `services/IdentityVerificationService.ts`, `pages/student/VerifyIdentity.tsx` |
| `instructor-dashboard` | instructor pages & exam mgmt | `services/ExamService.ts`, `pages/instructor/*` |
| `student-home` | student landing / results | `pages/student/{Home, Results}.tsx` |

(*9 entries above; `exam-session` and `student-home` are listed separately because their concerns are distinct: taking an exam vs. browsing results.*)

### Shared Primitive

A reusable building block under `src/shared/<components|hooks|ui>/`.

**Fields**:

| Field | Required | Description |
|---|---|---|
| `name` | yes | Single, unambiguous PascalCase (component) or `useThing` (hook). |
| `signature` | yes | Inputs and outputs documented inline via TypeScript types — no JSDoc duplication. |
| `consumers` | yes | At least **two** features importing it; otherwise it stays inside its feature. |

**Validation rules**:

- Promotion to `shared/` requires ≥2 feature consumers OR an explicit decision in the PR description.
- Demotion (move back into a feature) is allowed if consumers drop to one — keeps `shared/` honest.
- Shared primitives MUST NOT import from `features/`; they may import from `lib/`.
- A shared component MUST NOT contain feature-specific logic (e.g., violation-score formatting belongs in `features/scoring`).

**Initial inhabitants** (from research.md §R5):

| Primitive | Origin call sites |
|---|---|
| `shared/components/Modal.tsx` | LivenessCheck, DistanceSetup, Calibration, ExamSubmission modals |
| `shared/components/StatusBadge.tsx` | Instructor pages, student results |
| `shared/components/StatCard.tsx` | Dashboard, Results, Proctoring pages |
| `shared/components/Navigation.tsx` | App-wide (moved from `components/`) |

### Cross-Cutting Service

Infrastructure under `src/lib/<area>/` consumed by many features.

**Fields**:

| Field | Required | Description |
|---|---|---|
| `area` | yes | One of: `supabase`, `offline`, `id`, `logger`, future `telemetry`. |
| `surface` | yes | A small, named API; no React imports. |

**Validation rules**:

- A `lib/` module MUST NOT import from `features/` or `shared/`.
- A `lib/` module is the only place allowed to construct a Supabase client, MediaPipe runtime, or face-api model loader.

**Initial inhabitants**:

| `lib/` module | Source today |
|---|---|
| `lib/supabase/` | existing |
| `lib/supabase/query.ts` | NEW — extracted query/error wrapper (R5 #1) |
| `lib/offline/` | `utils/OfflineQueue.ts`, `utils/SessionHeartbeat.ts`, `utils/idempotency.ts` |
| `lib/id/` | `utils/uuid.ts` |
| `lib/logger/` | (only if dedup'd in cleanup PR) |

### Structure Document

A single file at `PROJECT_STRUCTURE.md` (root) and `src/features/README.md` (conventions).

**Fields**: feature list, one-sentence purpose each, public entry point each, "where does new code go" decision tree, link to conventions.

**Validation rules**:

- MUST list every feature folder. Drift (folder exists, doc missing it) is a CI failure (added in cleanup PR via a small node script).
- Read time ≤ 15 minutes (FR-002), measured by length: ≤ 2 pages rendered.

### Smoke Checklist

A file at `specs/002-refactor-clean-code/contracts/smoke-checklist.md`.

**Fields**: ordered list of primary user flows; each flow has: prerequisites, steps, expected observable result.

**Validation rules**:

- MUST cover student-joins-exam, instructor-views-live-session, alert-raise-and-review, evidence-fetch, scoring-readout (one flow per FR-009 example).
- Each PR in the migration sequence MUST tick the flows it touches; cleanup PR ticks all.

## Relationships

```
[Feature Module] ──imports──▶ [Shared Primitive] ──imports──▶ [Cross-Cutting Service]
       │                              │
       │                              └──imports──▶ [Cross-Cutting Service]
       │
       └──imports──▶ [Cross-Cutting Service]   (allowed: e.g., a service may use lib/supabase directly)

[Feature Module] ──MUST NOT import──▶ [Other Feature Module's internals]
                                       (only the other feature's index.ts is reachable)

[Shared Primitive] ──MUST NOT import──▶ [Feature Module]
[Cross-Cutting Service] ──MUST NOT import──▶ [Feature Module] or [Shared Primitive]
```

## Non-goals (out of scope for this data model)

- Database schema changes (none).
- New runtime entities — every entity above is a *codebase organization* concept, not a runtime object.
- Feature additions or removals.
