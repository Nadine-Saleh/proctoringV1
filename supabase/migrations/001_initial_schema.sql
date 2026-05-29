-- ============================================
-- ProctoringV2 Initial Schema Migration
-- ============================================
-- This migration creates the complete database schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('student', 'instructor', 'admin')) NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXAMS
-- ============================================
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(100),
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  passing_score DECIMAL(5,2),
  settings JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- ============================================
-- QUESTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'essay')),
  options JSONB,
  correct_answer VARCHAR(10),
  points INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- ============================================
-- EXAM SESSIONS (Exam Attempts)
-- ============================================
CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'flagged', 'invalidated')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  duration_taken_seconds INTEGER,
  liveness_check_passed BOOLEAN DEFAULT FALSE,
  liveness_check_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VIOLATION EVENTS (Raw Proctoring Data)
-- ============================================
CREATE TABLE IF NOT EXISTS violation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Violation Details
  violation_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  weight DECIMAL(5,2) DEFAULT 0,
  
  -- Timing
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  
  -- Context
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Processing
  is_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHEATING SCORES (Calculated Periodically)
-- ============================================
CREATE TABLE IF NOT EXISTS cheating_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Scores (0-100)
  overall_score DECIMAL(5,2) NOT NULL,
  gaze_score DECIMAL(5,2) DEFAULT 0,
  face_detection_score DECIMAL(5,2) DEFAULT 0,
  tab_switch_score DECIMAL(5,2) DEFAULT 0,
  behavioral_score DECIMAL(5,2) DEFAULT 0,
  
  -- Metrics
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  total_violations INTEGER DEFAULT 0,
  critical_violations INTEGER DEFAULT 0,
  attention_score DECIMAL(5,2),
  avg_violation_interval_sec INTEGER,
  
  -- Time Windows (for rolling calculation)
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  last_violation_at TIMESTAMPTZ,
  calculation_window_minutes INTEGER DEFAULT 5,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STUDENT ANSWERS
-- ============================================
CREATE TABLE IF NOT EXISTS student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer VARCHAR(10),
  is_correct BOOLEAN,
  time_spent_seconds INTEGER,
  answer_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALERTS (Instructor Notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS instructor_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Alert Details
  alert_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  cheating_score_at_time DECIMAL(5,2),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  violation_summary JSONB,
  
  -- Status
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROCTORING REPORTS (Final Summary)
-- ============================================
CREATE TABLE IF NOT EXISTS proctoring_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Summary
  final_cheating_score DECIMAL(5,2) NOT NULL,
  final_risk_level VARCHAR(20) NOT NULL,
  total_violations INTEGER NOT NULL,
  violation_breakdown JSONB,
  
  -- Exam Performance
  exam_score DECIMAL(5,2),
  exam_percentage DECIMAL(5,2),
  time_taken_minutes DECIMAL(5,2),
  
  -- Recommendation
  instructor_recommendation VARCHAR(50),
  instructor_notes TEXT,
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Violation events indexes
CREATE INDEX IF NOT EXISTS idx_violation_sessions ON violation_events(session_id);
CREATE INDEX IF NOT EXISTS idx_violation_students ON violation_events(student_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_violation_exams ON violation_events(exam_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_violation_type ON violation_events(violation_type);
CREATE INDEX IF NOT EXISTS idx_violation_severity ON violation_events(severity);

-- Cheating scores indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_cheating_session ON cheating_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_cheating_exam ON cheating_scores(exam_id);
CREATE INDEX IF NOT EXISTS idx_cheating_risk ON cheating_scores(risk_level);

-- Student answers indexes
CREATE INDEX IF NOT EXISTS idx_answers_session ON student_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON student_answers(question_id);

-- Instructor alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_exam_active ON instructor_alerts(exam_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_student ON instructor_alerts(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON instructor_alerts(priority);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON instructor_alerts(is_acknowledged);

-- Proctoring reports indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_session ON proctoring_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_report_exam ON proctoring_reports(exam_id);
CREATE INDEX IF NOT EXISTS idx_report_risk ON proctoring_reports(final_risk_level);

-- Exams indexes
CREATE INDEX IF NOT EXISTS idx_exams_instructor ON exams(instructor_id);
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);

-- Exam sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_exam ON exam_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON exam_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON exam_sessions(status);

-- Questions indexes
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_sort ON questions(sort_order);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to exams table
CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to student_answers table
CREATE TRIGGER update_student_answers_updated_at
  BEFORE UPDATE ON student_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to cheating_scores table
CREATE TRIGGER update_cheating_scores_updated_at
  BEFORE UPDATE ON cheating_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
