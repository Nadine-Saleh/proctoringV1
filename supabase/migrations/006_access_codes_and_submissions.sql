-- Phase 2: Access Codes, Submissions, and Proctoring Infrastructure
-- Adds columns to exams and creates new tables for the proctoring workflow

-- ============================================================================
-- 1. ALTER exams TABLE
-- ============================================================================

-- Rename questions to exam_questions if it exists from older schema
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'questions') AND 
       NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exam_questions') THEN
        ALTER TABLE public.questions RENAME TO exam_questions;
        ALTER TABLE public.exam_questions RENAME COLUMN sort_order TO position;
    END IF;
END $$;

ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS access_code text,
ADD COLUMN IF NOT EXISTS starts_at timestamptz,
ADD COLUMN IF NOT EXISTS proctoring_policy jsonb NOT NULL DEFAULT '{
  "visual_evidence_allowed": true,
  "warning_threshold": 40,
  "critical_threshold": 70,
  "critical_sustain_seconds": 10,
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

-- Ensure columns exist if table was created in 001
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exam_sessions') THEN
        ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS admitted_at timestamptz;
        ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS live_cheating_score float DEFAULT 0;
        ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS last_score_update_at timestamptz;
        ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS submit_reason text;
        ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

        -- Widen status to text and replace the old VARCHAR(20) CHECK constraint
        ALTER TABLE public.exam_sessions ALTER COLUMN status TYPE text;
        ALTER TABLE public.exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_status_check;
        ALTER TABLE public.exam_sessions ADD CONSTRAINT exam_sessions_status_check
          CHECK (status IN (
            'awaiting_verification', 'verification_blocked', 'verified',
            'in_progress', 'submitted', 'auto_submitted', 'terminated'
          ));

        -- Update existing sessions to a Phase 2 status if they use Phase 1 names
        UPDATE public.exam_sessions SET status = 'in_progress' WHERE status = 'pending';
    END IF;
END $$;

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

-- Ensure columns exist if table was created in 001
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'violation_events') THEN
        -- 1. ADD COLUMNS (NULLABLE at first)
        ALTER TABLE public.violation_events ADD COLUMN IF NOT EXISTS client_event_id text;
        ALTER TABLE public.violation_events ADD COLUMN IF NOT EXISTS type text;
        ALTER TABLE public.violation_events ADD COLUMN IF NOT EXISTS client_captured_at timestamptz;
        ALTER TABLE public.violation_events ADD COLUMN IF NOT EXISTS server_recorded_at timestamptz DEFAULT now();
        ALTER TABLE public.violation_events ADD COLUMN IF NOT EXISTS evidence_artifact_id uuid;
        ALTER TABLE public.violation_events ADD COLUMN IF NOT EXISTS evidence_image text; -- Phase 3 addition
        
        -- 2. BACKFILL (from Phase 1 columns if present)
        UPDATE public.violation_events 
          SET type = COALESCE(type, violation_type, 'unknown'),
              client_captured_at = COALESCE(client_captured_at, occurred_at, now()),
              client_event_id = COALESCE(client_event_id, id::text);
              
        -- 3. SET NOT NULL (match Phase 2 schema)
        ALTER TABLE public.violation_events ALTER COLUMN client_event_id SET NOT NULL;
        ALTER TABLE public.violation_events ALTER COLUMN type SET NOT NULL;
        ALTER TABLE public.violation_events ALTER COLUMN client_captured_at SET NOT NULL;
        ALTER TABLE public.violation_events ALTER COLUMN server_recorded_at SET NOT NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.violation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  client_event_id text NOT NULL,
  type text NOT NULL,
  severity smallint NOT NULL CHECK (severity >= 1 AND severity <= 25),
  client_captured_at timestamptz NOT NULL,
  server_recorded_at timestamptz NOT NULL DEFAULT now(),
  evidence_artifact_id uuid,
  evidence_image text,
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
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
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

