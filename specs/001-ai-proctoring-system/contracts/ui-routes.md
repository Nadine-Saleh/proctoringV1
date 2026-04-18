# Contract: UI Routes & Role Gates

**Feature**: 001-ai-proctoring-system
**Exposed to**: browser users (instructors and students)
**Shape**: `react-router-dom` v7 route definitions wrapped by `ProtectedRoute` for role-based access

Routes listed here are the contract between the SPA and its users: URL, required role, purpose, and what the route must deliver.

---

## Public / auth routes

| Path | Role | Purpose |
|------|------|---------|
| `/login` | public | Sign in for instructors and students |
| `/signup` | public | Account creation |

---

## Instructor routes (role-gated: `instructor`)

| Path | Purpose |
|------|---------|
| `/instructor` | Instructor dashboard — list of owned exams with status, cohort counts, quick actions |
| `/instructor/exams/new` | Create-exam form (title, questions, schedule, proctoring policy) |
| `/instructor/exams/:examId` | Exam detail — access code, scheduled window, join/progress/submit counts |
| `/instructor/exams/:examId/proctor` | Live oversight — per-session score tiles, alert feed, termination controls |
| `/instructor/exams/:examId/results` | Post-exam review — submissions list |
| `/instructor/exams/:examId/results/:sessionId` | Per-student record — answers, final grade, evidence timeline, snippet playback |

All instructor routes MUST:
- Verify `auth.user.role = 'instructor'` via `ProtectedRoute` before rendering.
- Verify `exam.instructor_id = auth.user.id` (or explicit co-instructor grant) before exposing the exam's data. RLS provides the server-side guarantee; the UI surfaces a 404 / forbidden screen on mismatch rather than an exception.

---

## Student routes (role-gated: `student`)

| Path | Purpose |
|------|---------|
| `/` (student home) | Entry: code-entry field + list of active/past exams |
| `/exam/join` | Access-code prompt |
| `/exam/:sessionId/verify` | Identity verification (reference capture if first time, then live verify) |
| `/exam/:sessionId/ready` | "You are verified — begin?" confirmation before the clock starts |
| `/exam/:sessionId` | The exam itself — questions + proctoring overlay |
| `/exam/:sessionId/results` | Student's own result summary (grade, status, no instructor-only details) |

All student routes MUST:
- Verify `auth.user.role = 'student'`.
- Verify `session.student_id = auth.user.id` before rendering any session-scoped route.
- On session status mismatch (e.g., navigating to `/exam/:sessionId` while session is `awaiting_verification`), redirect to the appropriate earlier step.

---

## Cross-cutting UI guarantees

- **Iconography**: `lucide-react` only (Constitution Principle III).
- **Styling**: Tailwind utility classes only. No inline `style={}` except for dynamically-computed numeric values (e.g., a score progress bar width).
- **Error states**: All data-fetching routes MUST handle loading / error / empty states explicitly. Blank screens on error are prohibited.
- **Navigation**: All navigation uses `<Link>` or `useNavigate()` from `react-router-dom`. No `window.location` mutation.
- **Role guards**: Enforced centrally via `ProtectedRoute`. Individual pages MUST NOT re-implement role checks.
- **Violation taxonomy alignment**: Any route that displays violation event types MUST pull the labels + severity tiers from the canonical taxonomy in `src/types/examSession.ts`. A type MUST NOT appear in one surface (e.g., student warning) and be silently absent from another (e.g., instructor evidence).

---

## Camera & realtime lifecycle per route

| Route | Camera state | Realtime subscription |
|-------|--------------|----------------------|
| `/exam/:sessionId/verify` | active, user-initiated capture only | none |
| `/exam/:sessionId/ready` | inactive | `session:student:<session_id>` |
| `/exam/:sessionId` | active, continuous detection loop | `session:student:<session_id>` |
| `/instructor/exams/:examId/proctor` | n/a | `oversight:exam:<exam_id>` |

The student's camera MUST be released when the student navigates away from exam routes or submits. Unreleased camera access past submission is a P0 bug.
