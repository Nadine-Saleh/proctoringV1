---
description: "Task list for 002-refactor-clean-code"
---

# Tasks: Refactor for Clean Code & Junior-Friendly Structure

**Input**: Design documents from `/specs/002-refactor-clean-code/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks below are limited to (a) preserving existing tests during moves and (b) executing the smoke checklist. The constitution forbids mocking Supabase, and the spec does not request new TDD work — every refactor PR runs the existing Vitest + Playwright suites as the parity contract (FR-008, SC-004).

**Organization**: Tasks are grouped by user story. The five user stories from `spec.md` map to phases as follows:

| Story | Priority | Maps to phase |
|---|---|---|
| US1 — Junior locates code | P1 | Phase 3 |
| US2 — Reusable pieces replace duplication | P1 | Phase 4 |
| US3 — Concerns separated, files small | P2 | Phase 5 |
| US4 — Behavior preserved end-to-end | P1 | Phase 6 (parity gate, runs alongside every other phase) |
| US5 — Naming consistent | P2 | Phase 7 |

US4 is the **safety net** — it does not produce code; it is a recurring gate executed inside every other phase. Phase 6 owns the artifacts (smoke checklist runs, perf measurements, regression evidence) that close US4.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task serves (US1–US5)
- All paths are absolute under repository root `C:\Users\Nadine\Desktop\ProctoringV2\`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the new directory shape and tooling guardrails *without moving any code yet*. After this phase, the app builds and runs unchanged.

- [ ] T001 Create empty target directories `src/app/`, `src/features/`, `src/shared/`, `src/shared/components/`, `src/shared/hooks/`, `src/shared/ui/`, `src/lib/offline/`, `src/lib/id/` (preserve existing `src/lib/supabase/`)
- [ ] T002 Add path alias `@/*` → `src/*` in `tsconfig.app.json` and matching `resolve.alias` in `vite.config.ts`
- [ ] T003 [P] Add `eslint-plugin-import` and configure `import/no-cycle` and `import/order` in `eslint.config.js`
- [ ] T004 [P] Add `no-restricted-imports` ESLint rule in `eslint.config.js` enforcing: (a) `src/features/<x>/**` files MUST NOT import `src/features/<y>/**` except via `index.ts`; (b) `src/shared/**` MUST NOT import from `src/features/**`; (c) `src/lib/**` MUST NOT import from `src/features/**` or `src/shared/**`
- [ ] T005 [P] Add `no-restricted-imports` rule banning `@supabase/supabase-js`, `face-api.js`, `@mediapipe/*` imports inside files matching `src/features/*/components/**`
- [ ] T006 [P] Add ESLint `max-lines` (warn at 250, error at 400) and `complexity` (warn at 10) rules in `eslint.config.js`
- [ ] T007 Run `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` — record baseline pass/fail counts in PR description

**Checkpoint**: Tooling and target tree exist; project still builds and tests still pass; nothing has moved.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the cross-cutting infrastructure that every feature module will depend on. MUST complete before feature moves begin.

**⚠️ CRITICAL**: No feature-migration phase (3+) can begin until this phase is complete and green.

- [ ] T008 Move `src/components/ProtectedRoute.tsx` → `src/app/ProtectedRoute.tsx` and add transitional re-export shim at `src/components/ProtectedRoute.tsx` (`export { ProtectedRoute } from '@/app/ProtectedRoute'`)
- [ ] T009 Extract route table from `src/App.tsx` into `src/app/router.tsx`; `src/App.tsx` becomes a thin shell importing from `src/app/router.tsx`
- [ ] T010 [P] Move `src/context/AppContext.tsx` → `src/app/providers.tsx` (rename export to `AppProviders` if it composes multiple), keep transitional re-export at `src/context/AppContext.tsx`
- [ ] T011 [P] Move `src/utils/OfflineQueue.ts` → `src/lib/offline/OfflineQueue.ts` with re-export shim
- [ ] T012 [P] Move `src/utils/SessionHeartbeat.ts` → `src/lib/offline/SessionHeartbeat.ts` with re-export shim
- [ ] T013 [P] Move `src/utils/idempotency.ts` → `src/lib/offline/idempotency.ts` with re-export shim
- [ ] T014 [P] Move `src/utils/uuid.ts` → `src/lib/id/uuid.ts` with re-export shim
- [ ] T015 Create `src/lib/supabase/query.ts` exporting `runQuery<T>(...)` helper that wraps the repeated `{ data, error }` Supabase pattern (R5 #1)
- [ ] T016 Create `src/features/README.md` documenting the naming + folder conventions (kebab-case folders, PascalCase components, useThing hooks, barrel `index.ts` rule, layered import direction) per research.md §R3
- [ ] T017 Capture pre-refactor baseline measurements in `specs/002-refactor-clean-code/baseline.md`: bundle gzipped size from `npm run build`, fps trace from a 60-second exam session, full test pass-rate output, top-25 file LOC list (Constitution Principle IV)
- [ ] T018 Create `specs/002-refactor-clean-code/contracts/smoke-checklist.md` baseline column: execute every flow on `main` and record PASS/FAIL/notes (US4 starts here)
- [ ] T019 Run `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` — must match Phase 1 baseline

**Checkpoint**: Foundations laid; cross-cutting infra moved; baseline recorded. All feature moves now have a destination and a parity reference.

---

## Phase 3: User Story 1 — Junior Developer Locates Code (Priority: P1) 🎯 MVP

**Goal**: A junior with no prior context can locate the file(s) for any named feature in <10 minutes using only folder names and a structure document.

**Independent Test**: Hand a written change request ("adjust how head-pose alerts are scored") to a developer with no prior project exposure — they identify the correct file in under 10 minutes using only `PROJECT_STRUCTURE.md` and folder names. Repeat with 9 other prompts; ≥9 must succeed.

This phase migrates each feature into its target folder. Each task is one feature-migration PR (FR-013, SC-008): move files, add barrel `index.ts`, update imports, leave transitional re-exports at old paths so existing test imports keep resolving, run typecheck/lint/build/test/relevant smoke flows.

### Migration tasks (one per feature, in safety order)

- [ ] T020 [US1] Migrate **auth** feature: move `src/services/authService.ts`, `src/hooks/useAuth.ts`, `src/pages/auth/Login.tsx`, `src/pages/auth/Signup.tsx` into `src/features/auth/{services,hooks,pages}/`; create `src/features/auth/index.ts` barrel per `contracts/module-entry-point.md`; update `src/app/router.tsx` and any callers; leave re-export shims at all old paths; run lint/typecheck/build/test + smoke Flow 7
- [ ] T021 [US1] Migrate **student-home** feature: move `src/pages/student/Home.tsx` and `src/pages/student/Results.tsx` into `src/features/student-home/pages/`; create `src/features/student-home/index.ts` barrel; update router and callers; re-export shims; run lint/typecheck/build/test
- [ ] T022 [US1] Migrate **instructor-dashboard** feature: move `src/services/ExamService.ts`, `src/pages/instructor/Dashboard.tsx`, `src/pages/instructor/CreateExam.tsx`, `src/pages/instructor/ExamDetail.tsx`, `src/pages/instructor/Proctoring.tsx`, `src/pages/instructor/Results.tsx`, `src/pages/instructor/SubmissionDetail.tsx` into `src/features/instructor-dashboard/{services,pages}/`; create barrel; update router; re-export shims; run lint/typecheck/build/test + smoke Flow 3
- [ ] T023 [US1] Migrate **identity-verification** feature: move `src/services/IdentityVerificationService.ts` and `src/pages/student/VerifyIdentity.tsx` into `src/features/identity-verification/{services,pages}/`; create barrel; update router; re-export shims; run lint/typecheck/build/test
- [ ] T024 [US1] Migrate **evidence** feature: move `src/services/EvidenceSnippetService.ts` and `src/services/ViolationEventService.ts` into `src/features/evidence/services/`; create barrel; re-export shims; run lint/typecheck/build/test + smoke Flow 5
- [ ] T025 [US1] Migrate **alerts** feature: move `src/services/instructorAlertService.ts` and `src/services/InstructorAlertDatabaseService.ts` into `src/features/alerts/services/`; create barrel; re-export shims; run lint/typecheck/build/test + smoke Flow 4
- [ ] T026 [US1] Migrate **scoring** feature: move `src/utils/violationScorer.ts`, `src/services/CheatingScoreService.ts`, `src/hooks/useViolationTracker.ts`, `src/components/ViolationExplanation.tsx` into `src/features/scoring/{utils,services,hooks,components}/`; create barrel; re-export shims at all old paths (mandatory-coverage tests in `tests/unit/` and `tests/integration/` import these — DO NOT touch test files); run lint/typecheck/build/test + smoke Flow 6
- [ ] T027 [US1] Migrate **exam-session** feature: move `src/services/examSessionService.ts`, `src/services/ExamSubmissionService.ts`, `src/services/StudentAnswerService.ts`, `src/hooks/useExamSession.ts`, `src/hooks/useExamAnswers.ts`, `src/hooks/useTabFocusTracker.ts`, `src/pages/student/Exam.tsx`, `src/components/ExamSubmissionModal.tsx`, `src/types/examSession.ts` into `src/features/exam-session/{services,hooks,pages,components,types}/`; create barrel; re-export shims (constitutional mandatory-coverage tests import these — DO NOT touch test files); run lint/typecheck/build/test + smoke Flows 1, 2, 8
- [ ] T028 [US1] Migrate **proctoring-detection** feature (riskiest — last): move `src/lib/gaze/GazeTrackingEngine.ts` → `src/features/proctoring-detection/engine/GazeTrackingEngine.ts`; move `src/services/FaceDetectionService.ts`, `src/services/LivenessDetectionModule.ts`, `src/services/DistanceCalibrationService.ts` into `services/`; move `src/hooks/useGazeTracking.ts`, `src/hooks/useFaceDetection.ts`, `src/hooks/useLivenessCheck.ts`, `src/hooks/useProctoring.ts`, `src/hooks/useReferenceCapture.ts` into `hooks/`; move `src/components/CalibrationModal.tsx`, `src/components/DistanceSetupModal.tsx`, `src/components/LivenessCheckModal.tsx`, `src/components/GazeTrackingOverlay.tsx` into `components/`; create barrel; re-export shims; **MUST NOT edit engine internals — directory rename only**; run lint/typecheck/build/test + smoke Flows 1, 2; re-run detection-engine fixture benchmarks and compare to baseline
- [ ] T029 [US1] Move `src/components/Navigation.tsx` → `src/shared/components/Navigation.tsx` (it has cross-feature consumers); update imports in `src/app/router.tsx` and any pages; re-export shim at old path
- [ ] T030 [US1] Replace `PROJECT_STRUCTURE.md` at repo root with the short (≤2 page) structure document required by FR-002: feature list with one-sentence purpose each, public-entry-point per feature, "where does my new file go" decision tree (copy from `quickstart.md` §4), link to `src/features/README.md` for conventions

**Checkpoint (US1 done)**: Run the 10-prompt junior-locator validation described in the Independent Test above. ≥9/10 must succeed in <10 min using only folder names + `PROJECT_STRUCTURE.md`. Record results in PR description.

---

## Phase 4: User Story 2 — Reusable Pieces Replace Duplication (Priority: P1)

**Goal**: At least three pieces of previously duplicated logic are consolidated into single shared units; all prior call sites reference the shared unit.

**Independent Test**: Pick three pieces of duplicated logic that existed pre-refactor; after these tasks, each is implemented in exactly one location and every previous call site references it. Adding a hypothetical fourth alert type requires no copy-paste from an existing one.

### Implementation tasks

- [ ] T031 [P] [US2] Replace repeated `try { const { data, error } = ... } catch { ... }` Supabase pattern with `runQuery()` (created in T015) in `src/features/exam-session/services/examSessionService.ts`, `src/features/exam-session/services/ExamSubmissionService.ts`, `src/features/exam-session/services/StudentAnswerService.ts`, `src/features/instructor-dashboard/services/ExamService.ts`, `src/features/evidence/services/ViolationEventService.ts`, `src/features/evidence/services/EvidenceSnippetService.ts`, `src/features/alerts/services/InstructorAlertDatabaseService.ts`, `src/features/scoring/services/CheatingScoreService.ts` — run all integration tests after each file (R5 #1)
- [ ] T032 [US2] Create `src/features/scoring/emitViolation.ts` exporting a single `emitViolation(type, payload)` helper that builds the canonical violation event shape; update `src/features/scoring/index.ts` barrel to export it (R5 #2)
- [ ] T033 [US2] Replace inline event-shape construction with `emitViolation()` calls in `src/features/proctoring-detection/hooks/useGazeTracking.ts`, `src/features/proctoring-detection/hooks/useFaceDetection.ts`, `src/features/proctoring-detection/hooks/useLivenessCheck.ts`, `src/features/proctoring-detection/hooks/useProctoring.ts` — run unit + integration tests; run smoke Flow 6 to confirm taxonomy unchanged
- [ ] T034 [P] [US2] Create `src/shared/components/Modal.tsx` with `<Modal isOpen onClose title>{children}</Modal>` props per `contracts/shared-primitive.md` (R5 #3)
- [ ] T035 [US2] Refactor `src/features/proctoring-detection/components/LivenessCheckModal.tsx`, `DistanceSetupModal.tsx`, `CalibrationModal.tsx`, and `src/features/exam-session/components/ExamSubmissionModal.tsx` to render their content inside the new shared `<Modal>` — preserve every visible behavior (smoke Flows 1, 2)
- [ ] T036 [P] [US2] Create `src/shared/components/StatusBadge.tsx` with `tone="success"|"warn"|"danger"|"neutral"` (R5 #4 part 1)
- [ ] T037 [P] [US2] Create `src/shared/components/StatCard.tsx` with `label/value/icon/trend` props (R5 #4 part 2)
- [ ] T038 [US2] Replace inline badge / stat-card Tailwind compositions with `<StatusBadge>` / `<StatCard>` in `src/features/instructor-dashboard/pages/Dashboard.tsx`, `Results.tsx`, `Proctoring.tsx`, `SubmissionDetail.tsx`, and `src/features/student-home/pages/Results.tsx` — run smoke Flow 3
- [ ] T039 [US2] Create `src/features/proctoring-detection/hooks/useCameraStream.ts` owning `MediaStream` lifecycle (open, attach to video element, error states, teardown) (R5 #5)
- [ ] T040 [US2] Refactor `src/features/proctoring-detection/hooks/useProctoring.ts`, `useLivenessCheck.ts`, `useFaceDetection.ts` to consume `useCameraStream` instead of each managing their own `MediaStream` — run smoke Flows 1, 2; re-run detection benchmarks
- [ ] T041 [US2] Document each consolidated primitive (`runQuery`, `emitViolation`, `Modal`, `StatusBadge`, `StatCard`, `useCameraStream`) in PR description with before/after call-site counts (SC-003 evidence)

**Checkpoint (US2 done)**: At least 5 dedup primitives in place (SC-003 needs ≥3); duplicate logic count is verifiably lower; all tests + smoke checklist pass.

---

## Phase 5: User Story 3 — Concerns Separated and Files Small (Priority: P2)

**Goal**: Every source file fits the documented size budget (or carries a justified exemption); no UI component contains direct DB / network / model-inference calls; each file has a single, nameable responsibility.

**Independent Test**: Pick the five largest files identified in T017's baseline (`GazeTrackingEngine.ts` 923, `Exam.tsx` 776, `Proctoring.tsx` 771, `CreateExam.tsx` 457, `useLivenessCheck.ts` 436). After this phase: none exceeds the hard 400-line cap (or has a documented exemption); every component file passes the SC-007 audit (no Supabase / face-api / MediaPipe imports in `components/`).

### Implementation tasks

- [ ] T042 [US3] Split `src/features/exam-session/pages/Exam.tsx` (776 lines) into: a thin page shell (≤200 lines) plus `components/ExamHeader.tsx`, `components/ExamQuestionPanel.tsx`, `components/ExamSidebar.tsx`, and any in-component logic moved into hooks under `src/features/exam-session/hooks/`; preserve smoke Flows 1, 2, 8
- [ ] T043 [US3] Split `src/features/instructor-dashboard/pages/Proctoring.tsx` (771 lines) into a page shell plus `components/SessionListPanel.tsx`, `components/SessionDetailPanel.tsx`, `components/ViolationFeed.tsx`; preserve smoke Flows 3, 4
- [ ] T044 [US3] Split `src/features/instructor-dashboard/pages/CreateExam.tsx` (457 lines) into `components/ExamMetaForm.tsx`, `components/QuestionListEditor.tsx`, `components/QuestionRowEditor.tsx`; page shell ≤200 lines
- [ ] T045 [US3] Split `src/features/proctoring-detection/hooks/useLivenessCheck.ts` (436 lines): extract pure-step-evaluation logic into `src/features/proctoring-detection/services/LivenessDetectionModule.ts` (or a peer); the hook keeps only React lifecycle ≤250 lines
- [ ] T046 [US3] Audit `src/features/proctoring-detection/engine/GazeTrackingEngine.ts` (923 lines): if a clean split exists that does not introduce per-frame allocations or extra indirection (Constitution IV, plan §Performance Safety), extract `engine/HeadPoseEstimator.ts`, `engine/EyeAspectRatio.ts`, and `engine/AttentionMetrics.ts`; **otherwise add `// REFACTOR-EXEMPT: performance-sensitive locality, see Constitution Principle IV` and document in PR**; benchmarks MUST be within ±5% of baseline
- [ ] T047 [US3] Audit `src/features/exam-session/types.ts` (375 lines, ex `src/types/examSession.ts`): if logically grouped sub-files exist (e.g., `types/session.ts`, `types/answers.ts`, `types/evidence.ts`), split them; otherwise add `// REFACTOR-EXEMPT: cohesive type declaration` with rationale
- [ ] T048 [US3] Audit any remaining file >400 lines after the splits above (re-run `npm run lint` — `max-lines` rule will report). For each, either split or document an exemption in the file
- [ ] T049 [US3] Execute the SC-007 audit: grep `src/features/*/components/**` for `from '@supabase/supabase-js'`, `from 'face-api.js'`, `from '@mediapipe/`. Result MUST be zero matches. Record the audit command + output in `specs/002-refactor-clean-code/audit-sc007.md`
- [ ] T050 [US3] Flip `max-lines` ESLint rule from `warn` to `error`; re-run `npm run lint` — must pass

**Checkpoint (US3 done)**: All five baseline-largest files are within budget or carry written exemptions; SC-007 audit returns zero violations; lint passes with `max-lines` as error.

---

## Phase 6: User Story 4 — Behavior Preserved End-to-End (Priority: P1) 🛡️ Safety Net

**Goal**: Every existing user-visible feature behaves identically after refactor; full automated suite passes; documented smoke checklist passes.

**Independent Test**: On the refactored branch, all of: (a) Vitest suite passes at parity with `main`; (b) Playwright e2e passes; (c) every flow in `contracts/smoke-checklist.md` passes; (d) detection-engine fixture benchmarks within ±5%; (e) bundle gzipped size within ±5% of baseline.

US4 work is integrated *into* every other phase via the per-PR checks. The tasks below are the **explicit gating artifacts** that close the story.

- [ ] T051 [US4] After each Phase 3 / 4 / 5 PR, append an entry to `specs/002-refactor-clean-code/parity-log.md` recording: PR title, test pass count, smoke flows ticked, bundle gzip size, fps trace summary, detection benchmark numbers
- [ ] T052 [US4] Final full execution of `contracts/smoke-checklist.md` (all 8 flows) on the refactor branch; results recorded with timestamps and tester initials in the cleanup PR description (FR-009, SC-005)
- [ ] T053 [US4] Run full `npm test` and `npm run test:e2e` on refactor branch; pass rate MUST be ≥ baseline from T017 (FR-008, SC-004)
- [ ] T054 [US4] Run `npm run build` and capture gzip size; compare to T017 baseline; ≤5% delta required (Constitution IV)
- [ ] T055 [US4] Run detection-engine fixture benchmarks (`npm run test:detection`); compare numbers to T017 baseline; ≤5% delta required (Constitution IV)

**Checkpoint (US4 done)**: All five gates green; the refactor is provably behavior-preserving.

---

## Phase 7: User Story 5 — Naming and Conventions Consistent (Priority: P2)

**Goal**: A junior reading a one-page conventions document can place new files and choose names without further guidance.

**Independent Test**: Hand a junior the conventions doc and ask them to scaffold a hypothetical "speech-detection" feature folder. Their file/folder/export names match the convention without correction.

### Implementation tasks

- [ ] T056 [US5] Audit folder casing: every folder under `src/features/` is `kebab-case`; every folder inside a feature (`components`, `hooks`, `services`, `pages`, `engine`, `utils`, `types.ts`) matches the convention. Rename any deviations and update imports.
- [ ] T057 [US5] Audit file casing: components `PascalCase.tsx`, hooks `useThing.ts`, class-based services `PascalCase.ts`, function-based services `camelCase.ts`. Rename deviations (e.g., if any survive the move). Update imports.
- [ ] T058 [US5] Audit barrel files: every feature has exactly one `index.ts` that follows `contracts/module-entry-point.md` (no `export *`, no logic, no side effects, no nested barrels). Fix violations.
- [ ] T059 [US5] Validation walkthrough: a developer not involved in the refactor scaffolds the hypothetical "speech-detection" feature folder using only `src/features/README.md` + `quickstart.md`. Record outcome in PR description (SC-001/SC-006 evidence).

**Checkpoint (US5 done)**: Naming is uniform and predictable; the conventions doc is sufficient for an unaccompanied junior.

---

## Phase 8: Polish & Cleanup (Cross-Cutting)

**Purpose**: Remove all transitional scaffolding; delete dead code; harden the rules.

- [ ] T060 Remove every transitional re-export shim left at old paths during Phases 2–5 (search for files in `src/components/`, `src/hooks/`, `src/services/`, `src/utils/`, `src/types/`, `src/lib/gaze/`, `src/context/`, `src/data/`, `src/examSession/`, `src/pages/` that contain only `export ... from '@/...'`). Update any remaining imports. Run lint/typecheck/build/test
- [ ] T061 [P] Identify and delete dead code: unused exports, unreferenced files, commented-out blocks, obsolete `mockData.ts` if no consumer remains (FR-012). Use `ts-prune` or equivalent; record list in PR description
- [ ] T062 [P] Remove or update outdated repo-root docs that conflict with new structure: `CHEATING_SCORE_IMPLEMENTATION.md`, `DISTANCE_AND_GAZE_FIXES.md`, `VISUAL_EVIDENCE_IMPLEMENTATION.md`, `QWEN.md` (if obsolete). Cross-reference live docs in `PROJECT_STRUCTURE.md`
- [ ] T063 Tighten ESLint rules from warn to error where they were left as warn (size budget, complexity); confirm `npm run lint` passes
- [ ] T064 Add a small Node script `scripts/check-structure-doc.mjs` that compares folders under `src/features/` to entries in `PROJECT_STRUCTURE.md` and fails if drift exists; wire it into `npm run lint` or a separate npm script
- [ ] T065 Final full run: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, `npm run test:e2e`; bundle size + benchmark deltas; full smoke checklist (US4 final gate). Record everything in the merge PR description
- [ ] T066 Update `CLAUDE.md` "Recent Changes" if needed and confirm `MEMORY.md` index is consistent
- [ ] T067 Run the SC-001 onboarding validation: 10 written change-request prompts handed to a developer with no prior project exposure; ≥9 must locate the correct file in <10 minutes using only folder names + `PROJECT_STRUCTURE.md`. Record results in PR description.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no deps; can start immediately.
- **Phase 2 (Foundational)**: depends on Phase 1; **BLOCKS** Phases 3–7.
- **Phase 3 (US1, migrations)**: depends on Phase 2. Migration tasks T020–T028 are sequenced — feature-by-feature, each its own PR — to keep blast radius small (FR-013). Within T020–T028 the *order* is fixed (safety order from research.md §R6); they are NOT parallelisable across the same call sites.
- **Phase 4 (US2, dedup)**: depends on Phase 3 completion (cannot dedup files until they sit in their target locations).
- **Phase 5 (US3, splits)**: depends on Phase 4 (after dedup, splits are smaller and cleaner).
- **Phase 6 (US4, parity gate)**: runs *inside* each PR of Phases 3–5 and as a final gate before Phase 8.
- **Phase 7 (US5, naming audit)**: depends on Phase 5 (audit makes sense once files are in their final shape).
- **Phase 8 (Polish)**: depends on all of Phases 3–7; removes transitional scaffolding.

### User Story Dependencies (cross-story)

- US1 stands alone (move-only; no other story is blocked by it).
- US2 depends on US1 (call sites must exist at their target paths before consolidation).
- US3 depends on US1 and benefits from US2 (smaller dedup'd files split more cleanly).
- US4 is parallel to US1/US2/US3 — gating only.
- US5 audits the result of US1–US3 — runs after US3.

### Parallel Opportunities

- Phase 1: T003, T004, T005, T006 are `[P]` — independent ESLint changes.
- Phase 2: T010–T014 are `[P]` — independent file moves under `src/lib/`.
- Phase 3: T020–T028 are NOT `[P]` — strict safety order, one PR each.
- Phase 4: T031, T034, T036, T037 are `[P]` — independent file creations / non-overlapping edits.
- Phase 8: T061, T062 are `[P]` — independent cleanup areas.

---

## Parallel Example: Phase 2 Foundational

```bash
# Once T008–T009 (router/app shell) land, the lib/ moves can run in parallel:
Task T011: "Move OfflineQueue.ts to src/lib/offline/ with shim"
Task T012: "Move SessionHeartbeat.ts to src/lib/offline/ with shim"
Task T013: "Move idempotency.ts to src/lib/offline/ with shim"
Task T014: "Move uuid.ts to src/lib/id/ with shim"
```

## Parallel Example: Phase 4 Dedup primitives

```bash
# These create new files independently — fully parallel:
Task T034: "Create src/shared/components/Modal.tsx"
Task T036: "Create src/shared/components/StatusBadge.tsx"
Task T037: "Create src/shared/components/StatCard.tsx"
# Then the consumer-rewrite tasks T035, T038, T040 run sequentially against their respective features.
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 — Setup
2. Phase 2 — Foundational
3. Phase 3 — Feature migrations (T020 → T030)
4. Phase 6 (subset) — verify behavior parity at every PR (T051–T055 partially)
5. **STOP and VALIDATE**: Run the SC-001 onboarding test (T067). If juniors can locate code, the MVP delivers the user's stated primary goal.

At this point the project is *already* much more maintainable, even before dedup and splits. The repo can be merged here if priorities shift.

### Incremental Delivery

1. Setup + Foundational → green build, baseline captured.
2. + US1 migrations → juniors can locate code; MVP shippable.
3. + US2 dedup → fewer copy-paste opportunities; SC-003 satisfied.
4. + US3 splits → no oversized files; SC-002, SC-007 satisfied.
5. + US4 final gate → parity proven (FR-007, SC-004, SC-005).
6. + US5 naming audit → conventions provably uniform.
7. + Polish — shims removed, dead code gone, rules hardened.

Each step leaves the app shippable (FR-013, SC-008).

### Parallel Team Strategy

With multiple developers after Phase 2 completes, US1 migrations should remain **single-threaded by call-site ownership** — one feature PR at a time merging into the refactor branch — but US2 dedup primitive *creation* (T034, T036, T037) can be parallelised by different devs while US1 migrations are still landing in earlier features.

---

## Notes

- Every PR in Phases 2–8 MUST run `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` and tick the smoke flows it touches before merge.
- Constitutional mandatory-coverage paths (`violationScorer`, `CheatingScoreService`, `examSessionService`, `useExamSession`, `ExamSubmissionService`, `StudentAnswerService`) keep their tests pointed at real Supabase — no mocking introduced.
- Transitional re-export shims at old paths are a deliberate tool for keeping tests working between move PRs; they are **all removed in Phase 8 (T060)** — the final state has zero shims.
- `[P]` markers are conservative — when in doubt, sequence the task. Refactor PRs are easier to review small than fast.
- Detection-engine internals (`GazeTrackingEngine.ts`) are touched only with explicit benchmark evidence (T046, T055).
