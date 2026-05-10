-- ============================================
-- Row-Level Security Policies Migration
-- ============================================
-- This migration adds security policies to all tables
-- Run this AFTER 001_initial_schema.sql

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheating_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctoring_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
-- This policy allows newly created auth users to create their profile row
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow service role to bypass RLS (for admin operations)
-- Note: This is handled automatically when using service key

-- ============================================
-- EXAMS TABLE POLICIES
-- ============================================

-- Anyone can view published exams
CREATE POLICY "Anyone can view published exams"
ON exams FOR SELECT
USING (status = 'published');

-- Instructors can view their own exams (including drafts)
CREATE POLICY "Instructors can view own exams"
ON exams FOR SELECT
USING (
  instructor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() 
    AND u.role IN ('instructor', 'admin')
  )
);

-- Instructors can create exams
CREATE POLICY "Instructors can create exams"
ON exams FOR INSERT
WITH CHECK (
  instructor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() 
    AND u.role IN ('instructor', 'admin')
  )
);

-- Instructors can update their own exams
CREATE POLICY "Instructors can update own exams"
ON exams FOR UPDATE
USING (instructor_id = auth.uid());

-- Instructors can delete their own exams
CREATE POLICY "Instructors can delete own exams"
ON exams FOR DELETE
USING (instructor_id = auth.uid());

-- ============================================
-- QUESTIONS TABLE POLICIES
-- ============================================

-- Anyone can view questions for published exams
CREATE POLICY "Anyone can view questions for published exams"
ON questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.status = 'published'
  )
);

-- Instructors can view questions for their exams
CREATE POLICY "Instructors can view own exam questions"
ON questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Instructors can create questions for their exams
CREATE POLICY "Instructors can create questions"
ON questions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Instructors can update questions for their exams
CREATE POLICY "Instructors can update own exam questions"
ON questions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Instructors can delete questions for their exams
CREATE POLICY "Instructors can delete own exam questions"
ON questions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- ============================================
-- EXAM SESSIONS TABLE POLICIES
-- ============================================

-- Students can view their own sessions
CREATE POLICY "Students can view own sessions"
ON exam_sessions FOR SELECT
USING (student_id = auth.uid());

-- Students can create their own sessions
CREATE POLICY "Students can create own sessions"
ON exam_sessions FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Students can update their own sessions
CREATE POLICY "Students can update own sessions"
ON exam_sessions FOR UPDATE
USING (student_id = auth.uid());

-- Instructors can view sessions for their exams
CREATE POLICY "Instructors can view exam sessions"
ON exam_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Instructors can update sessions for their exams (e.g., flag, invalidate)
CREATE POLICY "Instructors can update exam sessions"
ON exam_sessions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- ============================================
-- VIOLATION EVENTS TABLE POLICIES
-- ============================================

-- Students can view their own violations
CREATE POLICY "Students can view own violations"
ON violation_events FOR SELECT
USING (student_id = auth.uid());

-- Students can insert their own violations (from client-side detection)
CREATE POLICY "Students can insert own violations"
ON violation_events FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Instructors can view violations for their exams
CREATE POLICY "Instructors can view exam violations"
ON violation_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Instructors can update violations for their exams (review, add notes)
CREATE POLICY "Instructors can update exam violations"
ON violation_events FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- ============================================
-- CHEATING SCORES TABLE POLICIES
-- ============================================

-- Students can view their own scores
CREATE POLICY "Students can view own scores"
ON cheating_scores FOR SELECT
USING (student_id = auth.uid());

-- Students can insert their own scores (calculated client-side)
CREATE POLICY "Students can insert own scores"
ON cheating_scores FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Students can update their own scores
CREATE POLICY "Students can update own scores"
ON cheating_scores FOR UPDATE
USING (student_id = auth.uid());

-- Instructors can view scores for their exams
CREATE POLICY "Instructors can view exam scores"
ON cheating_scores FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Instructors can update scores for their exams
CREATE POLICY "Instructors can update exam scores"
ON cheating_scores FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- ============================================
-- STUDENT ANSWERS TABLE POLICIES
-- ============================================

-- Students can view their own answers
CREATE POLICY "Students can view own answers"
ON student_answers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exam_sessions es
    WHERE es.id = session_id
    AND es.student_id = auth.uid()
  )
);

-- Students can insert their own answers
CREATE POLICY "Students can insert own answers"
ON student_answers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM exam_sessions es
    WHERE es.id = session_id
    AND es.student_id = auth.uid()
  )
);

-- Students can update their own answers
CREATE POLICY "Students can update own answers"
ON student_answers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM exam_sessions es
    WHERE es.id = session_id
    AND es.student_id = auth.uid()
  )
);

-- Instructors can view answers for their exams
CREATE POLICY "Instructors can view exam answers"
ON student_answers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exam_sessions es
    JOIN exams e ON e.id = es.exam_id
    WHERE es.id = session_id
    AND e.instructor_id = auth.uid()
  )
);

-- ============================================
-- INSTRUCTOR ALERTS TABLE POLICIES
-- ============================================

-- Students can view their own alerts
CREATE POLICY "Students can view own alerts"
ON instructor_alerts FOR SELECT
USING (student_id = auth.uid());

-- Instructors can view alerts for their exams
CREATE POLICY "Instructors can view exam alerts"
ON instructor_alerts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Instructors can update alerts for their exams (acknowledge)
CREATE POLICY "Instructors can update exam alerts"
ON instructor_alerts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- System can insert alerts (via Edge Functions)
-- Note: This allows any authenticated user to insert alerts
-- In production, restrict this to service role or Edge Functions
CREATE POLICY "Anyone can insert alerts"
ON instructor_alerts FOR INSERT
WITH CHECK (true);

-- ============================================
-- PROCTORING REPORTS TABLE POLICIES
-- ============================================

-- Students can view their own reports
CREATE POLICY "Students can view own reports"
ON proctoring_reports FOR SELECT
USING (student_id = auth.uid());

-- Students can insert their own reports
CREATE POLICY "Students can insert own reports"
ON proctoring_reports FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Instructors can view reports for their exams
CREATE POLICY "Instructors can view exam reports"
ON proctoring_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- Instructors can update reports for their exams (add notes, review)
CREATE POLICY "Instructors can update exam reports"
ON proctoring_reports FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_id
    AND e.instructor_id = auth.uid()
  )
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS VARCHAR(20) AS $$
DECLARE
  user_role VARCHAR(20);
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is instructor or admin
CREATE OR REPLACE FUNCTION is_instructor_or_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR(20);
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = auth.uid();
  RETURN user_role IN ('instructor', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
