-- ============================================================================
-- Migration 012: Peak cheating score + instructor incident review
-- ============================================================================
-- Problem 1: live_cheating_score decays to near-zero by submission time, so
--   final_cheating_score in submissions doesn't reflect the worst point of the
--   exam. Fix: track peak_cheating_score separately (never decays).
-- Problem 2: No way for instructors to mark violations as reviewed or override
--   the final risk score. Fix: add review columns + RPCs.
-- ============================================================================

-- ── 1. Peak score on exam_sessions ──────────────────────────────────────────
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS peak_cheating_score float NOT NULL DEFAULT 0
    CHECK (peak_cheating_score >= 0 AND peak_cheating_score <= 100);

-- Backfill existing rows: best estimate from current live score
UPDATE public.exam_sessions
  SET peak_cheating_score = live_cheating_score
  WHERE peak_cheating_score = 0 AND live_cheating_score > 0;

-- ── 2. Instructor review columns on violation_events ────────────────────────
ALTER TABLE public.violation_events
  ADD COLUMN IF NOT EXISTS is_reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instructor_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 3. Instructor override on submissions ───────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS instructor_override_score float
    CHECK (instructor_override_score IS NULL OR (instructor_override_score >= 0 AND instructor_override_score <= 100)),
  ADD COLUMN IF NOT EXISTS instructor_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 4. record_violation_batch: add peak tracking ─────────────────────────────
-- Full replacement of the function from migration 006, with one change:
-- the UPDATE on exam_sessions now also sets peak_cheating_score.
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
  -- Validate session ownership and status
  SELECT * INTO v_session FROM public.exam_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF v_session.student_id != auth.uid() THEN RAISE EXCEPTION 'session_not_owned'; END IF;
  IF v_session.status != 'in_progress' THEN RAISE EXCEPTION 'session_not_in_progress'; END IF;

  -- Validate exam window
  SELECT * INTO v_exam FROM public.exams WHERE id = v_session.exam_id;
  IF v_now > (v_exam.starts_at + (v_exam.duration_minutes || ' minutes')::interval) THEN
    RAISE EXCEPTION 'exam_window_closed';
  END IF;

  v_policy      := v_exam.proctoring_policy;
  v_warn_thresh := (v_policy->>'warning_threshold')::float;
  v_crit_thresh := (v_policy->>'critical_threshold')::float;
  v_sustain_sec := (v_policy->>'critical_sustain_seconds')::float;

  -- Validate batch size
  v_batch_size := jsonb_array_length(p_events);
  IF v_batch_size = 0 OR v_batch_size > 50 THEN RAISE EXCEPTION 'batch_too_large'; END IF;

  -- Policy guard: evidence under disallowing policy
  IF NOT (v_policy->>'visual_evidence_allowed')::boolean THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events) LOOP
      v_evidence := v_event->'evidence';
      IF v_evidence IS NOT NULL AND (v_evidence->>'captured')::boolean = true THEN
        RAISE EXCEPTION 'evidence_policy_violation';
      END IF;
    END LOOP;
  END IF;

  -- Insert events
  FOR v_event IN SELECT * FROM jsonb_array_elements(p_events) LOOP
    v_client_id   := v_event->>'client_event_id';
    v_type        := v_event->>'type';
    v_severity    := (v_event->>'severity')::integer;
    v_captured_at := (v_event->>'client_captured_at')::timestamptz;
    v_metadata    := COALESCE(v_event->'metadata', '{}'::jsonb);
    v_evidence    := v_event->'evidence';

    IF NOT (v_type = ANY(v_taxonomy)) THEN
      v_rejected := v_rejected + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.violation_events (
      session_id, client_event_id, type, severity, client_captured_at, metadata
    ) VALUES (
      p_session_id, v_client_id, v_type, v_severity, v_captured_at, v_metadata
    )
    ON CONFLICT (session_id, client_event_id) DO NOTHING;

    IF FOUND THEN
      v_accepted := v_accepted + 1;
      IF v_type = 'camera_unavailable' THEN v_camera_event := true; END IF;
      IF v_type = 'multiple_persons' THEN v_multi_event := true; END IF;
    ELSE
      v_deduped := v_deduped + 1;
    END IF;
  END LOOP;

  -- Recompute live_cheating_score (exponential decay, half-life = 60s)
  SELECT LEAST(100.0, COALESCE(SUM(
    ve.severity * POWER(2, -EXTRACT(EPOCH FROM (v_now - ve.server_recorded_at)) / 60.0)
  ), 0))
  INTO v_score
  FROM public.violation_events ve
  WHERE ve.session_id = p_session_id;

  v_score_before := v_session.live_cheating_score;

  -- KEY CHANGE: also update peak_cheating_score (never decays)
  UPDATE public.exam_sessions
  SET
    live_cheating_score  = v_score,
    peak_cheating_score  = GREATEST(COALESCE(peak_cheating_score, 0), v_score),
    last_score_update_at = CASE WHEN v_score != v_score_before THEN v_now ELSE last_score_update_at END,
    updated_at           = v_now
  WHERE id = p_session_id;

  -- Threshold flags
  IF v_score >= v_warn_thresh THEN v_crossed_warn := true; END IF;
  IF v_score >= v_crit_thresh THEN v_crossed_crit := true; END IF;

  -- Alert: camera_lost
  IF v_camera_event THEN
    INSERT INTO public.instructor_alerts (exam_id, session_id, reason)
    VALUES (v_session.exam_id, p_session_id, 'camera_lost');
    v_alert_raised := true;
  END IF;

  -- Alert: multiple_persons (coalesced: max 1 per 30s)
  IF v_multi_event THEN
    SELECT MAX(raised_at) INTO v_last_multi
    FROM public.instructor_alerts
    WHERE session_id = p_session_id AND reason = 'multiple_persons';

    IF v_last_multi IS NULL OR v_now - v_last_multi > interval '30 seconds' THEN
      INSERT INTO public.instructor_alerts (exam_id, session_id, reason)
      VALUES (v_session.exam_id, p_session_id, 'multiple_persons');
      v_alert_raised := true;
    END IF;
  END IF;

  -- Alert: critical_score_sustained
  IF v_crossed_crit THEN
    IF v_session.last_score_update_at IS NOT NULL
       AND v_score_before >= v_crit_thresh
       AND EXTRACT(EPOCH FROM (v_now - v_session.last_score_update_at)) >= v_sustain_sec
    THEN
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
    'accepted',                   v_accepted,
    'deduplicated',               v_deduped,
    'rejected',                   v_rejected,
    'live_cheating_score',        v_score,
    'crossed_warning_threshold',  v_crossed_warn,
    'crossed_critical_threshold', v_crossed_crit,
    'instructor_alert_raised',    v_alert_raised
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_violation_batch(uuid, jsonb) TO authenticated;

