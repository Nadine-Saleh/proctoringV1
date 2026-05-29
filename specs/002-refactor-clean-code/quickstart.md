# Quickstart: Junior Developer Onboarding (post-refactor)

> **Goal**: a developer who has never seen this project should, within ~15 minutes of opening the repo, be able to point at the correct files for any feature change. This document validates SC-001.

## 1. The 30-second mental model

```
src/
├── app/        → wiring (router, providers)
├── features/   → ONE FOLDER PER USER-FACING THING (auth, exam-session, scoring, ...)
├── shared/     → reusable building blocks consumed by ≥2 features
├── lib/        → cross-cutting infrastructure (supabase client, offline queue, ids)
└── types/      → only TRULY global types
```

**Rule of thumb**: if a change is about *what users see or do*, you live in `features/<thing>/`. If a change is about *how the app talks to Supabase / the network / the file system*, you live in `lib/`.

## 2. Find code in 60 seconds

Pick the feature folder that matches the change:

| If the user-facing thing is… | Open this folder |
|---|---|
| Logging in or signing up | `src/features/auth/` |
| The student exam screen, answers, submission | `src/features/exam-session/` |
| Camera, gaze, face, liveness, distance | `src/features/proctoring-detection/` |
| Cheating score / violation score logic | `src/features/scoring/` |
| Instructor alerts | `src/features/alerts/` |
| Evidence snippets, violation event records | `src/features/evidence/` |
| Pre-exam identity verification | `src/features/identity-verification/` |
| Instructor dashboards, exam creation | `src/features/instructor-dashboard/` |
| Student home / results listing | `src/features/student-home/` |

Inside any feature folder:

- `components/` — UI you see
- `hooks/` — React state / lifecycle for this feature
- `services/` — talks to Supabase / models / network
- `engine/` — framework-agnostic algorithm (only in `proctoring-detection`)
- `pages/` — page-level routes
- `index.ts` — what the rest of the app is allowed to import

## 3. Try it: 3 worked examples

### Example A — "Adjust how head-pose alerts are scored"

1. *Scoring* lives in `src/features/scoring/`.
2. Open `utils/violationScorer.ts` — head-pose weights live there.
3. Adjust weights, run `npm test` (the violationScorer tests must still pass).

**You should land at the file in under 2 minutes.**

### Example B — "The liveness modal needs a new step"

1. *Liveness* is part of `proctoring-detection`.
2. Open `src/features/proctoring-detection/services/LivenessDetectionModule.ts` — that's where the steps are defined.
3. UI lives next to it under `components/LivenessCheckModal.tsx`.

### Example C — "Add a new alert type"

1. Look at how an existing alert is wired:
   - Event emission is centralised — search `src/features/scoring/emitViolation.ts`.
   - Persistence — `src/features/evidence/services/ViolationEventService.ts`.
   - Instructor delivery — `src/features/alerts/`.
2. Reuse the existing helpers, don't copy-paste. If you find yourself copying, that's a signal the helper needs to grow — flag it in the PR.

## 4. Where does my new file go?

```
Is it React UI a user sees?
├─ yes → does ≥1 other feature already render it?
│        ├─ yes  → src/shared/components/
│        └─ no   → src/features/<feature>/components/
└─ no  → does it call Supabase / network / models?
         ├─ yes → src/features/<feature>/services/  (or src/lib/<area>/ if cross-feature infra)
         └─ no  → does it use React state / effects?
                  ├─ yes → src/features/<feature>/hooks/   (or src/shared/hooks/ if cross-feature)
                  └─ no  → utility:
                           src/features/<feature>/utils/   (feature-local)
                           or src/lib/<area>/              (cross-cutting)
```

If you're not sure, **default to inside the feature**. Promotion to `shared/` is cheap; reaching into another feature's internals is forbidden.

## 5. The rules you can't break

These are enforced by ESLint — if you violate them, your PR fails CI:

1. **Components don't call services directly.** They use a hook from the same feature. Hooks call services.
2. **Cross-feature imports go through the feature's `index.ts`.** Never `import 'features/scoring/utils/foo'` from another feature.
3. **`shared/` doesn't import from `features/`.** And `lib/` doesn't import from either.
4. **No `@supabase/supabase-js`, `face-api.js`, or `@mediapipe/*` imports inside `components/`.** They belong in services or the engine.
5. **File size**: soft 250 lines, hard 400. If you're over 400, split or add a `// REFACTOR-EXEMPT: <reason>` and justify in PR.

## 6. Run the project

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # zero errors required
npm run lint         # zero errors required
npm run build        # must succeed
npm test             # vitest — full suite
npm run test:e2e     # playwright
```

## 7. Validating SC-001 (the onboarding success metric)

Hand a written change request (e.g., "make the gaze 'looking away' threshold less aggressive") to a developer with no prior project exposure. Time how long they take to point at the correct file(s). Target: **< 10 minutes** in 9/10 trials, using only this document and folder names.

If a trial fails, the failure mode is informative:

- Wrong feature folder → the feature naming or this document's lookup table needs improvement.
- Right folder, wrong subfolder → the components/hooks/services rule isn't sinking in; clarify section 2.
- Couldn't find the file at all → the folder is too big or too deeply nested; consider splitting.

## 8. Where to read more

- `PROJECT_STRUCTURE.md` (root) — short structure document (FR-002).
- `src/features/README.md` — naming and folder conventions (FR-006).
- `.specify/memory/constitution.md` — the non-negotiable rules.
- `specs/002-refactor-clean-code/` — the refactor's plan, research, and contracts.
