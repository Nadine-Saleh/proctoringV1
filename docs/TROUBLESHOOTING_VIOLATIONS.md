# Troubleshooting: Violations Not Appearing in Database

## Problem
Violations table is empty even though violations are being detected.

---

## Step 1: Check Browser Console for Errors

Open the exam page and look for these console messages:

### Expected Logs (Good)
```
[useViolationTracker] Violation recorded: gaze_sustained_away (high)
[useViolationTracker] Synced 3 violations
[ViolationEventService] Batch insert successful
```

### Warning Logs (Problem Indicators)
```
[useViolationTracker] Cannot record violation: missing session/exam/student ID
```
**Fix**: Ensure the exam session is started before violations occur.

```
[ViolationEventService] Failed to batch insert events: ...
```
**Fix**: Check the error message - likely RLS policy or connection issue.

---

## Step 2: Verify Migration 005 is Deployed

### Check in Supabase SQL Editor:
```sql
-- Check if RLS policies exist for violation_events
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'violation_events'::regclass;
```

**Expected**: Should see policies for INSERT and SELECT.

### If No Policies Found:
Deploy `supabase/migrations/005_rls_policies_cheating_system.sql` to Supabase SQL Editor.

---

## Step 3: Verify Session is Started

### In Browser Console:
```javascript
// Check if session exists
console.log('Session:', window.sessionStorage.getItem('currentSession'));
```

### In Exam Page:
Add this temporary debug code to `Exam.tsx`:

```typescript
useEffect(() => {
  console.log('[Exam Debug] Session:', session);
  console.log('[Exam Debug] Exam ID:', currentExamId);
  console.log('[Exam Debug] User:', user);
}, [session, currentExamId, user]);
```

**If any are undefined**, the violation tracker won't work.

---

## Step 4: Test Manual Insert

### In Supabase SQL Editor:
```sql
-- Test if inserts work at all
INSERT INTO violation_events (
  session_id, exam_id, student_id,
  violation_type, severity, weight,
  occurred_at
) VALUES (
  'YOUR-SESSION-ID',  -- Replace with real session ID
  'YOUR-EXAM-ID',     -- Replace with real exam ID
  'YOUR-USER-ID',     -- Replace with real user ID
  'test_violation', 'low', 1, NOW()
);
```

**If this fails**: RLS policy or permission issue.
**If this succeeds**: Problem is with the client-side code.

---

## Step 5: Check Supabase Connection

### In Browser Console:
```javascript
// Test Supabase connection
import { supabase } from './lib/supabase/client';

const { data, error } = await supabase.from('violation_events').select('*').limit(1);
console.log('Connection test:', { data, error });
```

**If error**: Check `.env` file and Supabase URL.

---

## Common Solutions

### Solution 1: Deploy Missing Migrations
1. Open Supabase SQL Editor
2. Run `005_rls_policies_cheating_system.sql`
3. Verify policies are created

### Solution 2: Fix RLS Policy for Testing
If RLS is blocking inserts, create a permissive policy for testing:

```sql
-- Allow all authenticated users to insert violations
DROP POLICY IF EXISTS "test_violation_insert" ON violation_events;

CREATE POLICY "test_violation_insert"
ON violation_events FOR INSERT
TO authenticated
WITH CHECK (true);
```

### Solution 3: Verify Supabase Environment Variables
Check `.env` file has:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Solution 4: Ensure User is Authenticated
The user must be logged in for the session to work. Check:
```typescript
console.log('[Auth] User:', user);
console.log('[Auth] Authenticated:', !!user?.id);
```

### Solution 5: Add Immediate Sync for Testing
Change `BATCH_INTERVAL_MS` from 5000 to 1000 in `useViolationTracker.ts`:

```typescript
const BATCH_INTERVAL_MS = 1000; // Send batch every 1 second (for testing)
```

---

## Quick Diagnostic Checklist

- [ ] Migration 004 deployed (`004_cheating_score_functions.sql`)
- [ ] Migration 005 deployed (`005_rls_policies_cheating_system.sql`)
- [ ] `.env` file has valid Supabase credentials
- [ ] User is authenticated (not anonymous)
- [ ] Exam session is started (`session.id` exists)
- [ ] Console shows `[useViolationTracker] Violation recorded` messages
- [ ] Console shows `[useViolationTracker] Synced X violations` messages
- [ ] No errors in Network tab for Supabase API calls

---

## Need More Help?

Run this SQL query to check if the table exists and is accessible:

```sql
-- Check if table exists
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'violation_events';

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'violation_events'
ORDER BY ordinal_position;

-- Check RLS status
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'violation_events';
```
