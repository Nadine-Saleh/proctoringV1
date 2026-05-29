-- ============================================
-- Phase 3: Cheating Score Helper Functions
-- ============================================
-- Database functions for calculating and updating cheating scores

-- ============================================
-- Function: Calculate cheating score for a session
-- ============================================
-- This function calculates the cheating score based on recent violations
-- and inserts/updates the cheating_scores table

CREATE OR REPLACE FUNCTION calculate_cheating_score(
  p_session_id UUID,
  p_window_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (
  overall_score DECIMAL(5,2),
  risk_level VARCHAR(20),
  total_violations INTEGER,
  critical_violations INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID;
  v_exam_id UUID;
  v_window_start TIMESTAMPTZ;
  v_total_violations INTEGER;
  v_critical_violations INTEGER;
  v_total_weight DECIMAL(10,2);
  v_max_expected_weight DECIMAL(10,2) := 100;
  v_normalized_score DECIMAL(5,2);
  v_high_severity_2min INTEGER;
  v_critical_severity_5min INTEGER;
  v_risk_level VARCHAR(20);
BEGIN
  -- Get session info
  SELECT student_id, exam_id INTO v_student_id, v_exam_id
  FROM exam_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  -- Calculate time window
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Count violations in window
  SELECT COUNT(*),
         SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END),
         COALESCE(SUM(weight), 0)
  INTO v_total_violations, v_critical_violations, v_total_weight
  FROM violation_events
  WHERE session_id = p_session_id
    AND occurred_at >= v_window_start;

  -- Handle no violations case
  IF v_total_violations = 0 THEN
    -- Insert or update with zero score
    INSERT INTO cheating_scores (
      session_id, exam_id, student_id,
      overall_score, risk_level, total_violations, critical_violations,
      calculated_at, calculation_window_minutes
    ) VALUES (
      p_session_id, v_exam_id, v_student_id,
      0, 'low', 0, 0,
      NOW(), p_window_minutes
    )
    ON CONFLICT (session_id) DO UPDATE SET
      overall_score = 0,
      risk_level = 'low',
      total_violations = 0,
      critical_violations = 0,
      calculated_at = NOW(),
      updated_at = NOW();

    overall_score := 0;
    risk_level := 'low';
    total_violations := 0;
    critical_violations := 0;
    RETURN;
  END IF;

  -- Calculate normalized score
  v_normalized_score := LEAST(100, (v_total_weight / v_max_expected_weight) * 100);

  -- Count high severity events in last 2 minutes
  SELECT COUNT(*)
  INTO v_high_severity_2min
  FROM violation_events
  WHERE session_id = p_session_id
    AND severity = 'high'
    AND occurred_at >= NOW() - INTERVAL '2 minutes';

  -- Count critical severity events in window
  v_critical_severity_5min := v_critical_violations;

  -- Determine risk level
  IF v_normalized_score >= 75 OR v_critical_severity_5min >= 2 OR (v_normalized_score >= 60 AND v_high_severity_2min >= 3) THEN
    v_risk_level := 'critical';
  ELSIF v_normalized_score >= 50 OR v_high_severity_2min >= 2 THEN
    v_risk_level := 'high';
  ELSIF v_normalized_score >= 25 THEN
    v_risk_level := 'medium';
  ELSE
    v_risk_level := 'low';
  END IF;

  -- Insert or update cheating score
  INSERT INTO cheating_scores (
    session_id, exam_id, student_id,
    overall_score, risk_level, total_violations, critical_violations,
    calculated_at, calculation_window_minutes, updated_at
  ) VALUES (
    p_session_id, v_exam_id, v_student_id,
    v_normalized_score, v_risk_level, v_total_violations, v_critical_violations,
    NOW(), p_window_minutes, NOW()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    overall_score = v_normalized_score,
    risk_level = v_risk_level,
    total_violations = v_total_violations,
    critical_violations = v_critical_violations,
    calculated_at = NOW(),
    updated_at = NOW();

  -- Return results
  overall_score := v_normalized_score;
  risk_level := v_risk_level;
  total_violations := v_total_violations;
  critical_violations := v_critical_violations;
END;
$$;

-- ============================================
-- Function: Record violation and update score
-- ============================================
-- This function records a violation and automatically recalculates the score

CREATE OR REPLACE FUNCTION record_violation_and_update_score(
  p_session_id UUID,
  p_exam_id UUID,
  p_student_id UUID,
  p_violation_type VARCHAR(50),
  p_severity VARCHAR(20) DEFAULT 'medium',
  p_weight DECIMAL(5,2) DEFAULT 0,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_duration_ms INTEGER DEFAULT NULL
)
RETURNS TABLE (
  violation_id UUID,
  overall_score DECIMAL(5,2),
  risk_level VARCHAR(20),
  total_violations INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_violation_id UUID;
  v_score_result RECORD;
BEGIN
  -- Insert violation
  INSERT INTO violation_events (
    session_id, exam_id, student_id,
    violation_type, severity, weight,
    description, metadata, duration_ms,
    occurred_at
  ) VALUES (
    p_session_id, p_exam_id, p_student_id,
    p_violation_type, p_severity, p_weight,
    p_description, p_metadata, p_duration_ms,
    NOW()
  )
  RETURNING id INTO v_violation_id;

  -- Recalculate score
  SELECT * INTO v_score_result
  FROM calculate_cheating_score(p_session_id);

  -- Return results
  violation_id := v_violation_id;
  overall_score := v_score_result.overall_score;
  risk_level := v_score_result.risk_level;
  total_violations := v_score_result.total_violations;
END;
$$;

-- ============================================
-- Function: Get recent high-risk sessions
-- ============================================
-- Returns sessions with high/critical risk in the last N minutes

CREATE OR REPLACE FUNCTION get_high_risk_sessions(
  p_exam_id UUID DEFAULT NULL,
  p_minutes_ago INTEGER DEFAULT 30
)
RETURNS TABLE (
  session_id UUID,
  student_id UUID,
  student_name TEXT,
  student_email TEXT,
  exam_id UUID,
  exam_title TEXT,
  overall_score DECIMAL(5,2),
  risk_level VARCHAR(20),
  total_violations INTEGER,
  calculated_at TIMESTAMPTZ,
  recent_violations JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.session_id,
    cs.student_id,
    u.full_name AS student_name,
    u.email AS student_email,
    cs.exam_id,
    e.title AS exam_title,
    cs.overall_score,
    cs.risk_level,
    cs.total_violations,
    cs.calculated_at,
    (
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', ve.id,
          'type', ve.violation_type,
          'severity', ve.severity,
          'occurred_at', ve.occurred_at,
          'description', ve.description
        )
      )
      FROM violation_events ve
      WHERE ve.session_id = cs.session_id
        AND ve.occurred_at >= NOW() - (p_minutes_ago || ' minutes')::INTERVAL
      ORDER BY ve.occurred_at DESC
    ) AS recent_violations
  FROM cheating_scores cs
  JOIN exam_sessions es ON cs.session_id = es.id
  JOIN users u ON cs.student_id = u.id
  JOIN exams e ON cs.exam_id = e.id
  WHERE cs.risk_level IN ('high', 'critical')
    AND cs.calculated_at >= NOW() - (p_minutes_ago || ' minutes')::INTERVAL
    AND (p_exam_id IS NULL OR cs.exam_id = p_exam_id)
  ORDER BY cs.overall_score DESC, cs.calculated_at DESC;
END;
$$;

-- ============================================
-- Function: Acknowledge instructor alert
-- ============================================

CREATE OR REPLACE FUNCTION acknowledge_instructor_alert(
  p_alert_id UUID,
  p_instructor_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE instructor_alerts
  SET
    is_acknowledged = TRUE,
    acknowledged_by = p_instructor_id,
    acknowledged_at = NOW()
  WHERE id = p_alert_id
    AND is_acknowledged = FALSE;

  RETURN FOUND;
END;
$$;

-- ============================================
-- Function: Create instructor alert
-- ============================================

CREATE OR REPLACE FUNCTION create_instructor_alert(
  p_exam_id UUID,
  p_session_id UUID,
  p_student_id UUID,
  p_title VARCHAR(255),
  p_message TEXT,
  p_alert_type VARCHAR(50) DEFAULT 'cheating_risk',
  p_priority VARCHAR(20) DEFAULT 'high',
  p_cheating_score_at_time DECIMAL(5,2) DEFAULT NULL,
  p_violation_summary JSONB DEFAULT '[]'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO instructor_alerts (
    exam_id, session_id, student_id,
    alert_type, priority, cheating_score_at_time,
    title, message, violation_summary
  ) VALUES (
    p_exam_id, p_session_id, p_student_id,
    p_alert_type, p_priority, p_cheating_score_at_time,
    p_title, p_message, p_violation_summary
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$;
