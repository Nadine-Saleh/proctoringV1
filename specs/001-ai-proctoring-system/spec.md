# Feature Specification: Secure AI Proctoring System

**Feature Branch**: `001-ai-proctoring-system`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "Build a secure AI proctoring system where instructors create exams and generate unique access codes for their students. Students join by entering the code and must pass an identity verification step using face recognition before the exam starts. Once verified, the system monitors the student in real-time, calculating a cheating score based on behavior. After submission, the system must send the final grades along with evidence of any flagged cheating incidents directly to the instructor for review."

## Clarifications

### Session 2026-04-20

- Q: Which severity values are allowed for violation events? → A: `low`, `medium`, `high`, `critical`
- Q: Which session status may call the violation-recording RPC? → A: `in_progress` only

- Q: What should happen if the session pre-check fails before calling the violation-recording RPC? -> A: Return `session_not_in_progress` and do not call the mutating RPC

### Session 2026-04-19

- Q: What form of data is stored as the student's reference face? → A: Mathematical embedding only — a float vector (128 numbers) derived from the face; cannot be reversed into an image.
- Q: When is the reference embedding captured? → A: Inline at first exam join — if no embedding exists, the join flow inserts a reference-capture screen before the first verification attempt counts against the retry budget.
- Q: Is one reference embedding stored per student (reused across all exams) or fresh per exam? → A: One per student — a single embedding keyed by student_id is reused for every exam the student takes.

### Session 2026-04-18

- Q: On sustained critical cheating score, should the system auto-terminate, alert only, auto-pause, or escalate? → A: Alert only — never auto-terminate; instructor decides via an explicit manual control.
- Q: Default maximum verification attempts per exam join? → A: 3 attempts.
- Q: Visual evidence snippet retention window (default, before purge unless attached to an academic-integrity case)? → A: 14 days.
- Q: Disconnect grace period before a mid-exam session auto-submits? → A: 10 minutes.
- Q: Default warning/critical cheating-score thresholds and sustained duration before an instructor alert fires? → A: warning = 40, critical = 70, sustained = 10 s (on the 0–100 live score).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instructor Authors an Exam and Generates an Access Code (Priority: P1)

An instructor authenticates to the platform, creates a new exam (title, questions, scheduled window, duration, and proctoring policy), and publishes it. On publish, the system generates a unique access code that the instructor can share with the intended cohort.

**Why this priority**: Without a published exam and a distributable access code, no downstream flow (joining, verification, monitoring, grading) is possible. This is the foundation of the MVP.

**Independent Test**: An instructor account creates an exam with at least one question, publishes it, and receives an access code. Verified by retrieving the exam from the instructor dashboard and confirming the code is unique, associated with the exam, and displayable for sharing.

**Acceptance Scenarios**:

1. **Given** an authenticated instructor on the exam authoring screen, **When** the instructor fills in required fields (title, at least one question, start time, duration) and clicks publish, **Then** the system creates the exam, generates a unique access code, and displays the code in the instructor's exam list.
2. **Given** a published exam with an access code, **When** the instructor views the exam detail page, **Then** the access code, the scheduled window, and the number of students who have joined so far are visible.
3. **Given** a draft exam with missing required fields, **When** the instructor clicks publish, **Then** the system prevents publication and identifies which fields are missing.
4. **Given** a published exam, **When** the instructor edits a question after publication but before the exam window opens, **Then** the change is saved and the access code is unchanged.

---

### User Story 2 - Student Joins an Exam by Code and Passes Identity Verification (Priority: P1)

A student authenticates to the platform, enters the access code for the exam they were assigned, grants the required camera permission, and completes a face-recognition identity check. On success, they are admitted to the exam start screen. On failure, they receive guidance and may retry up to a bounded number of attempts before being blocked pending instructor intervention.

**Why this priority**: Identity verification is the primary trust gate of the entire product. Without it, monitoring and grade attribution are meaningless. This story closes the "who is taking the exam" question before any scoring begins.

**Independent Test**: A student account with a stored reference embedding enters a valid access code, completes verification on the first attempt, and is routed to the exam start screen. Verified by confirming the student's session record shows `verified`, the exam is listed on their active-exams screen, and the admit timestamp is recorded.

