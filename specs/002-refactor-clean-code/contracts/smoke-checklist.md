# Contract: Smoke Checklist

This is the manual smoke checklist that satisfies **FR-009** and **SC-005**. It MUST be executed:

- Once on `main` (pre-refactor) to record the **baseline** result.
- After every feature-migration PR for the flows it touches.
- In full on the final cleanup PR before the refactor branch is merged.

Each step records: **Pass / Fail / Notes**. A flow PASSES only when observable behavior matches baseline.

---

## Flow 1 — Student joins an exam

**Prerequisites**: A published exam exists with a known access code; student account has access.

| # | Step | Expected |
|---|---|---|
| 1 | Navigate to student home | Exam list renders; published exam visible |
| 2 | Click "Join exam" / enter access code | Identity verification flow launches |
| 3 | Complete liveness modal (look-left, nod, etc.) | Modal advances steps; passes within timeout |
| 4 | Distance setup modal (if shown) | Calibration captures baseline distance |
| 5 | Gaze calibration modal | 5-point calibration completes |
| 6 | Exam page renders | Question 1 visible; timer counting down; camera preview live |

## Flow 2 — Student takes the exam

| # | Step | Expected |
|---|---|---|
| 1 | Answer Q1, click Next | Q2 appears; selection persisted on back/next |
| 2 | Trigger a tab switch | Tab-switch violation logged in instructor view |
| 3 | Look away for >3s | Gaze violation logged; warning banner escalates correctly |
| 4 | Click Submit / let timer expire | Submission modal appears with answer summary |
| 5 | Confirm submit | Redirect to results; submission saved (verify in Supabase or instructor view) |

## Flow 3 — Instructor views a live session

**Prerequisites**: Flow 1 has been executed in a separate browser (student is mid-exam).

| # | Step | Expected |
|---|---|---|
| 1 | Login as instructor | Dashboard renders |
| 2 | Open the exam's proctoring page | Live student session(s) listed |
| 3 | Open one student's live view | Cheating-score readout updates in real time |
| 4 | Trigger a violation in the student tab | Score & event count update in instructor tab within seconds |

## Flow 4 — Alert raised and reviewed

**Prerequisites**: A student session is active.

| # | Step | Expected |
|---|---|---|
| 1 | In student tab, sustain a high-severity violation pattern (multiple tab switches + gaze away) | Cheating-score crosses critical threshold |
| 2 | Instructor receives alert (UI banner / dashboard counter) | Alert visible without page refresh; debouncing prevents duplicate alerts within 60s |
| 3 | Click alert | Instructor lands on the offending session view |

## Flow 5 — Evidence fetched and viewed

**Prerequisites**: An exam policy with visual evidence enabled has produced at least one snippet.

| # | Step | Expected |
|---|---|---|
| 1 | Open submission detail for the relevant exam | Evidence list renders |
| 2 | Click an evidence item | Signed URL fetched, snippet plays/loads |
| 3 | Wait past signed-URL TTL and refresh | New signed URL is fetched (no broken-image state) |

## Flow 6 — Scoring readout consistency

| # | Step | Expected |
|---|---|---|
| 1 | Compare student-side score readout with instructor-side score readout for the same session at the same moment | Values agree (within polling/realtime jitter) |
| 2 | Verify violation taxonomy match | A violation type that appears on the student side also appears on the instructor side (Constitution III) |

## Flow 7 — Auth & route guards

| # | Step | Expected |
|---|---|---|
| 1 | Logged-out user navigates to `/exam` | Redirected via `ProtectedRoute` |
| 2 | Student logs in and visits `/instructor` | Redirected (role guard) |
| 3 | Instructor visits student-only route | Redirected |

## Flow 8 — Recovery / error states

| # | Step | Expected |
|---|---|---|
| 1 | Deny camera permission at exam start | Recoverable error UI with "retry" — never a blank screen |
| 2 | Disconnect network during exam | Offline queue holds events; reconnect flushes them |
| 3 | Refresh mid-exam | Session resumes (or graceful resume-prompt) — no data loss |

---

## Pass criteria

- **Per-PR runs**: every flow whose feature folder is touched in the PR MUST pass.
- **Cleanup-PR run**: ALL flows MUST pass; results recorded in the PR description with timestamps and tester initials.
- **Performance check**: bundle gzip size and a 60-second fps trace are recorded on the cleanup PR; both MUST be within ±5% of baseline (Constitution Principle IV; spec edge case "Performance-sensitive code paths").

## Recording

Results live in the PR description as a table:

```
| Flow | Pre-refactor (main) | This PR | Notes |
|---|---|---|---|
| 1 — Student joins | PASS | PASS | — |
| 2 — Take exam | PASS | PASS | — |
...
```
