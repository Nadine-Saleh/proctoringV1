# Phase 0 Research: Refactor for Clean Code & Junior-Friendly Structure

**Date**: 2026-05-01
**Status**: All NEEDS CLARIFICATION resolved.

## R1 — Directory Layout

- **Decision**: Feature-module layout (`src/features/<feature>/{components,hooks,services,types,index.ts}`) plus `src/shared/` (cross-feature primitives) and `src/lib/` (cross-cutting infra). Each feature exports a small public surface from `index.ts` (FR-010); imports across features go through that entry point only.
- **Rationale**: The spec's entities (Feature Module, Shared Primitive, Cross-Cutting Service) map 1:1 onto this layout. It satisfies SC-001 ("locate the file in <10 minutes") because the feature *name* is the folder. It satisfies FR-004 because each feature owns its hooks/services next to its UI, making "UI calls hook calls service" the only legal direction.
- **Alternatives considered**:
  - *Type-first (current)*: `components/`, `hooks/`, `services/` at top level — rejected: forces juniors to mentally re-assemble a feature from three folders; large files inevitable.
  - *Atomic-design (atoms/molecules/organisms)*: rejected: irrelevant for a non-design-system app; obscures feature boundaries.
  - *Monorepo with packages*: rejected: violates the "no framework migration" assumption and adds tooling cost out of proportion to the codebase size.

## R2 — Size & Complexity Budget

- **Decision**:
  - **TS/TSX files**: soft cap 250 lines, hard cap 400 lines. Files at or above the hard cap MUST be split or carry a `// REFACTOR-EXEMPT: <reason>` comment justified in PR.
  - **React components**: hard cap 200 lines of JSX-heavy code; logic must be extracted to a hook in the same feature.
  - **Functions**: cyclomatic complexity ≤10 (ESLint `complexity` rule, `warn` first, then `error` after baseline cleanup).
  - **Cohesion**: every file describable in one sentence; if not, it's two files.
  - **Documented exemptions** today: `GazeTrackingEngine.ts` (923 lines) and the type file `types/examSession.ts` (375 lines) start exempt and are split if the work is bounded; the engine is the most likely to remain exempt due to performance-sensitive locality.
- **Rationale**: Matches FR-005, SC-002, SC-007 directly. Numbers chosen to be aggressive enough to force splits but achievable on the current top-25 file list (most are 250–500 lines). Hard cap below 500 ensures the largest current files (`Exam.tsx` 776, `Proctoring.tsx` 771) get split.
- **Alternatives considered**:
  - *No file-size rule, complexity-only*: rejected: complexity is harder to enforce mechanically and harder for juniors to internalize than line counts.
  - *Strict 200-line cap everywhere*: rejected: forces over-fragmentation in performance-sensitive engine code.

## R3 — Naming & Folder Conventions

- **Decision** (one-page convention, lives in `src/features/README.md`):
  - **Folders**: `kebab-case`, plural for collections (`components/`, `hooks/`, `services/`), feature folders are `kebab-case` singular (`exam-session/`, not `exam-sessions/`).
  - **Components**: `PascalCase.tsx`, named export matches filename.
  - **Hooks**: `useThing.ts`, named export `useThing`.
  - **Services**: `PascalCase` for class-based (`ExamService.ts` exports `class ExamService`), `camelCase` for function-module services (`examSessionService.ts` exports functions). Existing mixed casing is preserved where the constitution already names files explicitly (Principle II); new services follow the class-or-functions rule based on whether they own state.
  - **Types**: feature-local types live in `features/<x>/types.ts`; only truly cross-feature types live in `src/types/`.
  - **Barrel files**: every feature has `index.ts` that re-exports the public surface; **no other directory has an `index.ts`** (avoids "where is this defined" confusion).
  - **Imports**: cross-feature imports MUST use `@/features/<x>` and the feature's barrel; intra-feature imports use relative paths.
- **Rationale**: FR-006, SC-001, AC-5.1/5.2. The casing rules match what the constitution already locks in for `examSessionService.ts` and `CheatingScoreService.ts`.
- **Alternatives considered**: All-PascalCase or all-camelCase — rejected; the codebase already differentiates class-based from function-based services and the constitution names both styles.

## R4 — Separation of Concerns Rules

- **Decision**:
  - **Components** (`features/<x>/components/`): JSX, event wiring, calls to hooks. Forbidden: `import` from `@supabase/supabase-js`, `face-api`, `@mediapipe`, or any `services/` directly.
  - **Hooks** (`features/<x>/hooks/`): React state & effects. Allowed to call services. Forbidden: rendering JSX (other than via React.memo wrappers).
  - **Services** (`features/<x>/services/`): pure TS, no React imports. Own DB / network / model calls. Throw typed errors; never set UI state.
  - **Engine** (`features/proctoring-detection/engine/`): framework-agnostic, no React, no Supabase. Existing `GazeTrackingEngine` rule.
  - Enforced via ESLint `no-restricted-imports` rules added in PR #1 of the refactor.
- **Rationale**: Encodes FR-004 / SC-007 mechanically so juniors cannot accidentally violate it.
- **Alternatives considered**: Convention-only without ESLint — rejected; spec explicitly calls out junior maintainability and "agreed at start of planning" budgets.

