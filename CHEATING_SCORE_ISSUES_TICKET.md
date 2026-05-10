## Issue: Pending Violation Batch Not Flushed Before Submission
- Component: `src/hooks/useExamFlow.ts`, `src/hooks/useViolationTracker.ts`, Edge Function `supabase/functions/submit-exam/index.ts`
- Expected:
  All buffered violations are sent through `record_violation_batch` before exam submission snapshots `exam_sessions.live_cheating_score`, so `submissions.final_cheating_score` and instructor views reflect the latest score.
- Actual:
  Submission only syncs answers, not pending violations. `submit-exam` snapshots `session.live_cheating_score` as-is, so the last 0-2 seconds of violations, or any buffered batch, can be missing from DB and instructor results.
- Reproduction:
  1. Start an exam and trigger several violations.
  2. Submit immediately after a violation, before the 2-second batch timer fires.
  3. Check `exam_sessions.live_cheating_score` and `submissions.final_cheating_score`.
  4. Observe lower-than-expected or zero score in DB / instructor results.
- Logs/Errors: (≤30 lines)
```text
No hard error is required for this failure.
The path currently does:
- queue violation locally
- schedule batch send in 2000ms
- submit exam immediately
- snapshot session.live_cheating_score before batch arrives
```
- Code Snippet: (only the affected function/route/config)
```ts
// src/hooks/useExamFlow.ts
const handleFinalSubmit = useCallback(async () => {
  const targetSessionId = session?.id ?? sessionId;
  if (!targetSessionId) {
    setSubmissionError('Could not identify exam session.');
    return;
  }

  setIsSubmitting(true);
  setSubmissionError(null);
  setShowSubmissionModal(false);

  try {
    await syncToServer(targetSessionId);
    const submittedAnswers = getSubmittedAnswers();
    const result = await submitExam(submittedAnswers, timeElapsed, {
      sessionId: targetSessionId,
      examId: currentExamId,
    });
```

```ts
// src/hooks/useViolationTracker.ts
const BATCH_INTERVAL_MS = 2000;

pendingRef.current.push(fullInput);
scheduleBatchSend();

const syncViolations = useCallback(async () => {
  if (pendingRef.current.length === 0 || !sessionId) return;
  const batch = pendingRef.current.splice(0, MAX_BATCH_SIZE);
  const result = await ViolationEventService.createBatch(batch);
```

```ts
// supabase/functions/submit-exam/index.ts
const finalCheatingScore = session.live_cheating_score ?? 0;
```
- Tried so far:
  Reviewed the submission path and verified that `handleFinalSubmit()` calls `syncToServer()` for answers but never awaits `syncViolations()` before `submitExam()`.
- Priority: P0 | Blocking? Yes

## Issue: Offline Violation Queue Replays Only On Mount
- Component: `src/hooks/useViolationTracker.ts`, `src/services/ViolationEventService.ts`, IndexedDB queue
- Expected:
  If `record_violation_batch` fails temporarily, queued events should replay automatically when connectivity returns during the same exam session, updating DB score and instructor dashboard.
- Actual:
  Offline queue drain runs only once on mount. If the network recovers later, queued violations remain stranded in IndexedDB until remount, so the live cheating score in DB and instructor dashboard stays stale.
- Reproduction:
  1. Start an exam.
  2. Disconnect network or force RPC failure.
  3. Trigger violations.
  4. Reconnect without refreshing the page.
  5. Observe that queued violations are not replayed and instructor score remains unchanged.
- Logs/Errors: (≤30 lines)
```text
[ViolationEventService] record_violation_batch failed
[useViolationTracker] syncError set
queuedCount increments

No online/reconnect listener exists to call drainOfflineQueue again.
```
- Code Snippet: (only the affected function/route/config)
```ts
// src/hooks/useViolationTracker.ts
useEffect(() => {
  ViolationEventService.drainOfflineQueue(res => {
    if (scoreTracker) scoreTracker.updateFromRpcResponse(res);
  }).catch(() => {});
}, [scoreTracker]);
```

```ts
// src/services/ViolationEventService.ts
if (error || !data) {
  for (const ev of events) {
    await idbEnqueue({ sessionId, event: ev }).catch(() => {});
  }
  onOffline?.();
  return null;
}
```
- Tried so far:
  Searched for any `online` event listener or reconnect-triggered `drainOfflineQueue()` call. None exists outside the mount effect.
- Priority: P1 | Blocking? Yes

## Issue: Violation Recording Silently Stops When `examId` Context Is Missing
- Component: `src/hooks/useExamFlow.ts`, `src/hooks/useViolationTracker.ts`, app context exam state
- Expected:
  Violation persistence should use durable session-backed identifiers and continue working even on direct URL entry, refresh, or resumed sessions.
- Actual:
  `useViolationTracker.recordViolation()` hard-requires `sessionId`, `examId`, and `studentId`. In `useExamFlow`, `examId` comes from `currentExam` context only. If that context is missing, violations are dropped before any DB call.
- Reproduction:
  1. Open or refresh `/exam/:sessionId` without coming through the normal `setCurrentExam(...)` flow.
  2. Trigger violations.
  3. Observe that no violation RPC is sent and no cheating score appears in DB/dashboard.
- Logs/Errors: (≤30 lines)
```text
[useViolationTracker] Cannot record violation: missing session/exam/student ID
```
- Code Snippet: (only the affected function/route/config)
```ts
// src/hooks/useExamFlow.ts
const { currentExam, user } = useApp();
const currentExamId = currentExam?.id ? String(currentExam.id) : undefined;

const {
  recordViolation,
} = useViolationTracker(session?.id ?? sessionId, currentExamId, user?.id, scoreTracker);
```

```ts
// src/hooks/useViolationTracker.ts
const recordViolation = useCallback((input) => {
  if (!sessionId || !examId || !studentId) {
    console.warn('[useViolationTracker] Cannot record violation: missing session/exam/student ID', {
      sessionId, examId, studentId, type: input.violation_type ?? input.type,
    });
    return;
  }
```
- Tried so far:
  Traced `examId` source and confirmed it is not hydrated from `session` or `joinData` for the violation tracker path; it depends on volatile `currentExam` context.
- Priority: P1 | Blocking? Yes
