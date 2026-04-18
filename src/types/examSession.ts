// ============================================
// Phase 2: Canonical Violation Taxonomy
// ============================================
// Single source of truth for violation types and severity
// Consumed by: violationScorer.ts, record_violation_batch RPC, student UI, instructor UI

export const VIOLATION_TAXONOMY = {
  gaze_off_screen: { severity: 15, description: 'Student gaze directed away from screen' },
  face_not_visible: { severity: 20, description: 'Face not detected in frame' },
  multiple_persons: { severity: 25, description: 'Multiple persons detected in frame' },
  tab_focus_lost: { severity: 10, description: 'Browser tab lost focus' },
  camera_unavailable: { severity: 25, description: 'Camera became unavailable' },
  audio_anomaly: { severity: 5, description: 'Unexpected audio detected (reserved for v2)' },
} as const;

export type ViolationType = keyof typeof VIOLATION_TAXONOMY;

export const VIOLATION_TYPES = Object.keys(VIOLATION_TAXONOMY) as ViolationType[];

export const isValidViolationType = (type: string): type is ViolationType => {
  return type in VIOLATION_TAXONOMY;
};

// ============================================
// Exam Session
// ============================================

export type ExamSessionStatus =
  | 'awaiting_verification'
  | 'verification_blocked'
  | 'verified'
  | 'in_progress'
  | 'submitted'
  | 'auto_submitted'
  | 'terminated';

export interface ExamSession {
  id: string;
  exam_id: string;
  student_id: string;
  status: ExamSessionStatus;
  admitted_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  live_cheating_score: number;
  last_score_update_at: string | null;
  submit_reason: 'manual' | 'auto_window_close' | 'auto_disconnect' | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExamSessionInput {
  exam_id: string;
}

export interface UpdateExamSessionInput {
  status?: ExamSessionStatus;
  admitted_at?: string | null;
  started_at?: string | null;
  submitted_at?: string | null;
  live_cheating_score?: number;
  last_score_update_at?: string | null;
  submit_reason?: 'manual' | 'auto_window_close' | 'auto_disconnect' | null;
}

// ============================================
// Violation Events
// ============================================

export interface ViolationEvent {
  id: string;
  session_id: string;
  client_event_id: string;
  type: ViolationType;
  severity: number;
  client_captured_at: string;
  server_recorded_at: string;
  evidence_artifact_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateViolationEventInput {
  session_id: string;
  client_event_id: string;
  type: ViolationType;
  client_captured_at: string;
  evidence_artifact_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateViolationEventInput {
  evidence_artifact_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ViolationSummary {
  violation_type: ViolationType;
  count: number;
  severity: number;
  first_occurrence: string;
  last_occurrence: string;
}

// ============================================
// Student Answers
// ============================================

export interface StudentAnswer {
  id: string;
  session_id: string;
  question_id: string;
  answer: Record<string, unknown>;
  frozen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStudentAnswerInput {
  session_id: string;
  question_id: string;
  answer: Record<string, unknown>;
  selected_answer?: string | null;
  time_spent_seconds?: number | null;
  answer_order?: number | null;
}

export interface UpdateStudentAnswerInput {
  answer: Record<string, unknown>;
  selected_answer?: string | null;
  time_spent_seconds?: number | null;
}

// ============================================
// Exam Submission
// ============================================

export type GradeStatus = 'auto_final' | 'partial_pending_review' | 'fully_pending_review';

export interface Submission {
  id: string;
  session_id: string;
  exam_id: string;
  student_id: string;
  submitted_at: string;
  submit_reason: 'manual' | 'auto_window_close' | 'auto_disconnect';
  auto_graded_score: number | null;
  auto_graded_max: number | null;
  final_grade: number | null;
  grade_status: GradeStatus;
  final_cheating_score: number;
  evidence_package_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Evidence & Artifacts
// ============================================

export interface EvidenceArtifact {
  id: string;
  session_id: string;
  bucket_path: string;
  captured_at: string;
  expires_at: string;
  retained_for_case: boolean;
  content_type: string;
  byte_length: number;
  created_at: string;
}

export interface EvidencePackage {
  id: string;
  submission_id: string;
  assembled_at: string;
  violation_summary: {
    by_type: Record<ViolationType, number>;
    total_count: number;
    max_severity: number;
  };
  timeline_version: number;
  created_at: string;
}

// ============================================
// Instructor Alerts
// ============================================

export type AlertReason =
  | 'critical_score_sustained'
  | 'camera_lost'
  | 'verification_failed_hard'
  | 'multiple_persons';

export interface InstructorAlert {
  id: string;
  exam_id: string;
  session_id: string;
  reason: AlertReason;
  raised_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
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
// Legacy/Compatibility Types (for migration)
// ============================================

export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

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
