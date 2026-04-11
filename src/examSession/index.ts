// ============================================
// Phase 2: Exam Session Module Re-exports
// ============================================
// Convenience barrel file for Phase 2 exports

// Services
export { ExamSessionService } from '../services/ExamSessionService';
export { StudentAnswerService } from '../services/StudentAnswerService';
export { ExamSubmissionService } from '../services/ExamSubmissionService';

// Hooks
export { useExamSession } from '../hooks/useExamSession';
export { useExamAnswers } from '../hooks/useExamAnswers';

// Utilities
export { SessionHeartbeat } from '../utils/SessionHeartbeat';

// Components
export { ExamSubmissionModal } from '../components/ExamSubmissionModal';

// Types
export type {
  ExamSession,
  ExamSessionStatus,
  CreateExamSessionInput,
  UpdateExamSessionInput,
  StudentAnswer,
  CreateStudentAnswerInput,
  UpdateStudentAnswerInput,
  ExamSubmission,
  SubmittedAnswer,
  ExamSubmissionResult,
  QuestionForGrading,
  GradedAnswer,
  ExamGrade,
  HeartbeatStatus,
  ExamSessionSummary,
} from '../types/examSession';
