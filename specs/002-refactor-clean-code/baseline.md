# Pre-Refactor Baseline

**Branch**: `002-refactor-clean-code` (Phase 1 setup applied — no code moved)
**Captured**: 2026-05-01
**Captured by**: Phase 1 / T007

These numbers are the parity reference for every subsequent refactor PR. Phase 6 / US4 gates compare against this file.

## Build (`npm run build`)

- **Status**: ✅ success in 9.71s
- **Modules transformed**: 1776
- **Bundle output (initial route)**:
  - `index.html` — 0.70 kB · gzip 0.38 kB
  - `index-U7RXrCMY.css` — 33.60 kB · gzip **6.03 kB**
  - `index-He2jffw5.js` — 7.88 kB · gzip 2.97 kB
  - `index-DcgIsCUl.js` — 1,320.99 kB · gzip **348.81 kB**
- **Total initial JS gzip**: ~351.78 kB ✅ under the 500 kB constitutional cap (Principle IV)
- Vite emits a "chunk > 500 kB" advisory — this is pre-existing; the refactor MUST NOT make it worse.

## Typecheck (`npm run typecheck`)

- **Status**: ❌ pre-existing errors (~25 reported; documented in `PROJECT_STRUCTURE.md` "Known Issues")
- **Categories**:
  - `Cannot find name 'NavLink'` in `src/components/Navigation.tsx` (missing import)
  - `'Exam' is not exported` from `src/services/ExamService.ts` (used by `src/context/AppContext.tsx`)
  - mock-data type mismatches in `src/data/mockData.ts` (`evidenceImage`, legacy event types)
  - "used before declaration" in `src/hooks/useExamAnswers.ts`, `src/hooks/useExamSession.ts`
  - type-cast issues in `src/hooks/useFaceDetection.ts`, `src/hooks/useLivenessCheck.ts`
  - unused `ExamType` import in `src/pages/student/Home.tsx`
- **Refactor parity rule**: Phase 6 (US4) compares typecheck output against this baseline. New errors introduced by the refactor block merge; pre-existing errors may be cleaned up opportunistically but are not the refactor's primary scope.

## Lint (`npm run lint`)

- **Status**: 245 problems — **1 error**, **244 warnings**
- **The single error**: `src/pages/student/Home.tsx:6` — `'ExamType' is defined but never used` (also flagged by typecheck above)
- **Warning categories** (mostly pre-existing, some introduced by the new `import/order` rule from T003):
  - `@typescript-eslint/no-explicit-any` — pre-existing across detection-engine and Supabase wrappers
  - `import/order` — new in this branch from T003; cosmetic, will be cleaned up via `--fix` opportunistically during migration PRs
  - `react-refresh/only-export-components` — pre-existing
- **Refactor parity rule**: error count MUST drop to 0 by Phase 8 (T063 flips `max-lines` to error). New `no-restricted-imports` violations introduced by a refactor PR block that PR.

## Test suites

- `npm test` (Vitest unit + integration) — **NOT RUN** at baseline capture: integration tests require a configured `VITE_SUPABASE_URL` test project (Constitution Principle II forbids mocking Supabase). The pass-rate baseline will be captured in Phase 2 / T019 once a tester has the env configured, before any feature is moved.
- `npm run test:e2e` (Playwright) — **NOT RUN** at baseline capture for the same reason.
- `npm run test:detection` (fixture-based detection benchmarks) — **NOT RUN** at baseline; will be captured in Phase 2 / T017 (engine baseline).

## Top-25 source files by line count (pre-refactor)

These define the targets for Phase 5 / US3 (size budget audit).

| Lines | Path |
|---|---|
| 923 | `src/lib/gaze/GazeTrackingEngine.ts` |
| 776 | `src/pages/student/Exam.tsx` |
| 771 | `src/pages/instructor/Proctoring.tsx` |
| 457 | `src/pages/instructor/CreateExam.tsx` |
| 436 | `src/hooks/useLivenessCheck.ts` |
| 408 | `src/services/LivenessDetectionModule.ts` |
| 403 | `src/services/ViolationEventService.ts` |
| 396 | `src/hooks/useExamSession.ts` |
| 392 | `src/hooks/useProctoring.ts` |
| 391 | `src/hooks/useGazeTracking.ts` |
| 385 | `src/components/LivenessCheckModal.tsx` |
| 375 | `src/types/examSession.ts` |
| 358 | `src/services/FaceDetectionService.ts` |
| 337 | `src/components/GazeTrackingOverlay.tsx` |
| 330 | `src/services/ExamSubmissionService.ts` |
| 302 | `src/components/DistanceSetupModal.tsx` |
| 293 | `src/components/CalibrationModal.tsx` |
| 293 | `src/services/examSessionService.ts` |
| 283 | `src/hooks/useFaceDetection.ts` |
| 275 | `src/pages/instructor/SubmissionDetail.tsx` |
| 271 | `src/services/InstructorAlertDatabaseService.ts` |
| 270 | `src/pages/student/VerifyIdentity.tsx` |
| 266 | `src/pages/instructor/ExamDetail.tsx` |
| 259 | `src/pages/auth/Signup.tsx` |
| 253 | `src/hooks/useExamAnswers.ts` |

**Files at/over the 400-line hard cap**: 7 (rows 1–7 above). These are Phase 5 / US3 targets (T042–T047).

## Phase 6 / US4 deltas to enforce later

| Metric | Baseline | Allowed delta | Enforced by |
|---|---|---|---|
| Initial-route gzip JS | 348.81 kB | +5% (≤366 kB) | T054 |
| Build status | ✅ success | must remain ✅ | T054 |
| Lint errors | 1 (pre-existing) | must drop to 0 by Phase 8 | T063 |
| Typecheck errors | ~25 (pre-existing) | MUST NOT increase; ideally decrease | T053 |
| Detection benchmark | TBD (T017) | ±5% | T055 |
| Smoke checklist (8 flows) | TBD (T018) | all PASS | T052 |
