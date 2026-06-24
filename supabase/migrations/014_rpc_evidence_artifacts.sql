-- ============================================================================
-- Migration 014: Link evidence artifacts in record_violation_batch
-- ============================================================================
-- Extends record_violation_batch to support the "evidence" object in event
-- payloads. When "evidence.captured" is true, it inserts a row into
-- public.evidence_artifacts and links it to the violation event.
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
  v_evidence_img text;
  v_artifact_id  uuid;
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
  SELECT * INTO v_session FROM public.exam_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF v_session.student_id != auth.uid() THEN RAISE EXCEPTION 'session_not_owned'; END IF;
  IF v_session.status != 'in_progress' THEN RAISE EXCEPTION 'session_not_in_progress'; END IF;

  SELECT * INTO v_exam FROM public.exams WHERE id = v_session.exam_id;
  IF v_now > (v_exam.starts_at + (v_exam.duration_minutes || ' minutes')::interval) THEN
    RAISE EXCEPTION 'exam_window_closed';
  END IF;

  v_policy      := v_exam.proctoring_policy;
  v_warn_thresh := (v_policy->>'warning_threshold')::float;
  v_crit_thresh := (v_policy->>'critical_threshold')::float;
  v_sustain_sec := (v_policy->>'critical_sustain_seconds')::float;

  v_batch_size := jsonb_array_length(p_events);
  IF v_batch_size = 0 OR v_batch_size > 50 THEN RAISE EXCEPTION 'batch_too_large'; END IF;

  -- Policy guard: any form of visual evidence under a disallowing policy
  IF NOT (v_policy->>'visual_evidence_allowed')::boolean THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events) LOOP
      v_evidence := v_event->'evidence';
      IF v_evidence IS NOT NULL AND (v_evidence->>'captured')::boolean = true THEN
        RAISE EXCEPTION 'evidence_policy_violation';
      END IF;
      IF (v_event->>'evidence_image') IS NOT NULL THEN
        RAISE EXCEPTION 'evidence_policy_violation';
      END IF;
    END LOOP;
  END IF;

  FOR v_event IN SELECT * FROM jsonb_array_elements(p_events) LOOP
    v_client_id    := v_event->>'client_event_id';
    v_type         := v_event->>'type';
    v_severity     := (v_event->>'severity')::integer;
    v_captured_at  := (v_event->>'client_captured_at')::timestamptz;
    v_metadata     := COALESCE(v_event->'metadata', '{}'::jsonb);
    v_evidence_img := v_event->>'evidence_image';
    v_evidence     := v_event->'evidence';
    v_artifact_id  := NULL;

    IF NOT (v_type = ANY(v_taxonomy)) THEN
      v_rejected := v_rejected + 1;
      CONTINUE;
    END IF;

    -- Handle binary evidence artifact linkage
    IF v_evidence IS NOT NULL AND (v_evidence->>'captured')::boolean = true THEN
      INSERT INTO public.evidence_artifacts (
        session_id, bucket_path, content_type, byte_length, captured_at
      ) VALUES (
        p_session_id, 
        v_evidence->>'bucket_path', 
        v_evidence->>'content_type', 
        (v_evidence->>'byte_length')::integer,
        v_captured_at
      )
      ON CONFLICT (bucket_path) DO UPDATE SET bucket_path = EXCLUDED.bucket_path
      RETURNING id INTO v_artifact_id;
    END IF;

    INSERT INTO public.violation_events (
      session_id, exam_id, student_id, client_event_id, type, severity, client_captured_at, metadata, evidence_image, evidence_artifact_id
    ) VALUES (
      p_session_id, v_session.exam_id, v_session.student_id, v_client_id, v_type, v_severity, v_captured_at, v_metadata, v_evidence_img, v_artifact_id
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

  SELECT LEAST(100.0, COALESCE(SUM(
    ve.severity * POWER(2, -EXTRACT(EPOCH FROM (v_now - ve.server_recorded_at)) / 60.0)
  ), 0))
  INTO v_score
  FROM public.violation_events ve
  WHERE ve.session_id = p_session_id;

  v_score_before := v_session.live_cheating_score;

  UPDATE public.exam_sessions
  SET
    live_cheating_score  = v_score,
    peak_cheating_score  = GREATEST(COALESCE(peak_cheating_score, 0), v_score),
    last_score_update_at = CASE WHEN v_score != v_score_before THEN v_now ELSE last_score_update_at END,
    updated_at           = v_now
  WHERE id = p_session_id;

  IF v_score >= v_warn_thresh THEN v_crossed_warn := true; END IF;
  IF v_score >= v_crit_thresh THEN v_crossed_crit := true; END IF;

  IF v_camera_event THEN
    INSERT INTO public.instructor_alerts (exam_id, session_id, reason)
    VALUES (v_session.exam_id, p_session_id, 'camera_lost');
    v_alert_raised := true;
  END IF;

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
