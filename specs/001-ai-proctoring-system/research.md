# Phase 0 Research: Secure AI Proctoring System

**Feature**: 001-ai-proctoring-system
**Date**: 2026-04-17
**Purpose**: Resolve open technical questions identified in `plan.md` before design artifacts are produced. Each entry records the **Decision**, **Rationale**, and **Alternatives considered** so a later reader (or the /speckit.plan re-evaluation) can audit the reasoning.

---

## R1. Testing Stack

**Decision**:
- **Unit / component tests**: Vitest + @testing-library/react + jsdom.
- **Integration tests**: Vitest runner; tests hit a dedicated Supabase *test* project (separate URL/keys from dev/prod) using the service-role key from a test-only `.env.test`. RLS policies are exercised with anon-key sessions impersonating seeded users.
- **End-to-end tests**: Playwright (Chromium headless) driving the real Vite dev server against the test Supabase project.
- **Detection-engine validation**: a versioned `tests/fixtures/gaze-corpus/` directory of short recorded frames and ground-truth annotations; a scripted benchmark (`tests/fixtures/scored-sessions/`) replays sessions against `violationScorer` and `CheatingScoreService` and asserts recall / false-positive bounds (SC-005).

**Rationale**:
- Vitest integrates natively with Vite (already the build tool) — no separate Jest configuration to maintain.
- Constitution Principle II forbids DB mocks on integrity-critical paths; a real Supabase test project is the only way to catch schema/RLS drift before prod.
- Playwright is the best-supported cross-browser driver and gives us a realistic environment for camera-permission prompts (via `--use-fake-ui-for-media-stream` + `--use-fake-device-for-media-stream`) and for headed debugging when needed.
- A fixture corpus is mandated by Principle II for detection-engine changes; without it, threshold tuning is guesswork.

**Alternatives considered**:
- *Jest*: rejected — requires separate transform configuration for TS + Vite assets and duplicates Vitest's capabilities.
- *Cypress*: rejected — camera/media-stream emulation is more awkward than Playwright's CDP-native flags, and Playwright's Chromium/Firefox/WebKit coverage matches our browser support matrix.
- *Mocking Supabase in integration tests*: explicitly forbidden by constitution. Rejected.

---

## R2. Live Oversight Channel — Supabase Realtime vs. In-House WebSocketService

**Decision**: Use **Supabase Realtime** (Postgres changes + broadcast channels) as the single authoritative live channel. Remove the parallel `src/services/WebSocketService.ts` before merging this feature.

**Rationale**:
- Supabase Realtime is already wired through `@supabase/supabase-js`, carries auth + RLS context, and requires no separately-deployed infrastructure.
- RLS policies on `instructor_alerts`, `exam_sessions`, and `violation_events` automatically gate what flows into each subscriber; a self-managed WebSocket requires re-implementing that boundary in application code.
- Keeping two channels violates Constitution Principle I ("no dead code") and creates a forking event taxonomy that could drift — exactly the failure mode Principle III (UX Consistency) is meant to prevent.
- The instructor dashboard consumes three signals: (a) per-session score updates, (b) alert events, (c) submission-complete events. All three are natural Postgres `UPDATE`/`INSERT` triggers on existing tables, so a Realtime subscription is a direct fit.

**Alternatives considered**:
- *Keep WebSocketService, deprecate Realtime*: rejected — we would own protocol, auth, hosting, and backpressure; Supabase already solves these.
- *Run both in parallel, let features choose*: rejected — violates single-source-of-truth and complicates reconnect/dedup logic.

**Consequence**: `src/services/WebSocketService.ts` is deleted during implementation. Any current caller is redirected to the Supabase Realtime client.

---

## R3. Reference-Face Storage (Identity Verification)

