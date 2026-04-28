-- ============================================
-- Phase 3 Diagnostic Queries
-- ============================================
-- Run these queries to check why violations aren't appearing

-- 1. Check if database functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'calculate_cheating_score',
    'record_violation_and_update_score',
    'get_high_risk_sessions',
    'acknowledge_instructor_alert',
    'create_instructor_alert'
  )
ORDER BY routine_name;

-- 2. Check if tables exist
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('violation_events', 'cheating_scores', 'instructor_alerts', 'exam_sessions')
ORDER BY tablename;

-- 3. Check RLS policies for violation_events
SELECT
  polname AS policy_name,
  polcmd AS command,
  pg_get_expr(polqual, polrelid) AS qualifier,
  pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy
WHERE polrelid = 'violation_events'::regclass;

-- 4. Check if RLS is enabled
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname = 'violation_events';

-- 5. Check table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'violation_events'
ORDER BY ordinal_position;

-- 6. Count violations (should show 0 if empty)
SELECT COUNT(*) AS total_violations FROM violation_events;

-- 7. Check if exam_sessions table has data
SELECT
  id,
  exam_id,
  student_id,
  status,
  started_at
FROM exam_sessions
ORDER BY created_at DESC
LIMIT 10;

-- 8. Check if cheating_scores table has data
SELECT COUNT(*) AS total_scores FROM cheating_scores;

-- 9. Check if instructor_alerts table has data
SELECT COUNT(*) AS total_alerts FROM instructor_alerts;

-- 10. Test manual insert (replace IDs with real values)
-- UNCOMMENT AND RUN THIS TO TEST IF INSERTS WORK
/*
INSERT INTO violation_events (
  session_id, exam_id, student_id,
  violation_type, severity, weight,
  occurred_at, description
) VALUES (
  (SELECT id FROM exam_sessions ORDER BY created_at DESC LIMIT 1),  -- Get most recent session
  (SELECT exam_id FROM exam_sessions ORDER BY created_at DESC LIMIT 1),
  (SELECT student_id FROM exam_sessions ORDER BY created_at DESC LIMIT 1),
  'test_violation',
  'low',
  1,
  NOW(),
  'Manual test insert'
);

-- Verify it worked
SELECT * FROM violation_events WHERE violation_type = 'test_violation' ORDER BY created_at DESC LIMIT 1;
*/