-- ============================================================================
-- 13. LIST_MY_EXAMS RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_my_exams()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  starts_at timestamptz,
  duration_minutes integer,
  status text,
  access_code text,
  published_at timestamptz,
  closed_at timestamptz,
  joined_count bigint,
  in_progress_count bigint,
  submitted_count bigint,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title::text,
    e.description::text,
    e.starts_at,
    e.duration_minutes,
    e.status::text,
    e.access_code::text,
    e.published_at,
    e.closed_at,
    COALESCE(COUNT(CASE WHEN es.status != 'terminated' THEN 1 END), 0)::bigint as joined_count,
    COALESCE(COUNT(CASE WHEN es.status = 'in_progress' THEN 1 END), 0)::bigint as in_progress_count,
    COALESCE(COUNT(CASE WHEN es.status IN ('submitted', 'auto_submitted') THEN 1 END), 0)::bigint as submitted_count,
    e.created_at,
    e.updated_at
  FROM public.exams e
  LEFT JOIN public.exam_sessions es ON e.id = es.exam_id
  WHERE e.instructor_id = auth.uid()
  GROUP BY e.id, e.title, e.description, e.starts_at, e.duration_minutes, e.status, e.access_code, e.published_at, e.closed_at, e.created_at, e.updated_at
  ORDER BY e.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to roles
GRANT EXECUTE ON FUNCTION public.list_my_exams() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_exams() TO service_role;

-- ============================================================================
-- 14. US2 RPCs: join_exam, verify_student_identity, start_exam_session, list_my_sessions
-- ============================================================================

