-- Phase 2: Row-Level Security Policies for Proctoring Tables

-- ============================================================================
-- 1. student_face_references RLS
-- ============================================================================

ALTER TABLE public.student_face_references ENABLE ROW LEVEL SECURITY;

-- Student can INSERT and SELECT their own embedding reference
CREATE POLICY "student_face_references_student_access"
  ON public.student_face_references
  FOR ALL
  USING (student_id = auth.uid());

-- Instructors and other roles cannot SELECT embeddings
-- (verification is done via RPC that returns only pass/fail, never the vector)

-- ============================================================================
-- 2. verification_attempts RLS
-- ============================================================================

ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;

-- Student can INSERT their own verification attempts
CREATE POLICY "verification_attempts_student_insert"
  ON public.verification_attempts
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Student can SELECT their own verification attempts
CREATE POLICY "verification_attempts_student_select"
  ON public.verification_attempts
  FOR SELECT
  USING (student_id = auth.uid());

-- Instructor can SELECT verification attempts for their own exams
CREATE POLICY "verification_attempts_instructor_select"
  ON public.verification_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE id = exam_id AND instructor_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. exam_sessions RLS
-- ============================================================================

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- Student can INSERT their own session
CREATE POLICY "exam_sessions_student_insert"
  ON public.exam_sessions
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Student can SELECT and UPDATE their own sessions
CREATE POLICY "exam_sessions_student_modify"
  ON public.exam_sessions
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "exam_sessions_student_update"
  ON public.exam_sessions
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Instructor can SELECT sessions for their own exams
CREATE POLICY "exam_sessions_instructor_select"
  ON public.exam_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE id = exam_id AND instructor_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. violation_events RLS
-- ============================================================================

ALTER TABLE public.violation_events ENABLE ROW LEVEL SECURITY;

-- Student can INSERT their own session's events
CREATE POLICY "violation_events_student_insert"
  ON public.violation_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_sessions
      WHERE id = session_id AND student_id = auth.uid()
    )
  );

-- Student can SELECT their own events
CREATE POLICY "violation_events_student_select"
  ON public.violation_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions
      WHERE id = session_id AND student_id = auth.uid()
    )
  );

-- Instructor can SELECT events for their own exams (via exam_sessions)
CREATE POLICY "violation_events_instructor_select"
  ON public.violation_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      JOIN public.exams e ON es.exam_id = e.id
      WHERE es.id = session_id AND e.instructor_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. evidence_artifacts RLS
-- ============================================================================

ALTER TABLE public.evidence_artifacts ENABLE ROW LEVEL SECURITY;

-- Student can INSERT their own session's artifacts
CREATE POLICY "evidence_artifacts_student_insert"
  ON public.evidence_artifacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_sessions
      WHERE id = session_id AND student_id = auth.uid()
    )
  );

-- Student can SELECT their own artifacts (for confirmation, not for playback)
CREATE POLICY "evidence_artifacts_student_select"
  ON public.evidence_artifacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions
      WHERE id = session_id AND student_id = auth.uid()
    )
  );

-- Instructor can SELECT artifacts for their own exams
CREATE POLICY "evidence_artifacts_instructor_select"
  ON public.evidence_artifacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      JOIN public.exams e ON es.exam_id = e.id
      WHERE es.id = session_id AND e.instructor_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. submissions RLS
-- ============================================================================

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Student can INSERT and SELECT their own submissions
CREATE POLICY "submissions_student_access"
  ON public.submissions
  FOR ALL
  USING (student_id = auth.uid());

-- Instructor can SELECT submissions for their own exams
CREATE POLICY "submissions_instructor_select"
  ON public.submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE id = exam_id AND instructor_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. student_answers RLS
-- ============================================================================

ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

-- Student can INSERT and SELECT their own answers
CREATE POLICY "student_answers_student_access"
  ON public.student_answers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions
      WHERE id = session_id AND student_id = auth.uid()
    )
  );

-- Instructor can SELECT answers for their own exams
CREATE POLICY "student_answers_instructor_select"
  ON public.student_answers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      JOIN public.exams e ON es.exam_id = e.id
      WHERE es.id = session_id AND e.instructor_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. evidence_packages RLS
-- ============================================================================

ALTER TABLE public.evidence_packages ENABLE ROW LEVEL SECURITY;

-- Instructor can SELECT evidence packages for their own exams (via submission)
CREATE POLICY "evidence_packages_instructor_select"
  ON public.evidence_packages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.exams e ON s.exam_id = e.id
      WHERE s.id = submission_id AND e.instructor_id = auth.uid()
    )
  );

-- ============================================================================
-- 9. instructor_alerts RLS
-- ============================================================================

ALTER TABLE public.instructor_alerts ENABLE ROW LEVEL SECURITY;

-- Instructor can INSERT alerts for their own exams
CREATE POLICY "instructor_alerts_instructor_insert"
  ON public.instructor_alerts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE id = exam_id AND instructor_id = auth.uid()
    )
  );

-- Instructor can SELECT and UPDATE alerts for their own exams
CREATE POLICY "instructor_alerts_instructor_select"
  ON public.instructor_alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE id = exam_id AND instructor_id = auth.uid()
    )
  );

CREATE POLICY "instructor_alerts_instructor_update"
  ON public.instructor_alerts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE id = exam_id AND instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE id = exam_id AND instructor_id = auth.uid()
    )
  );
