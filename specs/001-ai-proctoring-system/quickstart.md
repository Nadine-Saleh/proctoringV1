# Quickstart: Secure AI Proctoring System

**Feature**: 001-ai-proctoring-system
**Audience**: engineers contributing to this feature
**Goal**: get the full proctoring flow (author → join → verify → monitor → submit → review) running locally with a test Supabase project, and confirm all constitutional gates pass.

This document is scoped to the feature. For general codebase onboarding, see the repository README (or its successor) once it exists.

---

## Prerequisites

- Node.js 18+ and npm
- A Supabase account with two projects:
  - **dev** — your local development target
  - **test** — a second project used exclusively by the integration test suite (Constitution Principle II: no DB mocking on integrity-critical paths)
- Chrome or Edge (latest two stable releases) with a working camera for the student flow
- PowerShell 7+ on Windows, or Bash on macOS/Linux, for running the scripts under `.specify/scripts/`

---

## One-time setup

### 1. Install dependencies

```
npm install
```

### 2. Configure environment files

Create two environment files at the repo root:

`.env.development`
```
VITE_SUPABASE_URL=<dev project URL>
VITE_SUPABASE_ANON_KEY=<dev anon key>
```

`.env.test`
```
VITE_SUPABASE_URL=<test project URL>
VITE_SUPABASE_ANON_KEY=<test anon key>
SUPABASE_SERVICE_ROLE_KEY=<test service-role key, local only>
```

**Never** commit `.env.*` files. `SUPABASE_SERVICE_ROLE_KEY` stays on your machine and in CI secrets.

### 3. Apply migrations to both projects

```
supabase link --project-ref <dev-project-ref>
supabase db push
supabase link --project-ref <test-project-ref>
supabase db push
```

This applies every migration under `supabase/migrations/`, including the new `006_access_codes_and_submissions.sql` added by this feature.

### 4. Seed the `evidence-snippets` bucket

In the Supabase dashboard for **each** project:
1. Storage → Create bucket: `evidence-snippets`, **private**.
2. Apply the storage policies from `supabase/migrations/006_*.sql` (included as `supabase storage policy` statements).

### 5. Install test runner & e2e dependencies

Added as part of this feature:
```
npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom @playwright/test
npx playwright install chromium
```

---

## Running the app locally

```
npm run dev
```

Then, in two browser tabs:
- **Instructor tab**: log in as an instructor account; create an exam; publish; copy the access code.
- **Student tab**: log in as a student account; enter the access code; complete reference capture (first time); verify; take the exam.

---

## Running the test suite

Unit + integration:
```
npm run test           # vitest run
npm run test:watch     # vitest watch
```

Integration tests are wired to use `.env.test` by default. They run against the real Supabase **test** project. If you see errors referencing `auth.users`, confirm that your `.env.test` points at the test project and not dev.

End-to-end:
```
npm run test:e2e       # playwright test --project=chromium
```

The Playwright config launches with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` so the identity step can run headlessly against a synthetic video input from `tests/fixtures/gaze-corpus/`.

Detection-engine fixture benchmark (required to change thresholds per Constitution Principle II):
```
npm run test:detection     # replays fixtures and asserts recall/FP bounds
```

---

## Constitutional gates — run before opening a PR

```
npm run typecheck     # zero errors (Principle I)
npm run lint          # zero errors, no new warnings (Principle I)
npm run build         # must succeed (Principle I)
npm run test          # all unit + integration pass (Principle II)
npm run test:e2e      # full student + instructor flow (Principle II)
npm run test:detection   # if detection thresholds / model version changed (Principle II)
```

For performance-relevant changes (Principle IV), include a Chrome DevTools Performance trace or a scripted benchmark result in the PR description. "Feels fast" is not acceptable evidence.

---

## Smoke test — the full happy path

This is the shortest path to confirming the feature works end-to-end. Expected wall time: ~5 minutes.

1. **Instructor creates exam**
   - `/instructor/exams/new` → fill title, add 3 multiple-choice questions, set starts_at = now, duration = 10 minutes, proctoring policy with `visual_evidence_allowed = true`.
   - Publish → verify an 8-character access code appears on the exam detail page.
2. **Instructor opens oversight tab**
   - `/instructor/exams/:examId/proctor` → verify it subscribes to `oversight:exam:<examId>` and shows "0 students active" initially.
3. **Student joins**
   - `/` → enter the access code.
   - If first time: complete reference capture (three frames).
   - Complete identity verification.
   - Begin exam.
4. **Student triggers violations** (to exercise monitoring)
   - Look away from camera for ≥ 3 s → expect warning banner; `session_score_update` arrives on instructor channel; score increments.
   - Switch tabs briefly → expect `tab_focus_lost` event; score increments more.
5. **Student submits**
   - Click submit.
   - Verify on the instructor's results view: the student record shows the grade, final cheating score, evidence timeline, and (since policy allows) at least one signed-URL-playable snippet.
6. **Retention check**
   - In the Supabase dashboard, open the `evidence-snippets` bucket and confirm the snippet exists. It should be set to expire in 30 days.
7. **Policy-disabled variant**
   - Repeat steps 1–6 with `visual_evidence_allowed = false`.
   - Verify that violation events still exist in the DB but **zero** rows were created in `evidence_artifacts` and **zero** objects were uploaded to the bucket (SC-010).

---

## Troubleshooting

- **"reference_missing" error at verification**: the student has no `student_face_references` row. Check that the reference-capture route (`/exam/:sessionId/verify`) ran; it should create the row on success. Also check RLS policies on that table — the student must be able to INSERT their own row.
- **Verification always fails with `capture_invalid`**: the face-api.js model failed to find a face in the frame. Check camera permissions and that `face-api.js` model weights loaded from `public/` (they should be lazy-loaded on the verify route).
- **Instructor dashboard shows no updates**: confirm the Realtime subscription is `oversight:exam:<examId>` and that RLS policies on `exam_sessions` / `instructor_alerts` permit the instructor to SELECT for their own exams. Check the browser console for a WebSocket 401.
- **Evidence snippets don't play**: signed URLs expire quickly by design. Refresh the instructor's results view; the UI should regenerate URLs on-demand.
- **`record_violation_batch` returns `evidence_policy_violation`**: the client attempted to upload evidence for an exam whose policy forbids it. Check that the client reads `exam.proctoring_policy.visual_evidence_allowed` before attempting upload.
- **Integration test hits dev Supabase by accident**: your `.env.test` is missing or your test runner picked up `.env.development` first. Vitest loads `.env.test` automatically when `NODE_ENV=test`, but the explicit check is in `tests/setup.ts` — it aborts if `VITE_SUPABASE_URL` matches the dev URL.
