# Phase 3 Testing Script

This document provides manual test cases to verify Phase 3 implementation.

---

## Test Environment Setup

### Prerequisites
- [ ] Supabase project running
- [ ] Migration 004 deployed (`004_cheating_score_functions.sql`)
- [ ] Migration 005 deployed (`005_rls_policies_cheating_system.sql`)
- [ ] Development server running (`npm run dev`)
- [ ] Two browser windows (Student + Instructor)

---

## Test Case 1: Violation Recording → Database

**Objective**: Verify violations are persisted to `violation_events` table

**Steps**:
1. Open student exam page
2. Complete liveness check
3. Start exam
4. Trigger violations:
   - Look away from camera for 5+ seconds
   - Move out of frame for 7+ seconds
   - Show multiple faces (use phone with face image)
5. Wait 5 seconds for batch sync
6. Check browser console for logs:
   ```
   [useViolationTracker] Violation recorded: gaze_sustained_away
   [useViolationTracker] Synced X violations
   ```

**Database Verification**:
```sql
-- Check violations were recorded
SELECT 
  ve.id,
  ve.violation_type,
  ve.severity,
  ve.weight,
  ve.occurred_at,
  ve.description
FROM violation_events ve
WHERE ve.student_id = 'YOUR-STUDENT-ID'
ORDER BY ve.occurred_at DESC
LIMIT 10;
```

**Expected Result**:
- ✅ At least 3 violation records in database
- ✅ Correct violation types (gaze_sustained_away, face_not_detected, multiple_faces)
- ✅ Correct severity levels
- ✅ Weights match expected values

**Status**: [ ] Pass / [ ] Fail

---

## Test Case 2: Cheating Score Calculation

**Objective**: Verify scores are calculated and persisted correctly

**Steps**:
1. After Test Case 1, wait 30 seconds
2. Check browser console for:
   ```
   [Exam] Cheating score calculated: 65
   ```

**Database Verification**:
```sql
-- Check cheating score record
SELECT 
  cs.id,
  cs.session_id,
  cs.overall_score,
  cs.risk_level,
  cs.total_violations,
  cs.critical_violations,
  cs.calculated_at
FROM cheating_scores cs
WHERE cs.student_id = 'YOUR-STUDENT-ID'
ORDER BY cs.calculated_at DESC
LIMIT 1;
```

**Manual Function Test**:
```sql
-- Call function directly
SELECT * FROM calculate_cheating_score('YOUR-SESSION-ID', 5);
```

**Expected Result**:
- ✅ Score record exists in database
- ✅ `overall_score` between 0-100
- ✅ `risk_level` matches score threshold (low/medium/high/critical)
- ✅ `total_violations` matches count from Test Case 1
- ✅ `calculated_at` is recent (within 60 seconds)

**Status**: [ ] Pass / [ ] Fail

---

## Test Case 3: Instructor Alert Creation

**Objective**: Verify alerts are created when risk level is HIGH/CRITICAL

**Steps**:
1. Continue from Test Case 2 (ensure score ≥ 50)
2. Trigger more violations to push score to HIGH/CRITICAL
3. Check browser console for:
   ```
   [Exam] Sending alert to instructor: multiple_faces (score: 75, level: critical)
   [AlertService] Alert persisted to database: ALERT-ID
   ```

**Database Verification**:
```sql
-- Check alert record
SELECT 
  ia.id,
  ia.student_id,
  ia.exam_id,
  ia.alert_type,
  ia.priority,
  ia.cheating_score_at_time,
  ia.title,
  ia.message,
  ia.violation_summary,
  ia.is_acknowledged,
  ia.created_at
FROM instructor_alerts ia
WHERE ia.student_id = 'YOUR-STUDENT-ID'
ORDER BY ia.created_at DESC
LIMIT 1;
```

**Expected Result**:
- ✅ Alert record exists
- ✅ `priority` is 'high' or 'critical'
- ✅ `cheating_score_at_time` matches score from Test Case 2
- ✅ `title` contains risk level
- ✅ `violation_summary` contains JSON with recent violations
- ✅ `is_acknowledged` is false

**Status**: [ ] Pass / [ ] Fail

---

## Test Case 4: Instructor Dashboard - Load Alerts

**Objective**: Verify instructor can load alerts from database

**Steps**:
1. Open instructor dashboard (`/instructor/proctoring`)
2. Select the exam from dropdown
3. Check browser console for:
   ```
   [ProctoringReport] Loaded X unacknowledged alerts
   ```
4. Verify Live Alerts panel shows alerts

**Network Verification**:
- Open Network tab in DevTools
- Look for Supabase query to `instructor_alerts` table
- Verify response contains alert data

**Expected Result**:
- ✅ Live Alerts panel renders
- ✅ Alert shows student name, score, risk level
- ✅ "Acknowledge" button visible
- ✅ No console errors

**Status**: [ ] Pass / [ ] Fail

---

## Test Case 5: Acknowledge Alert

**Objective**: Verify alert acknowledgment works

**Steps**:
1. In instructor dashboard, click "Acknowledge" on an alert
2. Check browser console for:
   ```
   [InstructorAlertService] Alert acknowledged
   ```
3. Verify alert disappears from Live Alerts panel

**Database Verification**:
```sql
-- Check alert was acknowledged
SELECT 
  ia.id,
  ia.is_acknowledged,
  ia.acknowledged_by,
  ia.acknowledged_at
FROM instructor_alerts ia
WHERE ia.id = 'ALERT-ID-FROM-TEST-3';
```

