-- ============================================
-- Phase 3: RLS Policies for Cheating Score System
-- ============================================
-- Row Level Security policies for violation_events, cheating_scores, and instructor_alerts

-- ============================================
-- VIOLATION EVENTS POLICIES
-- ============================================

-- Students can insert their own violations
CREATE POLICY "students_insert_own_violations"
ON violation_events FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
);

-- Instructors can view violations for their exams
CREATE POLICY "instructors_view_exam_violations"
ON violation_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = violation_events.exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Students can view their own violations
CREATE POLICY "students_view_own_violations"
ON violation_events FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
);

-- Instructors can update violations (for review)
CREATE POLICY "instructors_update_exam_violations"
ON violation_events FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = violation_events.exam_id
    AND e.instructor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = violation_events.exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- ============================================
-- CHEATING SCORES POLICIES
-- ============================================

-- System can insert scores (via database functions)
CREATE POLICY "system_insert_scores"
ON cheating_scores FOR INSERT
TO authenticated
WITH CHECK (true);

-- Students can view their own scores
CREATE POLICY "students_view_own_scores"
ON cheating_scores FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
);

-- Instructors can view scores for their exams
CREATE POLICY "instructors_view_exam_scores"
ON cheating_scores FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = cheating_scores.exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- System can update scores (via database functions)
CREATE POLICY "system_update_scores"
ON cheating_scores FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- INSTRUCTOR ALERTS POLICIES
-- ============================================

-- System can insert alerts (via database functions)
CREATE POLICY "system_insert_alerts"
ON instructor_alerts FOR INSERT
TO authenticated
WITH CHECK (true);

-- Students can view their own alerts
CREATE POLICY "students_view_own_alerts"
ON instructor_alerts FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
);

-- Instructors can view alerts for their exams
CREATE POLICY "instructors_view_exam_alerts"
ON instructor_alerts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = instructor_alerts.exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Instructors can acknowledge alerts for their exams
CREATE POLICY "instructors_update_exam_alerts"
ON instructor_alerts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = instructor_alerts.exam_id
    AND e.instructor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = instructor_alerts.exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- ============================================
-- EXAM SESSIONS POLICIES (Update for cheating score access)
-- ============================================

-- Instructors can view sessions with joined cheating data for their exams
CREATE POLICY "instructors_view_exam_sessions_with_scores"
ON exam_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_sessions.exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Students can view their own sessions
CREATE POLICY "students_view_own_sessions"
ON exam_sessions FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
);

-- ============================================
-- HELPER FUNCTIONS SECURITY
-- ============================================

-- Allow authenticated users to execute cheating score functions
GRANT EXECUTE ON FUNCTION calculate_cheating_score TO authenticated;
GRANT EXECUTE ON FUNCTION record_violation_and_update_score TO authenticated;
GRANT EXECUTE ON FUNCTION get_high_risk_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_instructor_alert TO authenticated;
GRANT EXECUTE ON FUNCTION create_instructor_alert TO authenticated;