**Acceptance Scenarios**:

1. **Given** an authenticated student holding a valid access code for an exam whose window is open, **When** the student enters the code and grants camera access, **Then** the system presents the identity verification step.
2. **Given** a student at the verification step whose live-captured embedding matches their stored reference embedding within the configured confidence threshold, **When** verification completes, **Then** the student is admitted to the exam and an admit record is stored.
3. **Given** a student whose first verification attempt does not match, **When** the student retries, **Then** the system allows up to the configured maximum number of attempts with clear guidance (lighting, face framing) between attempts.
4. **Given** a student who has exceeded the maximum verification attempts, **When** the final attempt fails, **Then** the student is blocked from entry, the instructor is notified for manual review, and no exam session is created.
5. **Given** a student entering an access code that is invalid, expired, or outside the exam window, **When** they submit the code, **Then** the system rejects entry with a specific reason message.
6. **Given** a student on a device that denies camera permission, **When** they reach the verification step, **Then** the system presents a permission-recovery flow and does not admit the student until permission is granted.

---

### User Story 3 - Real-Time Behavior Monitoring and Cheating Score During the Exam (Priority: P1)

Once a verified student begins the exam, the system continuously observes the student's behavior (gaze direction, face presence, presence of additional people, audio anomalies, tab/window focus loss, suspicious device interactions) and maintains a live cheating score. Violation events are recorded with timestamps and, where the exam policy permits, short evidence snippets. The student is given graduated feedback (e.g., warnings for correctable behaviors) while the instructor can observe the live score on an oversight dashboard.

**Why this priority**: Real-time monitoring is the core differentiator of the product and the primary source of evidence. Without it, verification would confirm identity but not integrity during the exam itself.

**Independent Test**: A verified student begins an exam, deliberately triggers one instance each of representative violation types (looks off-screen for an extended period, leaves the tab, a second face enters frame), and observes that (a) the cheating score increases, (b) each violation is logged with timestamp and category, and (c) the instructor dashboard reflects the score within the expected refresh cadence.

**Acceptance Scenarios**:

1. **Given** a verified student who has started the exam, **When** the student performs normally (face visible, gaze on screen, single person present), **Then** the cheating score remains at or near its baseline and no violation events are recorded.
2. **Given** an active exam session, **When** the student's gaze is consistently off-screen for longer than the configured threshold, **Then** a "gaze-off-screen" violation is recorded and the cheating score increases proportionally to the violation's severity.
3. **Given** an active exam session, **When** a second face becomes visible in the camera frame, **Then** a "multiple persons detected" violation is recorded with higher severity than minor gaze violations.
4. **Given** an active exam session, **When** the student's cheating score crosses a warning threshold, **Then** the student receives a visible, non-blocking warning describing what behavior was detected.
5. **Given** an active exam session, **When** the student's cheating score crosses a critical threshold that was sustained for the configured duration, **Then** the instructor is alerted in real time on their oversight dashboard.
6. **Given** an active exam session, **When** network connectivity is temporarily lost, **Then** violation events captured during the outage are buffered locally and transmitted when connectivity is restored, with no loss of events.
7. **Given** an active exam session, **When** the student's camera feed is obscured (covered, unplugged, or permission revoked), **Then** a "camera unavailable" violation is recorded and the instructor is alerted.

---

### User Story 4 - Submission Delivers Grade and Flagged Evidence to the Instructor (Priority: P2)

