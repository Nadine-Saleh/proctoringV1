// ============================================
// Phase 2: Exam Session Module Re-exports
// ============================================
// Convenience barrel file for Phase 2 exports

// Services
export { ExamSessionService } from '../services/ExamSessionService';
export { StudentAnswerService } from '../services/StudentAnswerService';
export { ExamSubmissionService } from '../services/ExamSubmissionService';
export { ViolationEventService } from '../services/ViolationEventService';

// Hooks
export { useExamSession } from '../hooks/useExamSession';
export { useExamAnswers } from '../hooks/useExamAnswers';
export { useViolationTracker } from '../hooks/useViolationTracker';

// Utilities
export { SessionHeartbeat } from '../utils/SessionHeartbeat';
export { OfflineQueue } from '../utils/OfflineQueue';

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
  // Phase 3: Violation types
  ViolationEvent,
  ViolationSeverity,
  ViolationType,
  CreateViolationEventInput,
  UpdateViolationEventInput,
  ViolationSummary,
} from '../types/examSession';
