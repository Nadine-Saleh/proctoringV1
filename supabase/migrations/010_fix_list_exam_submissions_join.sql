-- ============================================================================
-- 010 — Fix list_exam_submissions evidence_packages join
-- ============================================================================
-- The original definition in 006 joined evidence_packages on a non-existent
-- column (`ep.session_id`). The actual schema (006:250-257) keys
-- evidence_packages by `submission_id`. The instructor results dashboard
-- calls list_exam_submissions and surfaced the Postgres error
-- "column ep.session_id does not exist".

CREATE OR REPLACE FUNCTION public.list_exam_submissions(p_exam_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_instructor_id uuid;
BEGIN
  SELECT instructor_id INTO v_instructor_id
  FROM public.exams
  WHERE id = p_exam_id;

  IF v_instructor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'submission_id',       s.id,
        'session_id',          s.session_id,
        'student_id',          es.student_id,
        'student_name',        u.full_name,
        'student_email',       u.email,
        'submitted_at',        s.submitted_at,
        'submit_reason',       s.submit_reason,
        'grade_status',        s.grade_status,
        'auto_graded_score',   s.auto_graded_score,
        'auto_graded_max',     s.auto_graded_max,
        'final_grade',         s.final_grade,
        'final_cheating_score',s.final_cheating_score,
        'idempotent_hit',      false,
        'calibration_skipped', es.calibration_skipped,
        'optimal_distance_cm', es.optimal_distance_cm,
        'distance_tolerance_cm', es.distance_tolerance_cm,
        'evidence_package_id', ep.id,
        'violation_summary',   ep.violation_summary
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