**Expected Result**:
- ✅ `is_acknowledged` is true
- ✅ `acknowledged_by` contains instructor UUID
- ✅ `acknowledged_at` is recent timestamp
- ✅ Alert removed from UI

**Status**: [ ] Pass / [ ] Fail

---

## Test Case 6: High-Risk Sessions Query

**Objective**: Verify `get_high_risk_sessions` function works

**Steps**:
Run this SQL in Supabase SQL Editor:

```sql
-- Get high-risk sessions for specific exam
SELECT * FROM get_high_risk_sessions(
  'YOUR-EXAM-ID',  -- Replace with actual exam ID
  30               -- Last 30 minutes
);

-- Get all high-risk sessions
SELECT * FROM get_high_risk_sessions(
  NULL,  -- All exams
  60     -- Last 60 minutes
);
```

**Expected Result**:
- ✅ Returns sessions with high/critical risk levels
- ✅ Includes student_name, student_email
- ✅ Includes recent_violations JSON array
- ✅ Ordered by score descending

**Status**: [ ] Pass / [ ] Fail

---

## Test Case 7: Real-Time Alert via WebSocket (Optional)

**Objective**: Verify WebSocket real-time delivery works

**Prerequisites**:
- WebSocket server running on `ws://localhost:4000`
- `VITE_WS_URL` set in `.env`

**Steps**:
1. Open instructor dashboard in Browser A
2. Open student exam in Browser B
3. Check Browser A console for:
   ```
   [WebSocketService] Connected successfully
   ```
4. In Browser B, trigger HIGH/CRITICAL violation
5. Check Browser A console for:
   ```
   [WebSocketService] Message received: critical_alert
   ```
6. Verify alert appears in Browser A without page refresh

**Expected Result**:
- ✅ WebSocket connects successfully
- ✅ Alert received in instructor browser within 2 seconds
- ✅ Alert appears in Live Alerts panel automatically
- ✅ Browser notification shows (if enabled)

**Status**: [ ] Pass / [ ] Fail / [ ] Skipped (no WS server)

---

## Test Case 8: Offline Queue Recovery

**Objective**: Verify violations are queued and retried when offline

**Steps**:
1. Open student exam page
2. Open DevTools → Network tab
3. Set throttling to "Offline"
4. Trigger 2-3 violations
5. Check console for:
   ```
   [OfflineQueue] Enqueued item ID. Queue size: X
   ```
6. Set throttling back to "Online"
7. Wait 15 seconds
8. Check console for:
   ```
   [OfflineQueue] Processing X items...
   [OfflineQueue] Item ID processed successfully
   ```

**Database Verification**:
```sql
-- Verify violations were eventually synced
SELECT COUNT(*) 
FROM violation_events 
WHERE student_id = 'YOUR-STUDENT-ID' 
  AND occurred_at > NOW() - INTERVAL '5 minutes';
```

**Expected Result**:
- ✅ Violations queued while offline
- ✅ Violations synced when connection restored
- ✅ All queued items eventually in database

**Status**: [ ] Pass / [ ] Fail

---

## Test Case 9: Score Recalculation After New Violation

**Objective**: Verify score updates when new violations occur

**Steps**:
1. Start with existing session with score ~30
2. Trigger 2-3 more HIGH severity violations
3. Wait 30 seconds for recalculation
4. Check database:

```sql
-- Check score was updated
SELECT 
  cs.overall_score,
  cs.risk_level,
  cs.total_violations,
  cs.updated_at
FROM cheating_scores cs
WHERE cs.session_id = 'YOUR-SESSION-ID'
ORDER BY cs.updated_at DESC
LIMIT 1;
```

**Expected Result**:
- ✅ `overall_score` increased from previous value
- ✅ `total_violations` increased
- ✅ `risk_level` may have changed (e.g., medium → high)
- ✅ `updated_at` is recent

**Status**: [ ] Pass / [ ] Fail

---

## Test Case 10: Debouncing Prevents Alert Spam

**Objective**: Verify alerts are debounced (max 1 per 60 seconds per student)

**Steps**:
1. Trigger HIGH severity violation
2. Note alert timestamp in console
3. Immediately trigger 3 more HIGH violations
4. Check console for:
   ```
   [AlertService] Alert debounced for student ID. Last alert was Xs ago.
   ```
5. Wait 65 seconds
6. Trigger another HIGH violation
7. Verify new alert is sent

**Expected Result**:
- ✅ First alert sent successfully
- ✅ Subsequent alerts debounced within 60 seconds
- ✅ After 60 seconds, new alert sent
- ✅ Database has fewer alerts than violations triggered

**Status**: [ ] Pass / [ ] Fail

---

## Summary

| Test Case | Description | Status |
|-----------|-------------|--------|
| 1 | Violation Recording → Database | [ ] |
| 2 | Cheating Score Calculation | [ ] |
| 3 | Instructor Alert Creation | [ ] |
| 4 | Instructor Dashboard - Load Alerts | [ ] |
| 5 | Acknowledge Alert | [ ] |
| 6 | High-Risk Sessions Query | [ ] |
| 7 | Real-Time Alert via WebSocket | [ ] |
| 8 | Offline Queue Recovery | [ ] |
| 9 | Score Recalculation | [ ] |
| 10 | Alert Debouncing | [ ] |

**Overall Phase 3 Status**: [ ] Complete / [ ] In Progress

**Notes**:
- Tests passed: ___ / 10
- Critical failures: ___
- Blockers: ___

---

**Test Date**: _______________
**Tested By**: _______________
**Environment**: _______________
