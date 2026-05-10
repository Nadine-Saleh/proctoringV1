# Feature Specification: Refactor for Clean Code & Junior-Friendly Structure

**Feature Branch**: `002-refactor-clean-code`
**Created**: 2026-05-01
**Status**: Draft
**Input**: User description: "refactor this project, ensure clean code and scaling principles are applied, make components structured in a way that is easy to maintain by a junior developer"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Junior Developer Onboards and Locates Code (Priority: P1)

A new junior developer joins the team and is asked to fix a bug in the live proctoring score logic. Within their first day, they can open the project, navigate the directory tree, and identify exactly where to make the change without needing a senior engineer to point them to the correct file.

**Why this priority**: The user's core stated goal is maintainability by junior developers. If a junior cannot find code quickly, every other refactor benefit is undermined. This story alone delivers immediate onboarding value.

**Independent Test**: A developer who has never seen the project is given a written change request (e.g., "adjust how head-pose alerts are scored") and asked to point to the file(s) that must change. Success: they identify the correct files in under 10 minutes using only the directory structure and a top-level README/architecture map.

**Acceptance Scenarios**:

1. **Given** a junior developer with no prior project knowledge, **When** they open the repository root, **Then** a top-level structure document explains what each top-level folder contains and where to start.
2. **Given** a feature area (e.g., "exam session", "alerts", "scoring"), **When** the developer searches the codebase, **Then** related logic, types, and UI components for that feature live in a single, predictable location rather than being scattered.
3. **Given** a UI component, **When** the developer opens its file, **Then** the file is short enough to read in one screen-scroll and its responsibilities are immediately clear from its name and structure.

---

### User Story 2 - Reusable Pieces Replace Duplicated Logic (Priority: P1)

A developer needs to add a new alert type. They reuse existing building blocks (alert rendering, event logging, scoring contribution) instead of copy-pasting from a similar alert. The same applies to repeated UI patterns (cards, status badges, modals) and repeated data-access patterns (Supabase queries, signed-URL retrieval).

**Why this priority**: Duplication is the primary cost driver when scaling. Removing it now prevents the cost from compounding as more proctoring features are added.

**Independent Test**: Pick three pieces of duplicated logic that exist today (e.g., similar Supabase query wrappers, repeated event-emission code, repeated component layouts). After refactor, each is implemented once and reused. Adding a hypothetical fourth alert type requires no copy-paste.

**Acceptance Scenarios**:

1. **Given** two or more places that previously contained near-identical logic, **When** the refactor is complete, **Then** that logic exists in exactly one shared location and both call sites reference it.
2. **Given** a new feature is added that follows an existing pattern, **When** a developer implements it, **Then** they extend or compose existing primitives instead of duplicating them.
3. **Given** a shared utility, **When** a developer reads its name and signature, **Then** its purpose and inputs/outputs are clear without needing to read its body.

---

### User Story 3 - Concerns Are Separated and Files Stay Small (Priority: P2)

UI components do not contain business logic, data fetching, or AI-model interaction code directly. Instead, components consume hooks/services that own those concerns. No single file exceeds a clear size budget, and each file has a single, nameable responsibility.

**Why this priority**: Mixed concerns are the second-largest source of bugs and the biggest barrier to safe change for juniors. Separating them makes tests easier and changes safer, but builds on the structural work in P1.

**Independent Test**: Pick the five largest files in the project today. After refactor, none exceeds the agreed size budget, and each one's role can be described in a single sentence.

**Acceptance Scenarios**:

1. **Given** a UI component file, **When** it is reviewed, **Then** it contains presentation and event wiring only — no direct database, network, or model-inference calls.
2. **Given** a business rule (e.g., how a cheating score is computed), **When** a developer needs to change it, **Then** the change is made in one well-named module without touching UI code.
3. **Given** any source file in the refactored project, **When** measured, **Then** it falls within the documented size and complexity budget, or carries a written justification for the exception.

---

### User Story 4 - Behavior Is Preserved End-to-End (Priority: P1)

Every existing user-visible feature — student exam taking, live proctoring detection, alert generation, instructor dashboards, evidence review, scoring — continues to behave identically after the refactor. No regressions are introduced.

**Why this priority**: A refactor that breaks features is a net negative regardless of code quality gains. This story is the safety net for all the others.

**Independent Test**: Run the full existing test suite and a documented manual smoke pass of the primary flows on the refactored branch. All must pass at least at parity with `main` before merge.

**Acceptance Scenarios**:

1. **Given** the existing automated test suite, **When** it is run on the refactored branch, **Then** it passes at the same or higher rate than on `main`.
2. **Given** a documented set of primary user flows (student joins exam, instructor views live session, alert is raised and reviewed, evidence is fetched), **When** each is exercised manually on the refactored branch, **Then** observable behavior matches the pre-refactor baseline.
3. **Given** any change made during the refactor, **When** committed, **Then** it is paired with — or covered by — a test that locks in the behavior it preserves or clarifies.

---

### User Story 5 - Naming and Conventions Are Consistent (Priority: P2)

File names, folder names, exported symbols, hooks, and component props follow a single documented convention across the project. A junior can predict where a new file should go and what it should be called.

**Why this priority**: Consistency compounds over time. It is a quality-of-life improvement that pays off most after the structural moves of P1 land.

