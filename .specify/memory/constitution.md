<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.0.1
Bump rationale: PATCH — wording correction to align Principle II's filename
references with the actual on-disk casing (`examSessionService.ts`,
camelCase). No semantic change to mandatory-coverage scope.

Prior change: TEMPLATE (uninitialized) → 1.0.0 — Initial ratification.

Principles defined (4, per user input):
  - I. Code Quality (NON-NEGOTIABLE)
  - II. Testing Standards (NON-NEGOTIABLE)
  - III. User Experience Consistency
  - IV. Performance Requirements

Sections established:
  - Core Principles (4 principles)
  - Compliance, Privacy & Platform Constraints
  - Development Workflow & Quality Gates
  - Governance

Removed sections: None (no prior content beyond placeholders).
Renamed principles: None.

Templates reviewed for alignment:
  - .specify/templates/plan-template.md            ✅ Constitution Check gate
                                                       remains generic — no edits
                                                       required; new principles
                                                       slot into existing gate.
  - .specify/templates/spec-template.md            ✅ No principle-specific
                                                       references; aligned.
  - .specify/templates/tasks-template.md           ✅ Tests-optional language
                                                       intentionally NOT changed
                                                       (template is workflow-
                                                       generic); Principle II
                                                       overrides at the
                                                       per-feature level via the
                                                       Constitution Check gate.
  - .specify/templates/checklist-template.md       ✅ Generic; aligned.
  - .specify/templates/agent-file-template.md      ✅ Generic; aligned.
  - .specify/extensions/git/commands/*.md          ✅ Hook commands unaffected.

Runtime guidance:
  - README.md / docs/quickstart.md                 ⚠ Not present in repo —
                                                       no propagation needed.
  - CLAUDE.md (or equivalent agent guidance)       ⚠ Not present in repo —
                                                       no propagation needed.

Deferred / TODO items: None.
-->

# ProctoringV2 Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

All code merged to `main` MUST satisfy the following gates:

- **Type safety**: `npm run typecheck` MUST pass with zero errors. `any` is
  permitted only at clearly-marked third-party boundaries (e.g., raw MediaPipe
  / face-api responses) and MUST be narrowed before crossing into project
  modules.
- **Lint clean**: `npm run lint` MUST pass with zero errors and zero new
  warnings introduced by the change.
- **Build clean**: `npm run build` MUST succeed.
- **Single responsibility**: Files in `src/services/` expose one cohesive
  capability; cross-cutting helpers belong in `src/utils/` or `src/lib/`.
  Hooks in `src/hooks/` MUST be the integration layer between UI components
  and services — components MUST NOT call services directly when a hook
  already encapsulates that flow.
- **No dead code**: Removed features MUST be deleted, not commented out or
  left behind feature flags. Backwards-compatibility shims require an
  explicit removal date documented in the PR description.
- **Comments are for the *why***: Naming carries the *what*. Comments are
  reserved for non-obvious constraints, invariants, or workarounds.

**Rationale**: This codebase already enforces TypeScript, ESLint, and a Vite
build; honoring those gates as constitutional rather than advisory prevents
the slow erosion that produces "fix it later" debt in a security-sensitive
proctoring system.

### II. Testing Standards (NON-NEGOTIABLE)

Tests are required wherever **incorrect behavior would silently corrupt
exam integrity**. Concretely:

- **Mandatory coverage** for: violation scoring (`src/utils/violationScorer.ts`),
  cheating-score aggregation (`src/services/CheatingScoreService.ts`), exam
  session lifecycle (`src/services/examSessionService.ts`,
  `src/hooks/useExamSession.ts`), submission integrity
  (`src/services/ExamSubmissionService.ts`,
  `src/services/StudentAnswerService.ts`), and any persistence layer touching
  Supabase.
- **Integration tests** MUST exercise real Supabase calls against a dedicated
  test project — mocking the database is forbidden for these paths because
  schema or RLS drift between mocks and production is the exact failure
  mode tests must catch.
- **Optional coverage** for: pure presentational components, layout-only
  pages, and decorative UI utilities.
- **Bug fixes** MUST add a regression test that fails before the fix and
  passes after. Exceptions require a written justification in the PR.
- **Detection-engine changes** (gaze, distance, face presence) MUST be
  validated against a fixed corpus of recorded video frames or synthetic
  fixtures. Threshold tuning without fixture-based before/after numbers is
  prohibited.

**Rationale**: Proctoring decisions affect students' grades and academic
records. The cost of a false positive (wrongful cheating accusation) or
false negative (missed violation) is high enough that integrity-critical
paths cannot be left to manual smoke testing.

### III. User Experience Consistency

The student-facing exam surface and the instructor-facing review surface
MUST present a coherent, predictable interface:

- **Design system**: Tailwind utility classes are the styling source of
  truth. Ad-hoc CSS files, inline `style={}` blocks, or one-off color
  literals are prohibited except for dynamically-computed values (e.g.,
  cheating-score progress bars).
- **Iconography**: All icons MUST come from `lucide-react`. Mixing icon
  libraries fragments the visual language.
- **Routing**: All navigation MUST go through `react-router-dom` route
  definitions. No `window.location` mutation, no manual history
  manipulation. Role-based guards MUST be enforced via the existing
  `ProtectedRoute` mechanism — never re-implemented per page.
- **Violation surfacing**: Student-visible warnings, instructor-visible
  alerts, and the cheating-score readout MUST agree on event taxonomy and
  severity tiers. A violation type MUST NOT exist in one surface and be
  silently absent from another.
- **Error states**: Network failures, permission denials (camera /
  microphone), and authentication errors MUST present a recoverable UI —
  never a blank screen, a thrown exception, or a console-only message.
- **Accessibility floor**: Interactive elements MUST be keyboard reachable;
  images and icons used for meaning MUST have text alternatives;
  color MUST NOT be the sole carrier of state (pair color with icon or
  label).

**Rationale**: Two distinct user populations (students mid-exam,
instructors reviewing alerts) interact with the same underlying events.
Inconsistent presentation between them produces disputes that are
expensive to adjudicate after the fact.

### IV. Performance Requirements

The proctoring loop runs continuously alongside an exam-taking UI; it MUST
NOT degrade the student's ability to take the exam.

- **Frame-processing budget**: The gaze / face-detection pipeline
  (`src/lib/gaze/GazeTrackingEngine.ts` and related hooks) MUST sustain a
  steady-state cadence of at least **10 frames per second** on a baseline
  laptop (integrated GPU, 8 GB RAM) without the exam UI dropping below
  **30 fps** of interaction responsiveness.
- **Main-thread protection**: Any per-frame work whose p95 exceeds
  **16 ms** MUST be moved off the main thread (Web Worker, OffscreenCanvas,
  or `requestIdleCallback` batching) before merge.
- **Bundle size**: `npm run build` output for the initial route MUST stay
  under **500 KB gzipped**. ML models (MediaPipe, face-api weights) MUST
  be lazy-loaded — never bundled into the initial chunk.
- **Network**: Violation events MUST be batched or debounced before
  upload; a sustained per-event POST pattern is prohibited. Realtime
  channels MUST tolerate disconnect/reconnect without losing buffered
  events.
- **Memory**: Long exam sessions (≥ 2 hours) MUST NOT exhibit unbounded
  growth. Detection engines MUST release tensors / canvases between
  frames; instructor dashboards MUST cap in-memory event history and
  page older events.
- **Measurement, not guessing**: Performance claims in PR descriptions
  MUST cite a measurement method (Chrome DevTools Performance trace, a
  scripted benchmark, or a recorded fps counter). "Feels fast" is not
  acceptable evidence.

**Rationale**: A laggy proctoring overlay either gets disabled by
desperate students or makes the exam itself unusable — both outcomes
defeat the product. Concrete numeric budgets prevent gradual regression.

## Compliance, Privacy & Platform Constraints

- **Camera, microphone, and screen-capture data** are sensitive. Raw
  frames MUST NOT be persisted server-side; only derived signals
  (violation events, scored evidence snippets) may be uploaded, and only
  when the exam policy explicitly enables visual evidence.
- **Authentication and authorization**: All Supabase access MUST go
  through Row Level Security policies. Client code MUST NOT rely on
  hiding UI as a security boundary.
- **Browser support**: Latest two stable releases of Chrome, Edge, and
  Firefox. Safari is best-effort. Mobile browsers are out of scope for
  the student exam surface.
- **Third-party ML models** (MediaPipe Tasks, face-api.js): version
  upgrades MUST re-run the detection-engine fixture suite (Principle II)
  before merge.

## Development Workflow & Quality Gates

- **Branching**: Feature work happens on a branch matching the
  `feature/<short-name>` or `<topic>` convention (the current
  `cheatingScore` branch is an example). Direct commits to `main` are
  prohibited.
- **PR checklist**: Every PR description MUST state (a) which principles
  are touched, (b) how Principle II was satisfied (test names or
  justified exemption), and (c) for performance-relevant changes, the
  measurement evidence required by Principle IV.
- **Constitution Check gate**: `/speckit.plan` and `/speckit.tasks`
  outputs MUST evaluate planned work against this constitution and flag
  violations in the plan's Complexity Tracking table — implementation
  MUST NOT begin until violations are either resolved or explicitly
  justified.
- **Review**: At least one human review is required for any change
  touching `src/services/`, `src/hooks/`, `src/lib/gaze/`, or files
  that handle authentication, scoring, or submission.
- **Hotfix exception**: Production-incident hotfixes may bypass the
  test-first portion of Principle II, but MUST file a follow-up PR
  adding the missing regression test within **72 hours**.

## Governance

This constitution supersedes ad-hoc conventions, prior informal
agreements, and individual preferences. Where this document and any
other guidance (READMEs, comments, chat decisions) conflict, this
document wins until formally amended.

**Amendment procedure**:

1. Open a PR modifying `.specify/memory/constitution.md` with the
   proposed change and a written rationale.
2. Re-run `/speckit.constitution` to regenerate the Sync Impact Report
   and propagate changes across `.specify/templates/*`.
3. Bump `CONSTITUTION_VERSION` per semantic-versioning rules:
   - **MAJOR**: Removing or redefining a principle in a backwards-
     incompatible way; changing governance procedure.
   - **MINOR**: Adding a new principle or section; materially expanding
     guidance under an existing principle.
   - **PATCH**: Wording, clarifications, typo fixes, non-semantic
     refinements.
4. Update `LAST_AMENDED_DATE` to the merge date (ISO `YYYY-MM-DD`).
   `RATIFICATION_DATE` is immutable.
5. Merge requires review by at least one maintainer with write access
   to `main`.

**Compliance review**:

- All PRs MUST verify compliance with the principles touched by the
  change. Reviewers SHOULD reject PRs that introduce undocumented
  principle violations.
- Complexity that violates a principle MUST be justified in the
  affected feature's `plan.md` Complexity Tracking table, including
  the simpler alternative considered and why it was rejected.
- Quarterly, maintainers SHOULD audit recent merges for drift; any
  systemic drift triggers either an enforcement tightening or a
  constitutional amendment — never silent acceptance.

**Runtime guidance**: Day-to-day development guidance (style snippets,
how-tos, quickstarts) lives outside this document. This constitution
defines the *non-negotiable rules*; operational know-how belongs in
`README.md`, in-repo docs, or agent-guidance files when those exist.

**Version**: 1.0.1 | **Ratified**: 2026-04-17 | **Last Amended**: 2026-04-25
