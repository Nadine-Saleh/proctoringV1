// User and Role Types
export type UserRole = 'student' | 'instructor';

// Exam Types
export interface Exam {
  id: number;
  title: string;
  subject: string;
  duration: number;
  questions: number;
  startDate: string;
  status: ExamStatus;
  instructor: string;
}

export type ExamStatus = 'available' | 'upcoming' | 'completed';

// Question Types
export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface QuestionFormData {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

// Result Types
export interface StudentResult {
  id: number;
  examId: number;
  examTitle: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  completedAt: string;
  status: 'passed' | 'failed';
}

export interface StudentExamResult {
  studentId: number;
  studentName: string;
  email: string;
  score: number;
  completedAt: string;
  duration: number;
  flaggedEvents: number;
}

// Proctoring Types
export interface ProctoringEvent {
  id: number;
  studentId: number;
  studentName: string;
  examId: number;
  timestamp: string;
  type: ProctoringEventType;
  severity: ProctoringSeverity;
  description: string;
  evidenceImage?: string;
}

export type ProctoringEventType =
  | 'face_not_detected'
  | 'multiple_faces'
  | 'tab_switch'
  | 'phone_detected'
  | 'looking_away'
  | 'eye_closure'
  | 'rapid_eye_movement'
  | 'excessive_blinking';

export type ProctoringSeverity = 'low' | 'medium' | 'high' | 'critical';

// App Context Types
export interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  currentExam: Exam | null;
  setCurrentExam: (exam: Exam) => void;
}

// Proctoring Hook Types
export interface ProctoringStatus {
  camera: boolean;
  faceDetected: boolean;
  multipleFaces: boolean;
  tabActive: boolean;
  modelsLoaded: boolean;
  loading: boolean;
  errorMessage: string | null;
}

export interface UseProctoringReturn {
  status: ProctoringStatus;
  videoRef: React.RefCallback<HTMLVideoElement>;
  retryCamera: () => void;
  clearError: () => void;
}

// Navigation Link Types
export interface NavLink {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Stats Types
export interface ExamStats {
  average: number;
  highest: number;
  lowest: number;
  passing: number;
}