**Independent Test**: A developer is asked to add a new feature folder for a hypothetical "speech detection" capability. Without asking anyone, they place files in locations and use names that match a written convention document and the existing patterns.

**Acceptance Scenarios**:

1. **Given** the refactored project, **When** a reader scans folder and file names, **Then** the casing, pluralization, and suffix conventions are uniform.
2. **Given** a new contributor reads a one-page conventions document, **When** they create a new module, **Then** their naming choices match without further guidance.

### Edge Cases

- A file that legitimately needs to exceed the size budget (e.g., a generated type file, a large schema definition) — must be documented and justified rather than forced to split.
- An existing third-party integration whose API forces a specific structure (e.g., a vendor SDK initialization) — convention can defer to vendor requirements, with a comment.
- A feature module whose logic is genuinely cross-cutting (e.g., authentication, telemetry) — placement rules must explicitly cover "shared infrastructure" so juniors do not invent their own folders for it.
- Mid-flight in-progress feature branches that have not yet merged — the refactor must define how their authors rebase without losing work.
- Performance-sensitive code paths (live video frame processing) — restructuring must not introduce per-frame allocations or indirection that degrade live detection latency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST be reorganized so that each user-facing feature area (exam session, proctoring detection, alerts, scoring, evidence, dashboards) has a clearly identified home in the directory tree.
- **FR-002**: The project MUST contain a written, top-level structure document that describes what lives where and how to find code for a given feature, intended to be readable by a developer with no prior context in under 15 minutes.
- **FR-003**: Duplicated logic identified during the refactor MUST be consolidated into single, named, reusable units; call sites MUST reference the shared unit rather than re-implement it.
- **FR-004**: UI components MUST NOT directly contain data-access, AI-model invocation, or persistence logic; those concerns MUST be encapsulated in dedicated modules (e.g., hooks, services) that components consume.
- **FR-005**: Every source file in the refactored project MUST conform to a documented size and complexity budget, or carry a written justification for an exception.
- **FR-006**: A documented naming and folder convention MUST be applied consistently across the refactored codebase.
- **FR-007**: All existing user-visible behavior MUST be preserved; no functional regressions are acceptable as a result of this refactor.
- **FR-008**: The full existing automated test suite MUST pass on the refactored branch before it is merged.
- **FR-009**: A documented manual smoke checklist covering the primary user flows MUST be defined and executed on the refactored branch before merge.
- **FR-010**: Public exports of each feature module MUST present a small, intentional surface (an "entry point") so that consumers do not reach into module internals.
- **FR-011**: Cross-cutting concerns (authentication, configuration, logging/telemetry, error handling, shared backend client setup) MUST live in clearly labeled shared locations distinct from feature modules.
- **FR-012**: Dead code, unused exports, and obsolete files identified during the refactor MUST be removed rather than left in place.
- **FR-013**: The refactor MUST be delivered incrementally in reviewable units, each of which leaves the application in a working state.

### Key Entities

- **Feature Module**: A self-contained unit owning the UI, hooks, services, and types for one user-facing capability. Has a documented entry point and minimal external dependencies.
- **Shared Primitive**: A reusable building block (UI component, hook, utility, type) used by two or more feature modules; lives in a shared location and has a stable, documented interface.
- **Cross-Cutting Service**: Infrastructure code (auth, backend access, telemetry, configuration) consumed by many features; isolated from feature-specific logic.
- **Structure Document**: A short, maintained guide describing the directory layout, conventions, and where to add new code.
- **Smoke Checklist**: A documented set of manual user flows used to verify behavior parity before merging the refactor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with no prior exposure to the project can locate the file(s) responsible for a named feature area in under 10 minutes using only the structure document and folder names, in 9 out of 10 trials.
- **SC-002**: The number of source files exceeding the documented size/complexity budget drops to zero (or to a small set of explicitly justified exceptions) by the end of the refactor.
- **SC-003**: At least three pieces of previously duplicated logic are consolidated into single shared units with all prior call sites updated to use them.
- **SC-004**: 100% of the existing automated test suite passes on the refactored branch at merge time.
- **SC-005**: 100% of the documented smoke-checklist flows behave identically to the pre-refactor baseline on the refactored branch.
- **SC-006**: Adding a hypothetical new feature module of comparable scope to an existing one (measured on a sample task) takes a junior developer no longer than it does on `main`, and ideally less time.
- **SC-007**: No source file in the refactored project mixes UI rendering with direct data-access or model-inference calls (verified by a documented audit).
- **SC-008**: The refactor is delivered as a sequence of independently reviewable changes, each of which leaves the application runnable and tests passing.

## Assumptions

- Existing user-visible features and their behavior are considered the source of truth; the refactor does not introduce, remove, or redesign features.
- The current technology stack is retained; no framework migration is in scope.
- Existing automated tests adequately cover behavior worth preserving; gaps discovered during refactor will be filled with new tests rather than skipped.
- Performance characteristics of live detection paths (frame-rate, latency) are at least preserved; degradation is treated as a regression.
- The refactor is performed on a dedicated branch and merged once parity is demonstrated; no parallel feature work is blocked indefinitely on it.
- "Junior developer" means someone fluent in modern TypeScript/React but without prior exposure to this project's domain or codebase.
- Size/complexity budgets and naming conventions will be agreed at the start of the planning phase and documented before substantive code moves begin.
