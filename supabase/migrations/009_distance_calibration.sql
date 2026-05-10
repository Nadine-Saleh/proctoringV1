-- ============================================================================
-- 009 — Distance Calibration (FR-013a, FR-013b, FR-013c)
-- ============================================================================
-- Adds per-session distance-calibration baseline columns to exam_sessions and
-- extends start_exam_session to accept and persist the calibration payload.
-- See specs/001-ai-proctoring-system/research.md R12 for the design decision.

-- ----------------------------------------------------------------------------
-- T037a — schema additions
-- ----------------------------------------------------------------------------

ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS optimal_distance_cm   numeric,
  ADD COLUMN IF NOT EXISTS distance_tolerance_cm numeric,
  ADD COLUMN IF NOT EXISTS calibration_skipped   boolean NOT NULL DEFAULT false;

ALTER TABLE public.exam_sessions
  DROP CONSTRAINT IF EXISTS exam_sessions_optimal_distance_range,
  DROP CONSTRAINT IF EXISTS exam_sessions_distance_tolerance_range,
  DROP CONSTRAINT IF EXISTS exam_sessions_distance_paired_null;

ALTER TABLE public.exam_sessions
  ADD CONSTRAINT exam_sessions_optimal_distance_range
    CHECK (optimal_distance_cm IS NULL OR (optimal_distance_cm BETWEEN 20 AND 100)),
  ADD CONSTRAINT exam_sessions_distance_tolerance_range
    CHECK (distance_tolerance_cm IS NULL OR (distance_tolerance_cm BETWEEN 5 AND 30)),
  ADD CONSTRAINT exam_sessions_distance_paired_null
    CHECK (
      (optimal_distance_cm IS NULL AND distance_tolerance_cm IS NULL)
      OR (optimal_distance_cm IS NOT NULL AND distance_tolerance_cm IS NOT NULL)
    );

-- ----------------------------------------------------------------------------
-- T037b — start_exam_session(p_session_id uuid, p_calibration jsonb)
-- ----------------------------------------------------------------------------
-- Drop the old single-parameter signature; the new contract requires both.
-- Callers that still send only the uuid will receive a clear "function does not
-- exist" error rather than silently writing NULL calibration columns.

DROP FUNCTION IF EXISTS public.start_exam_session(uuid);

CREATE OR REPLACE FUNCTION public.start_exam_session(
  p_session_id  uuid,
  p_calibration jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_session             public.exam_sessions%ROWTYPE;
  v_exam                public.exams%ROWTYPE;
  v_now                 timestamptz := now();
  v_skipped             boolean;
  v_optimal_cm          numeric;
  v_tolerance_cm        numeric;
BEGIN
  -- Validate calibration payload shape up front so we never partially write.
  IF p_calibration IS NULL OR jsonb_typeof(p_calibration) != 'object' THEN
    RAISE EXCEPTION 'calibration_invalid';
  END IF;

  IF jsonb_typeof(p_calibration->'calibration_skipped') != 'boolean' THEN
    RAISE EXCEPTION 'calibration_invalid';
  END IF;

  v_skipped := (p_calibration->>'calibration_skipped')::boolean;

  IF v_skipped THEN
    -- FR-013b: conservative server-side defaults
    v_optimal_cm   := 50;
    v_tolerance_cm := 20;
  ELSE
    -- FR-013a: explicit calibrated values, range-checked
    IF p_calibration->'optimal_distance_cm' IS NULL
       OR p_calibration->'distance_tolerance_cm' IS NULL
       OR jsonb_typeof(p_calibration->'optimal_distance_cm') != 'number'
       OR jsonb_typeof(p_calibration->'distance_tolerance_cm') != 'number' THEN
      RAISE EXCEPTION 'calibration_invalid';
    END IF;

    v_optimal_cm   := (p_calibration->>'optimal_distance_cm')::numeric;
    v_tolerance_cm := (p_calibration->>'distance_tolerance_cm')::numeric;

    IF v_optimal_cm < 20 OR v_optimal_cm > 100
       OR v_tolerance_cm < 5 OR v_tolerance_cm > 30 THEN
      RAISE EXCEPTION 'calibration_invalid';
    END IF;
  END IF;

  -- Load the session row, scoped to caller.
  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id
    AND student_id = auth.uid();

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  -- Idempotent: already started → echo persisted calibration unchanged.
  IF v_session.status = 'in_progress' THEN
    RETURN jsonb_build_object(
      'session', jsonb_build_object(
        'id',                    v_session.id,
        'started_at',            v_session.started_at,
        'status',                'in_progress',
        'optimal_distance_cm',   v_session.optimal_distance_cm,
        'distance_tolerance_cm', v_session.distance_tolerance_cm,
        'calibration_skipped',   v_session.calibration_skipped
      ),
      'questions', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',       q.id,
            'position', q.position,
            'type',     q.question_type,
            'prompt',   q.question_text,
            'options',  q.options,
            'points',   q.points
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

  -- Single-shot write of calibration + state transition. Subsequent calls hit
  -- the idempotent branch above and cannot overwrite these three columns.
  UPDATE public.exam_sessions
  SET status                = 'in_progress',
      started_at            = v_now,
      updated_at            = v_now,
      optimal_distance_cm   = v_optimal_cm,
      distance_tolerance_cm = v_tolerance_cm,
      calibration_skipped   = v_skipped
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id',                    v_session.id,
      'started_at',            v_now,
      'status',                'in_progress',
      'optimal_distance_cm',   v_optimal_cm,
      'distance_tolerance_cm', v_tolerance_cm,
      'calibration_skipped',   v_skipped
    ),
    'questions', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',       q.id,
          'position', q.position,
          'type',     q.question_type,
          'prompt',   q.question_text,
          'options',  q.options,
          'points',   q.points
        ) ORDER BY q.position
      )
      FROM public.exam_questions q
      WHERE q.exam_id = v_session.exam_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.start_exam_session(uuid, jsonb) TO authenticated;
