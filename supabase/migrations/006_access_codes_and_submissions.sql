-- Phase 2: Access Codes, Submissions, and Proctoring Infrastructure
-- Adds columns to exams and creates new tables for the proctoring workflow

-- ============================================================================
-- 1. ALTER exams TABLE
-- ============================================================================

ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS access_code text,
ADD COLUMN IF NOT EXISTS proctoring_policy jsonb NOT NULL DEFAULT '{
  "visual_evidence_allowed": true,
  "warning_threshold": 30,
  "critical_threshold": 70,
  "critical_sustain_seconds": 5,
  "max_verification_attempts": 3
}'::jsonb,
ADD COLUMN IF NOT EXISTS published_at timestamptz,
ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Partial unique index: codes only enforced on published exams (re-mintable after close)
CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_access_code_published
  ON public.exams (access_code)
  WHERE status = 'published' AND access_code IS NOT NULL;

-- Index for instructor dashboard listing
CREATE INDEX IF NOT EXISTS idx_exams_instructor_status
  ON public.exams (instructor_id, status);

-- ============================================================================
-- 2. NEW TABLE: student_face_references
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_face_references (
  student_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding float4[] NOT NULL CHECK (array_length(embedding, 1) = 128),
  quality_score float CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)),
  captured_at timestamptz NOT NULL DEFAULT now(),
  replaced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. NEW TABLE: verification_attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('pass', 'fail', 'capture_error')),
  confidence float,
  counted_against_budget boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. NEW TABLE: exam_sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admitted_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'awaiting_verification'
    CHECK (status IN ('awaiting_verification', 'verification_blocked', 'verified', 'in_progress', 'submitted', 'auto_submitted', 'terminated')),
  live_cheating_score float NOT NULL DEFAULT 0 CHECK (live_cheating_score >= 0 AND live_cheating_score <= 100),
  last_score_update_at timestamptz,
  submit_reason text CHECK (submit_reason IN ('manual', 'auto_window_close', 'auto_disconnect')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One active session per student per exam
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_sessions_unique_active
  ON public.exam_sessions (exam_id, student_id)
  WHERE status NOT IN ('terminated', 'verification_blocked');

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_status
  ON public.exam_sessions (exam_id, status);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_status
  ON public.exam_sessions (student_id, status);

-- ============================================================================
-- 5. NEW TABLE: violation_events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.violation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  client_event_id text NOT NULL,
  type text NOT NULL,
  severity smallint NOT NULL CHECK (severity >= 1 AND severity <= 25),
  client_captured_at timestamptz NOT NULL,
  server_recorded_at timestamptz NOT NULL DEFAULT now(),
  evidence_artifact_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent batch uploads
CREATE UNIQUE INDEX IF NOT EXISTS idx_violation_events_idempotent
  ON public.violation_events (session_id, client_event_id);

-- Timeline assembly + realtime feed
CREATE INDEX IF NOT EXISTS idx_violation_events_timeline
  ON public.violation_events (session_id, server_recorded_at);

-- Nightly purge job
CREATE INDEX IF NOT EXISTS idx_violation_events_server_recorded
  ON public.violation_events (server_recorded_at);

-- ============================================================================
-- 6. NEW TABLE: evidence_artifacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evidence_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  bucket_path text NOT NULL UNIQUE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  retained_for_case boolean NOT NULL DEFAULT false,
  content_type text NOT NULL,
  byte_length integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Purge job scan
CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_purge
  ON public.evidence_artifacts (expires_at)
  WHERE NOT retained_for_case;

-- ============================================================================
-- 7. NEW TABLE: submissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submit_reason text NOT NULL CHECK (submit_reason IN ('manual', 'auto_window_close', 'auto_disconnect')),
  auto_graded_score numeric,
  auto_graded_max numeric,
  final_grade numeric,
  grade_status text NOT NULL DEFAULT 'auto_final'
    CHECK (grade_status IN ('auto_final', 'partial_pending_review', 'fully_pending_review')),
  final_cheating_score float NOT NULL,
  evidence_package_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Instructor results view
CREATE INDEX IF NOT EXISTS idx_submissions_exam_submitted
  ON public.submissions (exam_id, submitted_at);

-- ============================================================================
-- 8. NEW TABLE: student_answers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  answer jsonb NOT NULL,
  frozen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per question per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_answers_unique
  ON public.student_answers (session_id, question_id);

-- ============================================================================
-- 9. NEW TABLE: evidence_packages
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evidence_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
  assembled_at timestamptz NOT NULL DEFAULT now(),
  violation_summary jsonb NOT NULL,
  timeline_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 10. NEW TABLE: instructor_alerts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.instructor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('critical_score_sustained', 'camera_lost', 'verification_failed_hard', 'multiple_persons')),
  raised_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dashboard filtering