-- T035: join_exam RPC
CREATE OR REPLACE FUNCTION public.join_exam(
  p_access_code text,
  p_fresh_capture boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_exam          public.exams%ROWTYPE;
  v_session_id    uuid;
  v_session       public.exam_sessions%ROWTYPE;
  v_has_reference boolean;
  v_attempts_used integer;
  v_max_attempts  integer;
  v_now           timestamptz := now();
BEGIN
  -- Lookup published exam by uppercased code
  SELECT * INTO v_exam
  FROM public.exams
  WHERE access_code = upper(p_access_code)
    AND status = 'published';

  IF v_exam.id IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF v_exam.status = 'closed' THEN
    RAISE EXCEPTION 'exam_closed';
  END IF;

  -- Validate exam window is currently open
  IF v_now < v_exam.starts_at THEN
    RAISE EXCEPTION 'exam_window_not_open';
  END IF;

  IF v_now > (v_exam.starts_at + (v_exam.duration_minutes || ' minutes')::interval) THEN
    RAISE EXCEPTION 'exam_window_not_open';
  END IF;

  -- Check for existing active session
  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE exam_id = v_exam.id
    AND student_id = auth.uid()
    AND status NOT IN ('terminated', 'verification_blocked', 'submitted', 'auto_submitted');

  IF v_session.id IS NOT NULL THEN
    RAISE EXCEPTION 'already_active_session';
  END IF;

  -- Check if previously blocked
  SELECT id INTO v_session.id
  FROM public.exam_sessions
  WHERE exam_id = v_exam.id
    AND student_id = auth.uid()
    AND status = 'verification_blocked'
  LIMIT 1;

  IF v_session.id IS NOT NULL THEN
    RAISE EXCEPTION 'verification_blocked';
  END IF;

  -- Create session
  INSERT INTO public.exam_sessions (exam_id, student_id, status)
  VALUES (v_exam.id, auth.uid(), 'awaiting_verification')
  RETURNING id INTO v_session_id;

  -- Check if student has a face reference
  SELECT EXISTS(
    SELECT 1 FROM public.student_face_references WHERE student_id = auth.uid()
  ) INTO v_has_reference;

  -- Calculate remaining verification attempts
  v_max_attempts := (v_exam.proctoring_policy->>'max_verification_attempts')::integer;
  SELECT COUNT(*) INTO v_attempts_used
  FROM public.verification_attempts
  WHERE student_id = auth.uid()
    AND exam_id = v_exam.id
    AND counted_against_budget = true;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'exam', jsonb_build_object(
      'id', v_exam.id,
      'title', v_exam.title,
      'description', v_exam.description,
      'starts_at', v_exam.starts_at,
      'duration_minutes', v_exam.duration_minutes,
      'proctoring_policy', v_exam.proctoring_policy
    ),
    'requires_reference_capture', NOT v_has_reference OR p_fresh_capture,
    'verification_attempts_remaining', GREATEST(0, v_max_attempts - v_attempts_used)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.join_exam(text, boolean) TO authenticated;

-- T036: verify_student_identity RPC
CREATE OR REPLACE FUNCTION public.verify_student_identity(
  p_session_id uuid,
  p_embedding  float4[]
)
RETURNS jsonb AS $$
DECLARE
  v_session          public.exam_sessions%ROWTYPE;
  v_exam             public.exams%ROWTYPE;
  v_reference        public.student_face_references%ROWTYPE;
  v_distance         float;
  v_threshold        float := 0.6;
  v_outcome          text;
  v_max_attempts     integer;
  v_attempts_used    integer;
  v_attempts_left    integer;
  v_count_against    boolean := true;
  v_is_fresh_capture boolean := false;
  v_confidence       float;
BEGIN
  -- Validate embedding dimension
  IF array_length(p_embedding, 1) != 128 THEN
    RAISE EXCEPTION 'capture_invalid';
  END IF;

  -- Load session, verify ownership and status
  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id
    AND student_id = auth.uid();

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF v_session.status = 'verification_blocked' THEN
    RAISE EXCEPTION 'verification_blocked';
  END IF;

  IF v_session.status != 'awaiting_verification' THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  -- Load reference embedding
  SELECT * INTO v_reference
  FROM public.student_face_references
  WHERE student_id = auth.uid();

  IF v_reference.student_id IS NULL THEN
    RAISE EXCEPTION 'reference_missing';
  END IF;

  -- Load exam policy
  SELECT * INTO v_exam FROM public.exams WHERE id = v_session.exam_id;
  v_max_attempts := (v_exam.proctoring_policy->>'max_verification_attempts')::integer;

  -- Count budget-consuming attempts so far
  SELECT COUNT(*) INTO v_attempts_used
  FROM public.verification_attempts
  WHERE student_id = auth.uid()
    AND exam_id = v_session.exam_id
    AND counted_against_budget = true;

  -- If reference was just captured (quality_score set within last 60s), first attempt is free
  IF v_reference.captured_at > now() - interval '60 seconds' THEN
    v_count_against := false;
  END IF;

  -- Compute Euclidean distance between embeddings
  SELECT sqrt(
    (SELECT sum((a.val - b.val)^2)
     FROM unnest(p_embedding) WITH ORDINALITY AS a(val, idx)
     JOIN unnest(v_reference.embedding) WITH ORDINALITY AS b(val, idx) USING (idx))
  ) INTO v_distance;

  v_confidence := GREATEST(0.0, 1.0 - (v_distance / 2.0));
  v_outcome := CASE WHEN v_distance < v_threshold THEN 'pass' ELSE 'fail' END;

  -- Insert attempt record
  INSERT INTO public.verification_attempts
    (student_id, exam_id, outcome, confidence, counted_against_budget)
  VALUES
    (auth.uid(), v_session.exam_id, v_outcome, v_confidence, v_count_against);

  IF v_count_against THEN
    v_attempts_used := v_attempts_used + 1;
  END IF;

  v_attempts_left := GREATEST(0, v_max_attempts - v_attempts_used);

  IF v_outcome = 'pass' THEN
    -- Transition session to verified
    UPDATE public.exam_sessions
    SET status = 'verified', admitted_at = now(), updated_at = now()
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
      'outcome', 'pass',
      'confidence', v_confidence,
      'attempts_remaining', v_attempts_left,
      'blocked', false,
      'session_status', 'verified'
    );
  ELSE
    -- Check if budget exhausted
    IF v_count_against AND v_attempts_used >= v_max_attempts THEN
      UPDATE public.exam_sessions
      SET status = 'verification_blocked', updated_at = now()
      WHERE id = p_session_id;

      INSERT INTO public.instructor_alerts (exam_id, session_id, reason)
      VALUES (v_session.exam_id, p_session_id, 'verification_failed_hard');

      RETURN jsonb_build_object(
        'outcome', 'fail',
        'confidence', v_confidence,
        'attempts_remaining', 0,
        'blocked', true,
        'session_status', 'verification_blocked'
      );
    END IF;

    RETURN jsonb_build_object(
      'outcome', 'fail',
      'confidence', v_confidence,
      'attempts_remaining', v_attempts_left,
      'blocked', false,
      'session_status', 'awaiting_verification'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.verify_student_identity(uuid, float4[]) TO authenticated;

-- T037: start_exam_session RPC — transitions verified → in_progress, returns questions (no correct_answer)
CREATE OR REPLACE FUNCTION public.start_exam_session(p_session_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_session public.exam_sessions%ROWTYPE;
  v_exam    public.exams%ROWTYPE;
  v_now     timestamptz := now();
BEGIN
  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id
    AND student_id = auth.uid();

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  -- Idempotent: already started
  IF v_session.status = 'in_progress' THEN
    RETURN jsonb_build_object(
      'session', jsonb_build_object(
        'id', v_session.id,
        'started_at', v_session.started_at,
        'status', 'in_progress'
      ),
      'questions', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'position', q.position,
            'type', q.question_type,
            'prompt', q.question_text,
            'options', q.options,
            'points', q.points
          ) ORDER BY q.position
        )
        FROM public.exam_questions q
        WHERE q.exam_id = v_session.exam_id
      )
    );
  END IF;

  IF v_session.status != 'verified' THEN
    RAISE EXCEPTION 'session_not_verified';
  END IF;

  SELECT * INTO v_exam FROM public.exams WHERE id = v_session.exam_id;

  IF v_now > (v_exam.starts_at + (v_exam.duration_minutes || ' minutes')::interval) THEN
    RAISE EXCEPTION 'exam_window_closed';
  END IF;

  UPDATE public.exam_sessions
  SET status = 'in_progress', started_at = v_now, updated_at = v_now
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'started_at', v_now,
      'status', 'in_progress'
    ),
    'questions', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'position', q.position,
          'type', q.question_type,
          'prompt', q.question_text,
          'options', q.options,
          'points', q.points
        ) ORDER BY q.position
      )
      FROM public.exam_questions q
      WHERE q.exam_id = v_session.exam_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.start_exam_session(uuid) TO authenticated;