When the student submits the exam (manually or via auto-submit at the end of the exam window), the system finalizes answers, computes the final grade for auto-gradable questions, assembles an evidence package (flagged violation timeline, severity summary, final cheating score, and any visual evidence captured under the exam's policy), and delivers both the grade and the evidence package to the instructor. The instructor can open each student's record and review the evidence in context to decide on final adjudication.

**Why this priority**: This story completes the product loop. The system's value to the instructor is realized only when grades and the evidence supporting integrity decisions land in their dashboard together, making adjudication efficient and defensible.

**Independent Test**: A student completes and submits an exam with a mix of normal behavior and at least two flagged incidents. The instructor opens the student's record and confirms: (a) the final grade appears within the expected delivery time, (b) the flagged-incident timeline is complete and ordered, (c) evidence snippets (if the policy enables them) are linked and playable, and (d) the final cheating score is displayed alongside its contributing categories.

**Acceptance Scenarios**:

1. **Given** a student who submits an exam manually before the exam window ends, **When** submission is confirmed, **Then** the student sees a success confirmation and the instructor's dashboard shows the submission within the expected delivery window.
2. **Given** a student who is still in an active session when the exam window closes, **When** the window ends, **Then** the system auto-submits the student's current answers, records the auto-submit reason, and delivers the grade and evidence to the instructor the same way as a manual submission.
3. **Given** a submitted exam with multiple flagged incidents, **When** the instructor opens the student's record, **Then** each incident is presented with timestamp, category, severity contribution to the final score, and any captured visual evidence linked and reviewable.
4. **Given** a submitted exam with no flagged incidents, **When** the instructor opens the student's record, **Then** the evidence section clearly indicates "no flagged incidents" and shows the final cheating score at its baseline.
5. **Given** a submitted exam whose submission attempt failed due to transient error, **When** the system retries delivery, **Then** the grade and evidence are delivered without duplication and the instructor sees a single authoritative record.
6. **Given** a submitted exam whose questions are all auto-gradable, **When** submission completes, **Then** the final numeric grade is computed by the system and displayed as final.
7. **Given** a submitted exam with free-response questions, **When** submission completes, **Then** the system presents the instructor with a preliminary score for auto-gradable items and surfaces the free-response items awaiting instructor grading.

---

### Edge Cases

- **Time zones and clock skew**: A student joins just before the exam window opens or just after it closes according to their device clock, but the server's authoritative clock disagrees. The system MUST use the server-authoritative clock for admit and submit decisions.
- **Duplicate join on the same code from the same student**: The student opens the exam in a second tab or device. Only one active session is permitted per student per exam; the later attempt is blocked with a clear message.
- **Concurrent submission attempts**: Manual submit and window-close auto-submit race. Exactly one submission is recorded; the second attempt is idempotent and returns the existing submission record.
- **Reference embedding missing or low-quality**: A student has no stored reference embedding (first-ever exam) or the stored embedding has a quality score below the acceptable threshold. The system routes them to an inline reference-capture screen (within the join flow) before allowing any verification attempt to count against their retry budget.
- **False positives in detection**: Lighting, glasses, a passing pet, background movement, or culturally common head coverings cause detections that do not correspond to cheating. The scoring model MUST weight sustained, high-severity signals more than transient, low-severity signals and MUST provide the instructor with raw evidence so they can overturn false positives.
- **Privacy-restricted classrooms**: Some deployments forbid visual evidence capture. When the exam policy disables visual evidence, the system MUST still record violation events and scores but MUST NOT upload or retain frame snippets.
- **Violation event against non-active session**: If monitoring code attempts to record a violation for a session that is not currently `in_progress`, the system MUST return `session_not_in_progress`, MUST NOT call the mutating violation RPC, and MUST leave violation, cheating-score, and alert state unchanged.
- **Student disconnects mid-exam**: The student closes their browser or loses power. On reconnect within a grace period of **10 minutes** (measured from the last server-observed heartbeat / score update), the session resumes from the last saved state; past 10 minutes the session is auto-submitted in its current state with `submit_reason = auto_disconnect`.
- **Instructor disables the exam after publication**: Once the exam is disabled, no new joins are accepted; students with active sessions are allowed to finish unless the instructor explicitly terminates them.
- **Access code sharing outside the cohort**: An unauthorized user enters a leaked code. Because entry requires an authenticated student account and identity verification against a stored reference, a leaked code alone does not grant access.
- **Very short exams**: An exam whose duration is shorter than the combined verification + minimum monitoring warm-up time MUST either be rejected at publication or the verification step MUST not consume exam time.

## Requirements *(mandatory)*

### Functional Requirements

**Exam Authoring & Access Codes**

- **FR-001**: Instructors MUST be able to create an exam with a title, a set of questions, a scheduled start time, a duration, and a proctoring policy (at minimum: whether visual evidence may be retained).
- **FR-002**: The system MUST validate that an exam has at least one question and a duration greater than zero before allowing publication.
- **FR-003**: On publication, the system MUST generate an access code for the exam that is unique across currently active and scheduled exams.
- **FR-004**: Access codes MUST be displayable and copyable to the instructor and MUST be invalidated automatically once the exam window has closed.
- **FR-005**: Instructors MUST be able to view, for each of their exams, the number of students who have joined, the number currently in progress, and the number submitted.

**Student Join & Identity Verification**

- **FR-006**: Students MUST be able to join an exam by entering a valid access code while authenticated to the platform.
- **FR-007**: The system MUST reject join attempts when the code is invalid, the exam window is not open, or the student is already in an active session for the same exam.
- **FR-008**: Before an exam session starts, the system MUST require the student to pass a face-recognition identity check by comparing a live-captured face embedding against their stored reference embedding (128-dimensional float vector).
- **FR-009**: If no reference embedding is on file for the student, the system MUST route them to an inline reference-capture screen — presented within the exam join flow — before counting any verification attempts against the retry budget. There is no separate enrollment step; capture always happens at first exam join. The stored embedding is keyed by `student_id` and reused for all subsequent exams the student takes; no re-capture is required on later joins.
- **FR-010**: The system MUST allow a bounded number of verification retries per exam join attempt (configurable per exam; **default = 3 total attempts**, i.e., the initial attempt plus two retries) and MUST provide guidance between attempts.
- **FR-011**: When a student exhausts all verification attempts, the system MUST block entry, record the outcome, and notify the instructor for manual review.
- **FR-012**: The system MUST record, for every admit decision, a timestamp, the verification outcome, and the confidence score used to make the decision.

**Real-Time Monitoring & Cheating Score**

- **FR-013**: During an active exam session, the system MUST continuously evaluate the student's behavior across at least these categories: gaze direction, face presence, additional persons in frame, tab/window focus loss, and camera availability.
- **FR-014**: The system MUST categorize detected deviations as violation events with a type, a timestamp, and a severity level constrained to the enum `low`, `medium`, `high`, or `critical`; when the exam policy permits, a short visual evidence snippet MAY also be attached.
- **FR-015**: The system MUST compute a live cheating score that aggregates recent violation events with severity-weighted decay so that sustained violations carry more weight than transient ones.
- **FR-016**: The system MUST present graduated, non-blocking feedback to the student when correctable behaviors are detected (e.g., face not centered, gaze off-screen) before those behaviors accumulate into higher-severity flags.
- **FR-017**: The system MUST surface the live cheating score and any critical-threshold alerts to the instructor's oversight dashboard in near real time. The live cheating score is expressed on a 0–100 scale; defaults (configurable per exam) are **warning = 40** (student-visible non-blocking warning) and **critical = 70** (instructor-visible alert raised once the score stays at or above 70 for a sustained duration of **10 seconds**). A score dropping below the critical threshold and crossing it again re-starts the sustained-duration timer; an already-raised alert is not re-raised for the same continuous breach.
- **FR-018**: The system MUST continue to record violation events locally when the network is intermittently unavailable and MUST transmit buffered events without loss when connectivity resumes.
- **FR-018a**: The violation-recording RPC MUST verify that the target exam session is currently in `in_progress` state before inserting a violation event or recalculating the cheating score. Calls for sessions in any other state MUST be rejected without mutating violation, score, or alert records.
- **FR-018b**: When a client-side or service-side pre-check determines that a session is not `in_progress`, the caller MUST return the domain error `session_not_in_progress` and MUST NOT invoke the mutating violation-recording RPC for that session.
- **FR-019**: The system MUST treat loss of the camera signal (covered, unplugged, or permission revoked) as a high-severity violation and MUST alert the instructor.
- **FR-020**: When the exam's proctoring policy disallows visual evidence retention, the system MUST still produce violation events and scores but MUST NOT upload or persist frame snippets.
- **FR-020a**: The system MUST NOT autonomously terminate or auto-submit an exam session based on cheating score alone. On sustained critical-threshold breach the system MUST raise an instructor alert (FR-017) and MUST expose an explicit instructor-invoked termination control; the session remains in `in_progress` until the instructor acts or the exam window closes.

**Submission, Grading, and Evidence Delivery**

- **FR-021**: Students MUST be able to submit the exam manually at any time during the exam window.
- **FR-022**: The system MUST automatically submit a student's current answers when the exam window closes, recording the auto-submit reason distinctly from manual submission.
- **FR-022a**: The system MUST also auto-submit an in-progress session when the student has been disconnected for longer than the configured disconnect-grace window (**default 10 minutes** from the last server-observed heartbeat/score update), recording `submit_reason = auto_disconnect` distinctly from window-close auto-submit.
- **FR-023**: For auto-gradable question types, the system MUST compute the final numeric grade at submission time.
- **FR-024**: For question types that require human grading (e.g., free response), the system MUST present a preliminary grade that excludes ungraded items and MUST clearly flag which items await instructor grading.
- **FR-025**: On submission, the system MUST assemble an evidence package containing the ordered violation timeline, category breakdown, final cheating score, and — if the exam policy permits — linked visual evidence snippets.
- **FR-026**: The system MUST deliver the grade and evidence package to the instructor such that they appear together in the instructor's dashboard for the specific student.
- **FR-027**: Delivery MUST be idempotent: transient failures MUST be retried without producing duplicate submission or evidence records.
- **FR-028**: Instructors MUST be able to open any submitted record and review the evidence package in context (timeline, severity contributions, visual evidence if present) so they can adjudicate and, where needed, adjust the final grade.

**Cross-Cutting Security, Privacy, and Integrity**

- **FR-029**: Only the instructor who authored the exam (or users granted explicit co-instructor access) MUST be able to view submissions and evidence for that exam.
- **FR-030**: Raw camera frames MUST NOT be persisted server-side. The reference face MUST be stored solely as a mathematical embedding (float vector); no reversible image is retained. Only derived signals (violation events) and — when the exam policy explicitly permits — short evidence snippets MAY be stored.
- **FR-031**: All admit, submit, and grading actions MUST be timestamped with the server-authoritative clock, not the client's clock, to prevent client-clock tampering from affecting eligibility or ordering.
- **FR-032**: The system MUST provide students with a plain-language summary, before verification begins, of what data will be collected during the exam and how long it will be retained.
- **FR-033**: Visual evidence snippets (when captured under a permissive policy) MUST be retained for **14 days by default** from the submission timestamp and MUST be purged automatically thereafter, unless the instructor has attached the snippet to a formal academic-integrity case — in which case the snippet MUST be copied to a case-scoped store whose lifecycle is governed by institutional record-retention rules and is out of scope for the 14-day auto-purge.

### Key Entities *(include if feature involves data)*

- **Exam**: An instructor-authored assessment. Attributes include title, questions, scheduled window, duration, proctoring policy (visual-evidence-allowed flag, thresholds), status (draft, published, closed), and owning instructor.
- **Access Code**: A unique, human-enterable identifier associated with exactly one exam; auto-invalidated at window close.
- **Student Reference Face**: A stored 128-dimensional float vector (mathematical embedding) derived from the student's face and used as the source of truth for identity verification. The raw camera frame is never persisted; only the embedding is stored. Keyed by `student_id` — one record per student, captured inline during their first ever exam join, and reused for all subsequent exams without re-capture.
- **Verification Attempt**: A record of each face-recognition attempt — timestamp, confidence score, outcome (pass/fail), and whether it consumed an attempt against the retry budget.
- **Exam Session**: The live instance of a student taking an exam. Attributes: student, exam, admit timestamp, current status (`awaiting_verification`, `verified`, `in_progress`, `submitted`, `auto_submitted`, `terminated`), live cheating score. Only `in_progress` sessions are eligible to emit new violation events or score updates.
- **Violation Event**: A single detected integrity deviation. Attributes: session, type (gaze, multiple-persons, focus-loss, camera-loss, etc.), timestamp, severity (`low` | `medium` | `high` | `critical`), optional evidence snippet reference.
- **Submission**: The final state of a student's answers for an exam. Attributes: session, submitted-at, submit reason (manual, auto-window-close, auto-disconnect), final grade (numeric, with free-response status where applicable).
- **Evidence Package**: The bundle delivered to the instructor at submission. Attributes: submission reference, ordered violation timeline, category summary, final cheating score, visual-evidence links (if permitted by policy).
- **Instructor Alert**: A real-time notification raised when a session crosses a critical cheating-score threshold, when verification fails hard, or when camera loss occurs. Attributes: session, reason, timestamp, acknowledged-at.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An instructor can create and publish an exam, including receiving a shareable access code, in under 5 minutes for an exam with up to 20 questions.
- **SC-002**: At least 95% of students who present their live face in acceptable lighting complete identity verification within 2 attempts and under 90 seconds total.
- **SC-003**: The live cheating score visible to the instructor reflects a detected violation within 5 seconds of the behavior occurring, for at least 95% of violations.
- **SC-004**: At least 99% of exam submissions deliver the final grade and evidence package to the instructor's dashboard within 60 seconds of submission time.
- **SC-005**: On a representative fixture set of recorded sessions, the system's flagged-incident list captures at least 90% of ground-truth violations (recall) while keeping the false-positive rate below 10% of ground-truth non-violations.
- **SC-006**: An instructor can locate a specific student's evidence timeline from the exam dashboard in under 30 seconds after submissions close.
- **SC-007**: During a 2-hour exam at baseline behavior, the proctoring overlay does not cause the student's exam interface to drop below 30 frames-per-second responsiveness on a typical student device.
- **SC-008**: Over a rolling 30-day window, fewer than 1% of exam sessions are terminated or delivered without an evidence package due to system errors.
- **SC-009**: When network connectivity is intermittently lost during an exam, 100% of violation events captured locally are delivered to the server after reconnection with no duplicates and no loss.
- **SC-010**: When visual evidence is disabled by exam policy, zero frame snippets are retained server-side across all sessions under that policy, verifiable by audit.

## Assumptions

- **Authenticated accounts**: Both instructors and students have pre-existing authenticated accounts on the platform. Account provisioning is out of scope for this feature.
- **One access code per exam**: A single unique access code is generated per exam and used by the entire cohort. Per-student unique codes are out of scope; student identity is established by login plus face verification.
- **Reference face capture at first join**: When a student has no stored reference embedding, the system captures one inline during their first exam join — there is no separate enrollment flow. The capture screen is presented within the join flow and the captured embedding is stored before the first verification attempt is counted against the retry budget.
- **Auto-grading where possible**: Objective question types (e.g., multiple choice, short-answer matching) are graded automatically at submission; free-response questions are flagged for the instructor and result in a preliminary grade until manual grading completes.
- **Delivery channel**: "Sending" grades and evidence to the instructor is fulfilled by the instructor's dashboard being updated with the full record within the stated delivery window. An optional notification (e.g., email) may supplement the dashboard but is not the primary delivery channel.
- **Graduated intervention model**: The cheating score contributes to instructor-visible alerts and the evidence package. The system surfaces warnings to the student for correctable behaviors and never autonomously terminates on score alone; termination is always an explicit instructor action (see FR-020a).
- **Browser-based student client**: Students take exams on a modern desktop or laptop browser (latest two stable releases of Chrome, Edge, or Firefox) with camera access. Mobile and tablet support are out of scope for v1.
- **Realtime oversight scale**: A single instructor is expected to oversee up to roughly 50 concurrent sessions on the live dashboard at v1 scale. Larger cohorts are supported, but live-oversight UI prioritizes summary + alert-driven attention over full-grid video.
- **Data retention defaults**: Violation events and submissions are retained for the institution's standard academic record retention period. Visual evidence snippets (when captured) are retained for **14 days** and then purged unless attached to a formal academic-integrity case (see FR-033).
- **Existing infrastructure reuse**: The feature builds atop the project's existing services for exam sessions, violation events, cheating score, and instructor alerts rather than replacing them.

## Dependencies

- A functioning authentication system with distinguishable `instructor` and `student` roles.
- A persistence layer capable of storing exams, sessions, violation events, submissions, and (optionally) visual evidence with appropriate access controls.
- A realtime channel between students' in-exam clients and the instructor's oversight dashboard.
- Browser APIs for camera access and face detection / recognition on the student's device.