CREATE INDEX IF NOT EXISTS idx_instructor_alerts_exam_ack
  ON public.instructor_alerts (exam_id, acknowledged_at);

-- ============================================================================
-- 11. CROCKFORD BASE32 ACCESS CODE GENERATOR
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_access_code()
RETURNS text AS $$
DECLARE
  -- Crockford Base32 alphabet (excludes I, L, O, U for ambiguity)
  alphabet text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  code text := '';
  idx integer;
  random_val integer;
BEGIN
  -- Generate 8 random characters
  FOR i IN 1..8 LOOP
    -- Get random number 0..31 (32 characters in alphabet)
    random_val := (floor(random() * 32))::integer;
    code := code || substr(alphabet, random_val + 1, 1);
  END LOOP;

  -- Verify uniqueness against currently published exams
  WHILE EXISTS(SELECT 1 FROM public.exams WHERE access_code = code AND status = 'published') LOOP
    code := '';
    FOR i IN 1..8 LOOP
      random_val := (floor(random() * 32))::integer;
      code := code || substr(alphabet, random_val + 1, 1);
    END LOOP;
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 12. BASIC RPC STUBS (Phase 3 will expand these)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_exam(
  p_title text,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_proctoring_policy jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_exam_id uuid;
BEGIN
  INSERT INTO public.exams (
    instructor_id,
    title,
    starts_at,
    duration_minutes,
    status,
    proctoring_policy
  )
  VALUES (
    auth.uid(),
    p_title,
    p_starts_at,
    p_duration_minutes,
    'draft',
    COALESCE(p_proctoring_policy, '{
      "visual_evidence_allowed": true,
      "warning_threshold": 30,
      "critical_threshold": 70,
      "critical_sustain_seconds": 5,
      "max_verification_attempts": 3
    }'::jsonb)
  )
  RETURNING id INTO v_exam_id;

  RETURN v_exam_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_exam(
  p_exam_id uuid,
  p_title text DEFAULT NULL,
  p_starts_at timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_proctoring_policy jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE public.exams
  SET
    title = COALESCE(p_title, title),
    starts_at = COALESCE(p_starts_at, starts_at),
    duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
    proctoring_policy = COALESCE(p_proctoring_policy, proctoring_policy),
    updated_at = now()
  WHERE id = p_exam_id AND instructor_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.publish_exam(p_exam_id uuid)
RETURNS text AS $$
DECLARE
  v_exam_record public.exams%ROWTYPE;
  v_question_count integer;
  v_access_code text;
BEGIN
  -- Fetch the exam
  SELECT * INTO v_exam_record
  FROM public.exams
  WHERE id = p_exam_id AND instructor_id = auth.uid();

  IF v_exam_record IS NULL THEN
    RAISE EXCEPTION 'Exam not found or not owned by user';
  END IF;

  -- Verify >= 1 question
  SELECT COUNT(*) INTO v_question_count
  FROM public.exam_questions
  WHERE exam_id = p_exam_id;

  IF v_question_count = 0 THEN
    RAISE EXCEPTION 'Cannot publish exam with zero questions';
  END IF;

  -- Generate unique access code
  v_access_code := public.generate_access_code();

  -- Transition to published
  UPDATE public.exams
  SET
    status = 'published',
    access_code = v_access_code,
    published_at = now(),
    updated_at = now()
  WHERE id = p_exam_id;

  RETURN v_access_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.close_exam(p_exam_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.exams
  SET
    status = 'closed',
    access_code = NULL,
    closed_at = now(),
    updated_at = now()
  WHERE id = p_exam_id AND instructor_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