-- ── 5. update list_exam_submissions to include override score ────────────────
CREATE OR REPLACE FUNCTION public.list_exam_submissions(p_exam_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_instructor_id uuid;
BEGIN
  SELECT instructor_id INTO v_instructor_id FROM public.exams WHERE id = p_exam_id;
  IF v_instructor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'submission_id',           s.id,
        'session_id',              s.session_id,
        'student_id',              es.student_id,
        'student_name',            u.full_name,
        'student_email',           u.email,
        'submitted_at',            s.submitted_at,
        'submit_reason',           s.submit_reason,
        'grade_status',            s.grade_status,
        'auto_graded_score',       s.auto_graded_score,
        'auto_graded_max',         s.auto_graded_max,
        'final_grade',             s.final_grade,
        'final_cheating_score',    s.final_cheating_score,
        'instructor_override_score', s.instructor_override_score,
        'instructor_note',         s.instructor_note,
        'reviewed_at',             s.reviewed_at,
        'idempotent_hit',          false,
        'calibration_skipped',     es.calibration_skipped,
        'optimal_distance_cm',     es.optimal_distance_cm,
        'distance_tolerance_cm',   es.distance_tolerance_cm,
        'evidence_package_id',     ep.id,
        'violation_summary',       ep.violation_summary
      )
      ORDER BY s.submitted_at DESC
    )
    FROM public.submissions s
    JOIN public.exam_sessions es ON es.id = s.session_id
    LEFT JOIN public.users u ON u.id = es.student_id
    LEFT JOIN public.evidence_packages ep ON ep.submission_id = s.id
    WHERE es.exam_id = p_exam_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.list_exam_submissions(uuid) TO authenticated;

-- ── 6. RPC: review_violation ─────────────────────────────────────────────────
-- Instructor marks a specific violation as reviewed (or un-reviewed) with an
-- optional note. Auth check: caller must own the exam the session belongs to.
CREATE OR REPLACE FUNCTION public.review_violation(
  p_violation_id uuid,
  p_is_reviewed  boolean DEFAULT true,
  p_note         text    DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exam_id uuid;
BEGIN
  SELECT e.id INTO v_exam_id
  FROM public.violation_events ve
  JOIN public.exam_sessions es ON es.id = ve.session_id
  JOIN public.exams e ON e.id = es.exam_id
  WHERE ve.id = p_violation_id;

  IF v_exam_id IS NULL THEN RAISE EXCEPTION 'violation_not_found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.exams WHERE id = v_exam_id AND instructor_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.violation_events
  SET
    is_reviewed     = p_is_reviewed,
    instructor_note = p_note,
    reviewed_at     = CASE WHEN p_is_reviewed THEN now() ELSE NULL END,
    reviewed_by     = CASE WHEN p_is_reviewed THEN auth.uid() ELSE NULL END
  WHERE id = p_violation_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_violation(uuid, boolean, text) TO authenticated;

-- ── 7. RPC: override_submission_score ────────────────────────────────────────
-- Instructor overrides the final risk score for a submission. Pass NULL score
-- to remove a previously set override.
CREATE OR REPLACE FUNCTION public.override_submission_score(
  p_session_id     uuid,
  p_override_score float,
  p_note           text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exam_id uuid;
BEGIN
  SELECT exam_id INTO v_exam_id FROM public.exam_sessions WHERE id = p_session_id;
  IF v_exam_id IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.exams WHERE id = v_exam_id AND instructor_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_override_score IS NOT NULL AND (p_override_score < 0 OR p_override_score > 100) THEN
    RAISE EXCEPTION 'invalid_score_range';
  END IF;

  UPDATE public.submissions
  SET
    instructor_override_score = p_override_score,
    instructor_note           = p_note,
    reviewed_at               = now(),
    reviewed_by               = auth.uid()
  WHERE session_id = p_session_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.override_submission_score(uuid, float, text) TO authenticated;