## R5 — Deduplication Targets

- **Decision** — initial dedup list (FR-003, SC-003 demands ≥3):
  1. **Supabase query/error wrapper** — repeated `try { ... data, error } catch { ... }` pattern across `examSessionService`, `ExamService`, `StudentAnswerService`, `ExamSubmissionService` → extract `lib/supabase/query.ts` `runQuery<T>()` helper.
  2. **Violation event emission** — repeated event-shape construction in `useGazeTracking`, `useFaceDetection`, `useLivenessCheck`, `useProctoring` → extract `features/scoring/emitViolation.ts`.
  3. **Modal shell** — `LivenessCheckModal`, `DistanceSetupModal`, `CalibrationModal`, `ExamSubmissionModal` share overlay/header/dismiss layout → extract `shared/components/Modal.tsx`.
  4. **Status badge / score card** — repeated Tailwind compositions in instructor pages → extract `shared/components/{StatusBadge, StatCard}.tsx`.
  5. **Camera lifecycle** — `useProctoring`, `useLivenessCheck`, `useFaceDetection` each open/teardown a `MediaStream` → extract `features/proctoring-detection/hooks/useCameraStream.ts`.
- **Rationale**: Targets cover service, hook, and component layers, exercising the "shared primitive" entity at all three levels. Each is verifiable: count call sites before/after.
- **Alternatives considered**: Dedup opportunistically during moves — rejected; without a list, dedup gets skipped under move-only PRs.

## R6 — Migration Strategy & PR Sequencing

- **Decision** (each PR leaves the app green — FR-013, SC-008):
  1. **PR #1 — Foundations**: add `src/features/`, `src/shared/`, ESLint rules, conventions doc, size-budget lint config (warn-only). No moves yet.
  2. **PR #2 — Smoke checklist + baseline**: write `contracts/smoke-checklist.md`, capture pre-refactor screenshots/numbers (bundle size, fps, test pass rate).
  3. **PR #3..N — One feature per PR**, in safety order: `auth` → `student-home` → `instructor-dashboard` (page splits) → `evidence` → `alerts` → `scoring` → `exam-session` → `proctoring-detection` (riskiest last, framework-agnostic engine moved last). Each PR: move files, update imports, add barrel `index.ts`, run typecheck/lint/build/test/smoke.
  4. **PR final — Cleanup**: delete dead code (FR-012), flip ESLint size rules from warn to error, remove transitional re-exports.
- **Rationale**: Exam-session and detection are the highest-risk surfaces; doing them last lets the team rehearse the move pattern on safer features first. Framework-agnostic engine is moved as a directory rename only — no internal edits.
- **Alternatives considered**:
  - *One mega-PR*: rejected; violates FR-013, unreviewable, blocks parallel work.
  - *Per-file PRs*: rejected; too many import-chain churns; feature-level PR is the right unit.

## R7 — Behavior Preservation & Test Strategy

- **Decision**:
  - Existing Vitest unit + integration suite is the parity contract. All PRs MUST pass `npm test` before merge (FR-008, SC-004).
  - Constitutional mandatory-coverage paths (`violationScorer`, `CheatingScoreService`, `examSessionService`, `useExamSession`, `ExamSubmissionService`, `StudentAnswerService`) get their tests moved alongside source; tests must keep hitting real Supabase (Principle II — no mocking).
  - Add transitional re-export shims at old paths during each move PR; remove in cleanup PR. This keeps test imports working without touching test logic.
  - Detection-engine fixtures (`tests/fixtures/`) are NOT moved; the engine moves but its public API is preserved.
  - Smoke checklist (FR-009 / SC-005) executed manually on each feature PR for the flows it touches; full pass on cleanup PR.
- **Rationale**: Parity is the safety net (User Story 4, P1).
- **Alternatives considered**: Snapshot-only verification — rejected; misses behavioral regressions in async flows.

## R8 — Performance Safety

- **Decision**: Refactor MUST NOT (a) introduce per-frame allocations in `GazeTrackingEngine` or detection hooks, (b) add React context layers around the exam page, (c) add abstraction wrappers on the gaze→scoring path. Measure bundle gzipped size before PR #1 and after each PR; fail the PR on >5% regression. Re-run fixture-based detection benchmarks after any change to detection hooks.
- **Rationale**: Constitution Principle IV; spec Edge Case "Performance-sensitive code paths".
- **Alternatives considered**: Skip measurement and trust review — rejected by Principle IV ("Measurement, not guessing").

## R9 — Junior-Developer Documentation

- **Decision**: Replace/refresh `PROJECT_STRUCTURE.md` at the end of the refactor with a short (≤2 page) structure document that:
  - Lists each feature folder and its one-sentence purpose.
  - Names the public entry point for each feature.
  - Explains the layered rule (component → hook → service).
  - Gives the rule for "where does my new file go?".
  - Replaces the conventions section with a link to `src/features/README.md`.
- **Rationale**: FR-002, SC-001. Validated by `quickstart.md` walkthrough.
- **Alternatives considered**: Long architecture document — rejected; juniors don't read >2 pages on day one.
