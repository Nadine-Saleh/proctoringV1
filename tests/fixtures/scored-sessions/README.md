# Scored Sessions Fixtures (T066)

This directory holds 10 end-to-end recorded exam sessions with expected violation
timelines used by the `benchmark.test.ts` precision/recall gate.

## Required contents (minimum before release)

10 session JSON files, each containing:
- Full violation event stream (client_event_id, type, severity, client_captured_at)
- Expected timeline annotations (ground truth)
- Final expected cheating score (±5 tolerance)

## Format

`session-<n>.json`:
```json
{
  "session_id": "...",
  "events": [...],
  "expected_final_score": 67.3,
  "ground_truth_above_warning": true,
  "ground_truth_above_critical": false,
  "notes": "Student looked away 4 times, one tab switch"
}
```

## Status

**PLACEHOLDER** — sessions to be recorded and annotated before v1.1 release.
The inline `FIXTURE_SESSIONS` array in `benchmark.test.ts` serves as the 
interim gate (SC-005 compliance) until real session data lands here.