**Decision**: Store a **face descriptor embedding** (a float32 vector produced by `face-api.js`'s `faceRecognitionNet`, ~128 dimensions) in a new `student_face_references` table — **not** the raw image. Verification at exam-join time computes a live embedding on-device and compares it to the stored embedding via Euclidean distance against a configured threshold. The raw reference image is discarded immediately after embedding extraction.

**Rationale**:
- Functional Requirement FR-030 prohibits persisting raw camera frames server-side. A face embedding is a one-way derived signal: it is useful for same-person verification but cannot be reversed into a viewable portrait of the student.
- Comparing embeddings on the client (or via a lightweight Edge Function) keeps verification decisions fast and privacy-preserving. No face image travels to the server.
- The `face-api.js` library is already a project dependency; no new ML model weights are added.

**Alternatives considered**:
- *Store raw reference image in Supabase Storage, compare on server*: rejected — directly violates FR-030 and introduces a high-sensitivity data class into the storage bucket.
- *Server-side embedding with a third-party ML provider*: rejected for v1 — adds external dependency, cost, and a new data-handling contract. Revisit if client-side recognition accuracy proves insufficient.
- *Hash of embedding only*: rejected — embeddings must support similarity comparison, not just equality.

**Consequences**:
- New migration `006_access_codes_and_submissions.sql` (or a sibling) adds `student_face_references(student_id uuid PRIMARY KEY, embedding float4[] NOT NULL, created_at timestamptz, quality_score float)`.
- RLS: a student may `INSERT`/`SELECT` their own row; no other role may read it except via a purpose-built RPC used by verification flow (and even that RPC never returns the raw embedding to the instructor).
- Re-enrollment (replacing the reference) is an explicit user-initiated flow, not a silent overwrite.

---

## R4. Cheating-Score Mathematics (Decay + Thresholds)

**Decision**: Implement a **severity-weighted exponential-decay score** computed incrementally:

```
score(t) = score(t_prev) * exp(-λ * Δt) + Σ severity(event)   for events in (t_prev, t]
score is clamped to [0, 100]
```

where `λ = ln(2) / half_life_seconds`, default `half_life_seconds = 60` (the score of a one-off minor incident halves in a minute), and per-event severity comes from a lookup table in `src/types/examSession.ts` (e.g., gaze-off-screen = 3, focus-loss = 5, multiple-persons = 15, camera-loss = 25).

Thresholds:
- **Warning** (student-visible, non-blocking): score ≥ 30 **or** any single severity-≥ 10 event occurring.
- **Critical** (instructor-alert): score ≥ 60 **sustained for ≥ 10 s** — the sustained-duration gate prevents single-frame spikes from paging the instructor.

All constants (half-life, severity weights, thresholds) live in one place (`src/utils/violationScorer.ts`) and are loaded by `CheatingScoreService` — not duplicated.

**Rationale**:
- Exponential decay naturally satisfies the spec's "sustained violations carry more weight than transient ones" (FR-015) without requiring window-based bookkeeping.
- Clamping prevents one heavy event from permanently pegging the score and makes the metric intuitively a percentage.
- Sustained-duration gating on critical alerts directly addresses the false-positive trade-off called out in the edge cases.
- Single-source-of-truth for constants is enforced by Principle III (UX Consistency — same taxonomy in student, instructor, and evidence surfaces).

**Alternatives considered**:
- *Fixed rolling window (e.g., last 60 s)*: rejected — creates edge artifacts when events fall out of the window and doesn't capture long-session drift.
- *ML-based anomaly detector*: deferred — would require a training corpus we don't yet have; revisit in v2 once the fixture corpus is populated.

---

## R5. Evidence-Snippet Storage & Retention

**Decision**: Evidence snippets (short ~1–3 s clips captured around high-severity events) are uploaded to a **private Supabase Storage bucket** (`evidence-snippets`) via signed URLs. A row in `evidence_artifacts(session_id, violation_event_id, bucket_path, captured_at, expires_at)` links each artifact to its event. Retention window defaults to **30 days** post-submission; a nightly job (Supabase Edge Function on a cron trigger) purges expired artifacts unless they've been marked `retained_for_case = true` by an instructor. When the exam's proctoring policy disables visual evidence, the upload path is short-circuited client-side — zero bytes reach the bucket (FR-020, SC-010).

**Rationale**:
- A separate bucket keeps sensitive media isolated from other app assets and lets us apply bucket-level retention/backup policies distinct from general storage.
- Signed URLs (short TTL) scope read access to specific instructors at review time rather than making snippets broadly readable.
- Linking artifacts via `violation_event_id` makes the evidence package trivial to assemble at submission time without rescanning media.

**Alternatives considered**:
- *Store clips as base64 in the Postgres row*: rejected — bloats rows, defeats signed-URL scoping, and breaks the retention-purge model.
- *Ship clips as email attachments to the instructor*: rejected — inconsistent with dashboard-primary delivery (spec Assumption) and creates uncontrolled copies.
- *Indefinite retention*: rejected — privacy risk out of proportion to usefulness for completed exams.

---

## R6. Server-Authoritative Time

**Decision**: All admit, submit, and grading timestamps are assigned by **Postgres `now()`** inside server-executed statements (RPC functions or `DEFAULT now()` columns with server-generated `INSERT`s). Client timestamps are recorded alongside for diagnostics but are **not** used for eligibility (`exam_session.admitted_at`, `submissions.submitted_at`, `violation_events.server_recorded_at`).

**Rationale**:
- FR-031 requires the server-authoritative clock. Postgres `now()` is the simplest unforgeable source on Supabase.
- A dedicated time endpoint (e.g., an Edge Function returning the server clock) is unnecessary overhead when eligibility decisions can be made inside the RPC that already needs to happen server-side.

**Alternatives considered**:
- *Trust client clocks with NTP*: rejected — students can manipulate local clocks.
- *Run a separate time-service*: rejected — extra dependency for a problem Postgres already solves.

---

## R7. Access-Code Generation

**Decision**: 8-character **Crockford Base32** codes (uppercase alphabet, no `I`/`L`/`O`/`U` to avoid ambiguity) generated by a Postgres function during the `publish_exam` RPC. Uniqueness is enforced by a `UNIQUE` index on `exams.access_code` within the subset of `status IN ('published', 'scheduled')`. The code is invalidated (set `NULL` or moved to a history column) when `status` transitions to `closed`.

**Rationale**:
- 8 Crockford chars = `32^8 ≈ 1.1 × 10^12` codes — collision probability is negligible for realistic concurrent-exam counts.
- Human-enterable: no ambiguous glyphs, uppercase, short enough to share verbally or in chat.
- Uniqueness only against *currently active* exams is sufficient and allows code reuse after exams close without exhausting the space.

**Alternatives considered**:
- *UUIDs*: rejected — too long for humans to type reliably.
- *6-digit numeric codes (Kahoot-style)*: rejected at scale — 6 digits is only ~1 M codes, collision-prone at institution scale and easier to brute-force-type.
- *Per-student unique codes*: rejected — explicit spec Assumption ("One access code per exam").

---

## R8. Auto-Grading Scope

**Decision**: For v1, the system auto-grades only the following question types:
- `multiple_choice_single` (single correct option)
- `multiple_choice_multi` (exact set match)
- `true_false`
- `short_answer_exact` (normalized case-insensitive exact match against a list of accepted answers)

Everything else (`free_response`, anything with rubric grading) is delivered as **awaiting-instructor-grading** with a preliminary score that excludes the ungraded items. The `submissions.grade_status` column tracks `auto_final | partial_pending_review | fully_pending_review`.

**Rationale**:
- These four types have unambiguous, testable auto-grading semantics.
- FR-024 explicitly allows a preliminary grade and requires surfacing which items await human grading — the tri-state `grade_status` column makes that surfacing deterministic.
- Avoids v1 scope creep into LLM-based rubric grading, which would demand its own spec.

**Alternatives considered**:
- *Include fuzzy short-answer matching*: rejected for v1 — ambiguity introduces false negatives; revisit when we have training data.
- *LLM rubric grading*: rejected for v1 — separate feature, separate trust/accuracy conversation.

---

## R9. Detection Pipeline Placement (Main Thread vs. Worker)

**Decision**: Face detection runs on the **main thread** via MediaPipe Tasks + `OffscreenCanvas` where supported; if per-frame p95 exceeds the 16 ms budget on the baseline device (Constitution Principle IV), move to a `DedicatedWorker` with `OffscreenCanvas` transfer. Gaze analysis (lightweight math on landmark arrays) stays on the main thread regardless. Face-api.js identity embedding — only run at verification step, not per-frame — stays on the main thread.

**Rationale**:
- Jumping straight to a worker without measurement risks premature complexity; Principle IV demands measurement, not guessing.
- MediaPipe + `OffscreenCanvas` is the lowest-overhead path when it fits the budget.
- Identity embedding is a one-shot operation, not a streaming one — no benefit to a worker.

**Alternatives considered**:
- *Worker from day one*: rejected — adds transfer-overhead and debugging complexity before it's proven necessary.
- *WebAssembly SIMD tuning*: deferred — revisit if measurement shows we're CPU-bound on math rather than I/O-bound on frame grab.

---

## R10. Offline Event Buffering

**Decision**: `ViolationEventService` maintains an in-memory queue plus a persistent `IndexedDB` overflow. Events are batched every 2 s (or every 50 events, whichever comes first) into a single `record_violation_batch` RPC call. On network failure, events stay in IndexedDB; on reconnect, the service drains in submission order with an `idempotency_key = (session_id, client_event_id)` that Postgres uses to `INSERT ... ON CONFLICT DO NOTHING`.

**Rationale**:
- Satisfies FR-018 (no event loss across outages) and SC-009 (100% delivery, no duplicates) with a simple, server-verifiable idempotency contract.
- IndexedDB is already permitted in our browser support matrix and handles multi-tab persistence cleanly.
- Batching keeps network usage bounded (Constitution Principle IV — sustained per-event POSTs prohibited).

**Alternatives considered**:
- *LocalStorage*: rejected — size-constrained and synchronous (blocks main thread).
- *Fire-and-forget fetch per event*: rejected — violates Principle IV and offers no recovery on outages.

---

## R11. Reference-Face Capture Flow (First-Time Enrollment)

**Decision**: When a student attempts their first exam join with no `student_face_references` row, the UI routes them to a dedicated **reference-capture step** before the verification step. This step:
1. Displays a privacy notice (per FR-032) explaining what will be stored (an embedding, not an image) and retention.
2. Captures three frames at the student's command (not continuously).
3. Requires all three embeddings to be pairwise similar (a quick consistency check — rejects low-quality captures).
4. Stores the median embedding as the reference.
5. Discards all three captured frames in memory immediately on success.

Only after successful capture does the exam-join verification flow resume, and this first verification does **not** consume a retry attempt against the student's budget for this exam.

**Rationale**:
- FR-009 requires routing to a reference-capture flow before counting attempts.
- Three-frame consistency check cheaply rejects blurry / off-axis / lighting-failure captures that would produce false rejects at verification time.
- Storing the median is more robust to a single noisy capture than storing any single one.

**Alternatives considered**:
- *Single-frame capture*: rejected — quality too variable.
- *Continuous capture (record a short clip)*: rejected — stores more than needed, harder to justify under FR-030.
- *Institution-provided photos*: deferred — valuable integration but out of v1 scope.

---

## Open Items Resolved vs. Deferred

| Item | State | Notes |
|------|-------|-------|
| Testing stack | Resolved (R1) | Vitest + Playwright + real Supabase test project |
| Live channel mechanism | Resolved (R2) | Supabase Realtime; WebSocketService retired |
| Reference-face storage | Resolved (R3) | Embeddings only, not images |
| Cheating-score math | Resolved (R4) | Exponential decay, severity-weighted |
| Evidence snippet storage | Resolved (R5) | Private bucket, signed URLs, 30-day retention |
| Server-authoritative time | Resolved (R6) | Postgres `now()` in RPCs |
| Access-code format | Resolved (R7) | 8-char Crockford Base32 |
| Auto-grading scope | Resolved (R8) | Four objective types only in v1 |
| Detection-pipeline placement | Resolved (R9) | Main thread first, Worker on budget miss |
| Offline event buffering | Resolved (R10) | IndexedDB + idempotent batch RPC |
| Reference-capture flow | Resolved (R11) | Three-frame consistency capture |
| Auto-termination policy | **Deferred** | Assumption in spec; expected to be refined in `/speckit.clarify` |
| Mobile/tablet support | **Deferred** | Out of v1 scope per spec |
| Institution-provided reference photos | **Deferred** | Integration in later version |

No `NEEDS CLARIFICATION` markers remain from Technical Context.
