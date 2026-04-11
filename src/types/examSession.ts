// ============================================
// Phase 2: Exam Session Types
// ============================================
// Shared type definitions for exam session management

// ============================================
// Exam Session
// ============================================

export type ExamSessionStatus = 'pending' | 'in_progress' | 'submitted' | 'flagged' | 'invalidated';

export interface ExamSession {
  id: string;
  exam_id: string;
  student_id: string;
  status: ExamSessionStatus;
  started_at: string;
  submitted_at: string | null;
  duration_taken_seconds: number | null;
  liveness_check_passed: boolean;
  liveness_check_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CreateExamSessionInput {
  exam_id: string;
  student_id: string;
  liveness_check_passed?: boolean;
  liveness_check_data?: Record<string, unknown>;
  user_agent?: string;
}

export interface UpdateExamSessionInput {
  status?: ExamSessionStatus;
  submitted_at?: string | null;
  duration_taken_seconds?: number | null;
  liveness_check_passed?: boolean;
  liveness_check_data?: Record<string, unknown>;
}

// ============================================
// Student Answers
// ============================================

export interface StudentAnswer {
  id: string;
  session_id: string;
  question_id: string;
  selected_answer: string | null;
  is_correct: boolean | null;
  time_spent_seconds: number | null;
  answer_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStudentAnswerInput {
  session_id: string;
  question_id: string;
  selected_answer?: string | null;
  time_spent_seconds?: number | null;
  answer_order?: number | null;
}

export interface UpdateStudentAnswerInput {
  selected_answer?: string | null;
  time_spent_seconds?: number | null;
}

// ============================================
// Exam Submission
// ============================================

export interface ExamSubmission {
  session_id: string;
  exam_id: string;
  answers: SubmittedAnswer[];
  duration_taken_seconds: number;
  liveness_check_passed: boolean;
  violation_count: number;
  user_agent: string;
}

export interface SubmittedAnswer {
  question_id: string;
  selected_answer: string | null;
  time_spent_seconds: number | null;
}

export interface ExamSubmissionResult {
  success: boolean;
  error?: string;
  exam_score?: number;
  exam_percentage?: number;
  total_questions?: number;
  correct_answers?: number;
  session_id?: string;
}

// ============================================
// Grading
// ============================================

export interface QuestionForGrading {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'essay';
  correct_answer: string | null;
  points: number;
}

export interface GradedAnswer {
  question_id: string;
  question_text: string;
  selected_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean;
  points_earned: number;
  points_possible: number;
}

export interface ExamGrade {
  session_id: string;
  exam_id: string;
  student_id: string;
  total_score: number;
  percentage: number;
  total_questions: number;
  correct_answers: number;
  graded_answers: GradedAnswer[];
  graded_at: string;
}

// ============================================
// Heartbeat
// ============================================

export interface HeartbeatStatus {
  is_active: boolean;
  last_heartbeat: string | null;
  session_id: string | null;
  interval_ms: number;
}

// ============================================
// Session Summary (for instructor view)
// ============================================

export interface ExamSessionSummary {
  session_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  exam_id: string;
  exam_title: string;
  status: ExamSessionStatus;
  started_at: string;
  submitted_at: string | null;
  duration_taken_seconds: number | null;
  duration_minutes: number;
  exam_score: number | null;
  exam_percentage: number | null;
  violation_count: number;
  cheating_score: number | null;
  risk_level: string | null;
  liveness_check_passed: boolean;
}