-- T044 supporting RPC: list_my_sessions
CREATE OR REPLACE FUNCTION public.list_my_sessions()
RETURNS TABLE (
  session_id        uuid,
  exam_id           uuid,
  exam_title        text,
  exam_starts_at    timestamptz,
  duration_minutes  integer,
  status            text,
  started_at        timestamptz,
  submitted_at      timestamptz,
  live_cheating_score float,
  created_at        timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    es.id             AS session_id,
    es.exam_id,
    e.title::text     AS exam_title,
    e.starts_at       AS exam_starts_at,
    e.duration_minutes,
    es.status::text,
    es.started_at,
    es.submitted_at,
    es.live_cheating_score,
    es.created_at
  FROM public.exam_sessions es
  JOIN public.exams e ON e.id = es.exam_id
  WHERE es.student_id = auth.uid()
  ORDER BY es.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.list_my_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_sessions() TO service_role;

-- ============================================================================
-- 15. US3: record_violation_batch RPC
-- ============================================================================
-- Single write path for all client-side violation signals.
-- Enforces: session ownership, taxonomy validation, policy guard, idempotency.
-- Recomputes live_cheating_score with exponential decay (half-life = 60s).
-- Raises instructor_alerts for: camera_lost, multiple_persons, critical_sustained.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_violation_batch(
  p_session_id uuid,
  p_events     jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_session      public.exam_sessions%ROWTYPE;
  v_exam         public.exams%ROWTYPE;
  v_policy       jsonb;
  v_event        jsonb;
  v_client_id    text;
  v_type         text;
  v_severity     integer;
  v_captured_at  timestamptz;
  v_metadata     jsonb;
  v_evidence     jsonb;
  v_evidence_ok  boolean;
  v_batch_size   integer;
  v_accepted     integer := 0;
  v_deduped      integer := 0;
  v_rejected     integer := 0;
  v_score        float;
  v_score_before float;
  v_warn_thresh  float;
  v_crit_thresh  float;
  v_sustain_sec  float;
  v_crossed_warn boolean := false;
  v_crossed_crit boolean := false;
  v_alert_raised boolean := false;
  v_camera_event boolean := false;
  v_multi_event  boolean := false;
  v_now          timestamptz := now();
  v_last_multi   timestamptz;
  v_taxonomy     text[] := ARRAY[
    'gaze_looking_away','gaze_sustained_away','gaze_prolonged_away',
    'eye_closure','excessive_blinking','rapid_eye_movement',
    'face_not_detected','multiple_faces','face_too_close','face_too_far',
    'tab_switch','tab_switch_prolonged','window_minimize',
    'head_pose_extreme','head_pose_moderate',
    'phone_detected','headphones_detected',
    'answer_pattern_suspicious','ip_address_change',
    'gaze_off_screen','face_not_visible','multiple_persons',
    'tab_focus_lost','camera_unavailable','audio_anomaly'
  ];
BEGIN
  -- ── Validate session ownership and status ──────────────────────────────────
  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF v_session.student_id != auth.uid() THEN
    RAISE EXCEPTION 'session_not_owned';
  END IF;

  IF v_session.status != 'in_progress' THEN
    RAISE EXCEPTION 'session_not_in_progress';
  END IF;

  -- ── Validate exam window ──────────────────────────────────────────────────
  SELECT * INTO v_exam FROM public.exams WHERE id = v_session.exam_id;

  IF v_now > (v_exam.starts_at + (v_exam.duration_minutes || ' minutes')::interval) THEN
    RAISE EXCEPTION 'exam_window_closed';
  END IF;

  v_policy     := v_exam.proctoring_policy;
  v_warn_thresh := (v_policy->>'warning_threshold')::float;
  v_crit_thresh := (v_policy->>'critical_threshold')::float;
  v_sustain_sec := (v_policy->>'critical_sustain_seconds')::float;

  -- ── Validate batch size ───────────────────────────────────────────────────
  v_batch_size := jsonb_array_length(p_events);
  IF v_batch_size = 0 OR v_batch_size > 50 THEN
    RAISE EXCEPTION 'batch_too_large';
  END IF;

  -- ── Policy guard: pre-scan for evidence under disallowing policy ──────────
  IF NOT (v_policy->>'visual_evidence_allowed')::boolean THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events) LOOP
      v_evidence := v_event->'evidence';
      IF v_evidence IS NOT NULL AND (v_evidence->>'captured')::boolean = true THEN
        RAISE EXCEPTION 'evidence_policy_violation';
      END IF;
    END LOOP;
  END IF;

  -- ── Insert events ─────────────────────────────────────────────────────────
  FOR v_event IN SELECT * FROM jsonb_array_elements(p_events) LOOP
    v_client_id   := v_event->>'client_event_id';
    v_type        := v_event->>'type';
    v_severity    := (v_event->>'severity')::integer;
    v_captured_at := (v_event->>'client_captured_at')::timestamptz;
    v_metadata    := COALESCE(v_event->'metadata', '{}'::jsonb);
    v_evidence    := v_event->'evidence';

    -- Validate type
    IF NOT (v_type = ANY(v_taxonomy)) THEN
      v_rejected := v_rejected + 1;
      CONTINUE;
    END IF;

    -- Insert with idempotency guard
    INSERT INTO public.violation_events (
      session_id,
      client_event_id,
      type,
      severity,
      client_captured_at,
      metadata
    )
    VALUES (
      p_session_id,
      v_client_id,
      v_type,
      v_severity,
      v_captured_at,
      v_metadata
    )
    ON CONFLICT (session_id, client_event_id) DO NOTHING;

    IF FOUND THEN
      v_accepted := v_accepted + 1;
      -- Track special event types for alert side-effects
      IF v_type = 'camera_unavailable' THEN v_camera_event := true; END IF;
      IF v_type = 'multiple_persons' THEN v_multi_event := true; END IF;
    ELSE
      v_deduped := v_deduped + 1;
    END IF;
  END LOOP;

  -- ── Recompute live_cheating_score (exponential decay, half-life = 60s) ────
  SELECT LEAST(100.0, COALESCE(SUM(
    ve.severity * POWER(2, -EXTRACT(EPOCH FROM (v_now - ve.server_recorded_at)) / 60.0)
  ), 0))
  INTO v_score
  FROM public.violation_events ve
  WHERE ve.session_id = p_session_id;

  v_score_before := v_session.live_cheating_score;

  UPDATE public.exam_sessions
  SET
    live_cheating_score   = v_score,
    last_score_update_at  = CASE WHEN v_score != v_score_before THEN v_now ELSE last_score_update_at END,
    updated_at            = v_now
  WHERE id = p_session_id;

  -- ── Threshold flag ────────────────────────────────────────────────────────
  IF v_score >= v_warn_thresh THEN v_crossed_warn := true; END IF;
  IF v_score >= v_crit_thresh THEN v_crossed_crit := true; END IF;

  -- ── Alert: camera_lost ────────────────────────────────────────────────────
  IF v_camera_event THEN
    INSERT INTO public.instructor_alerts (exam_id, session_id, reason)
    VALUES (v_session.exam_id, p_session_id, 'camera_lost');
    v_alert_raised := true;
  END IF;

  -- ── Alert: multiple_persons (coalesced: max 1 per 30 s) ──────────────────
  IF v_multi_event THEN
    SELECT MAX(raised_at) INTO v_last_multi
    FROM public.instructor_alerts
    WHERE session_id = p_session_id
      AND reason = 'multiple_persons';

    IF v_last_multi IS NULL OR v_now - v_last_multi > interval '30 seconds' THEN
      INSERT INTO public.instructor_alerts (exam_id, session_id, reason)
      VALUES (v_session.exam_id, p_session_id, 'multiple_persons');
      v_alert_raised := true;
    END IF;
  END IF;

  -- ── Alert: critical_score_sustained ──────────────────────────────────────
  IF v_crossed_crit THEN
    -- Check how long score has been at or above critical
    -- Using last_score_update_at as the proxy for when score entered critical range
    IF v_session.last_score_update_at IS NOT NULL
       AND v_score_before >= v_crit_thresh
       AND EXTRACT(EPOCH FROM (v_now - v_session.last_score_update_at)) >= v_sustain_sec
    THEN
      -- Only raise once per session per 60 s (idempotent coalesce)
      IF NOT EXISTS (
        SELECT 1 FROM public.instructor_alerts
        WHERE session_id = p_session_id
          AND reason = 'critical_score_sustained'
          AND raised_at > v_now - interval '60 seconds'
      ) THEN
        INSERT INTO public.instructor_alerts (exam_id, session_id, reason)
        VALUES (v_session.exam_id, p_session_id, 'critical_score_sustained');
        v_alert_raised := true;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'accepted',                  v_accepted,
    'deduplicated',              v_deduped,
    'rejected',                  v_rejected,
    'live_cheating_score',       v_score,
    'crossed_warning_threshold', v_crossed_warn,
    'crossed_critical_threshold',v_crossed_crit,
    'instructor_alert_raised',   v_alert_raised
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_violation_batch(uuid, jsonb) TO authenticated;
