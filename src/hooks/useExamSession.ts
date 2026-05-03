// ============================================
// Phase 2: useExamSession Hook
// ============================================
// Manages exam session lifecycle: creation, heartbeat, submission
// Responsibility: React interface for session management

import { useState, useCallback, useRef, useEffect } from 'react';
import { ExamSessionService } from '../services/examSessionService';
import { ExamSubmissionService } from '../services/ExamSubmissionService';
import { IdentityVerificationService, type JoinExamResponse, type StartSessionResponse } from '../services/IdentityVerificationService';
import { SessionHeartbeat } from '../utils/SessionHeartbeat';
import { supabase } from '../lib/supabase/client';
import type {
  ExamSession,
  ExamSubmission,
  ExamSubmissionResult,
  SubmittedAnswer,
} from '../types/examSession';

type SessionLifecycleStatus =
  | 'idle'
  | 'awaiting_verification'
  | 'verification_blocked'
  | 'verified'
  | 'in_progress'
  | 'submitted'
  | 'auto_submitted'
  | 'terminated';

interface UseExamSessionReturn {
  // Session state
  session: ExamSession | null;
  sessionId: string | null;
  lifecycleStatus: SessionLifecycleStatus;
  joinData: JoinExamResponse | null;
  questions: StartSessionResponse['questions'] | null;
  isLoading: boolean;
  error: string | null;

  // US2 state-machine actions
  joinExam: (accessCode: string, freshCapture?: boolean) => Promise<boolean>;
  verifyIdentity: (embedding: Float32Array) => Promise<{ passed: boolean; blocked: boolean }>;
  beginExam: () => Promise<boolean>;

  // Continue-exam flow: hydrate `session` from a URL `sessionId` param so the
  // submission path has the fields it needs without going through startSession.
  loadSession: (sessionId: string) => Promise<boolean>;

  // Legacy session actions
  startSession: (examId: string, studentId: string, livenessData?: Record<string, unknown>) => Promise<boolean>;
  submitExam: (
    answers: SubmittedAnswer[],
    durationSeconds: number,
    overrides?: { sessionId?: string; examId?: string },
  ) => Promise<ExamSubmissionResult>;

  // Timer state
  timeElapsed: number;
  isTimerRunning: boolean;
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;

  // Heartbeat status
  isHeartbeatActive: boolean;
  heartbeatMissedBeats: number;
}

export function useExamSession(): UseExamSessionReturn {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lifecycleStatus, setLifecycleStatus] = useState<SessionLifecycleStatus>('idle');
  const [joinData, setJoinData] = useState<JoinExamResponse | null>(null);
  const [questions, setQuestions] = useState<StartSessionResponse['questions'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timer state
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Heartbeat
  const heartbeatRef = useRef<SessionHeartbeat | null>(null);
  const [isHeartbeatActive, setIsHeartbeatActive] = useState(false);
  const [heartbeatMissedBeats, setHeartbeatMissedBeats] = useState(0);

  // ── Timer ──────────────────────────────────────────────────────────────────

  /**
   * Start the exam timer
   */
  const startTimer = useCallback(() => {
    if (timerRef.current) return; // Already running

    startTimeRef.current = Date.now() - (timeElapsed * 1000);
    setIsTimerRunning(true);

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTimeElapsed(elapsed);
    }, 1000);
  }, [timeElapsed]);

  /**
   * Stop the exam timer
   */
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);

  /**
   * Reset the exam timer
   */
  const resetTimer = useCallback(() => {
    stopTimer();
    setTimeElapsed(0);
    startTimeRef.current = 0;
  }, [stopTimer]);

  // ── Heartbeat ──────────────────────────────────────────────────────────────

  /**
   * Start heartbeat for session
   */
  const startHeartbeat = useCallback((sessionIdArg: string) => {
    if (heartbeatRef.current) {
      heartbeatRef.current.stop();
    }

    const heartbeat = new SessionHeartbeat(30000); // 30 second interval
    heartbeat.start(sessionIdArg, {
      onSuccess: () => {
        // Heartbeat succeeded (no UI update needed)
      },
      onFailure: (error) => {
        console.warn('[useExamSession] Heartbeat failed:', error);
        setHeartbeatMissedBeats(heartbeat.missedBeatCount);
      },
      onTimeout: () => {
        console.error('[useExamSession] Session heartbeat timeout');
        setError('Connection lost. Please check your internet connection.');
      },
    });

    heartbeatRef.current = heartbeat;
    setIsHeartbeatActive(true);
    setHeartbeatMissedBeats(0);
  }, []);

  /**
   * Stop heartbeat
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      heartbeatRef.current.stop();
      heartbeatRef.current = null;
    }
    setIsHeartbeatActive(false);
    setHeartbeatMissedBeats(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopHeartbeat();
    };
  }, [stopTimer, stopHeartbeat]);

  // ── Hydrate session from URL sessionId (continue-exam flow) ────────────────

  const loadSession = useCallback(async (sid: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await ExamSessionService.getById(sid);
      if (!result.success || !result.session) {
        setError(result.error ?? 'Failed to load session');
        return false;
      }
      setSession(result.session);
      setSessionId(result.session.id);
      setLifecycleStatus(result.session.status as SessionLifecycleStatus);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── US2 state-machine actions ──────────────────────────────────────────────

  const joinExam = useCallback(async (
    accessCode: string,
    freshCapture = false
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await IdentityVerificationService.joinExam(accessCode, freshCapture);
      if (!result.success || !result.data) {
        setError(result.error ?? 'Failed to join exam');
        return false;
      }
      setSessionId(result.data.session_id);
      setJoinData(result.data);
      setLifecycleStatus('awaiting_verification');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyIdentity = useCallback(async (
    embedding: Float32Array
  ): Promise<{ passed: boolean; blocked: boolean }> => {
    if (!sessionId) return { passed: false, blocked: false };
    setIsLoading(true);
    setError(null);
    try {
      const result = await IdentityVerificationService.verifyIdentity(sessionId, embedding);
      if (!result.success || !result.data) {
        setError(result.error ?? 'Verification failed');
        return { passed: false, blocked: false };
      }
      const { outcome, blocked, session_status } = result.data;
      setLifecycleStatus(session_status as SessionLifecycleStatus);
      return { passed: outcome === 'pass', blocked };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return { passed: false, blocked: false };
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const beginExam = useCallback(async (): Promise<boolean> => {
    if (!sessionId) return false;
    setIsLoading(true);
    setError(null);
    try {
      const result = await IdentityVerificationService.startSession(sessionId, { calibration_skipped: true });
      if (!result.success || !result.data) {
        setError(result.error ?? 'Failed to start exam');
        return false;
      }
      setQuestions(result.data.questions);
      setLifecycleStatus('in_progress');
      startTimer();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, startTimer]);

  // ── Legacy session actions ─────────────────────────────────────────────────

  /**
   * Start a new exam session
   */
  const startSession = useCallback(async (
    examId: string,
    studentId: string,
    livenessData?: Record<string, unknown>
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Verify user is authenticated with Supabase
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (!supabaseUser) {
        const errorMsg = 'User not authenticated with Supabase. Please sign in again.';
        console.error('[useExamSession]', errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        return false;
      }

      // Verify the studentId matches the authenticated user
      if (supabaseUser.id !== studentId) {
        console.warn('[useExamSession] User ID mismatch: auth=', supabaseUser.id, 'provided=', studentId);
      }

      // First, check if there's already an active session for this student/exam
      const existingResult = await ExamSessionService.getActiveSession(studentId, examId);

      if (existingResult.success && existingResult.session) {
        // Reuse existing session
        console.log('[useExamSession] Found existing active session:', existingResult.session.id);
        setSession(existingResult.session);
        startHeartbeat(existingResult.session.id);
        startTimer();
        return true;
      }

      // Create the session
      const result = await ExamSessionService.create({
        exam_id: examId,
        student_id: studentId,
        liveness_check_passed: true,
        liveness_check_data: livenessData,
      });

      if (!result.success || !result.session) {
        console.error('[useExamSession] Failed to create session:', JSON.stringify(result, null, 2));
        setError(result.error ?? 'Failed to start exam session');
        return false;
      }

      setSession(result.session);

      // Start heartbeat
      startHeartbeat(result.session.id);

      // Start timer
      startTimer();

      console.log('[useExamSession] Session started:', result.session.id);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useExamSession] Error starting session:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [startHeartbeat, startTimer]);

  /**
   * Submit the exam
   */
  const submitExam = useCallback(async (
    answers: SubmittedAnswer[],
    durationSeconds: number,
    overrides?: { sessionId?: string; examId?: string },
  ): Promise<ExamSubmissionResult> => {
    // The US2 flow never populates `session`, only `sessionId`. Accept overrides
    // so submission works with either path. We fall back to a fresh DB read if
    // we don't have an in-memory session — the Edge Function and the direct
    // submit path both load fields from the DB anyway.
    const targetSessionId = session?.id ?? overrides?.sessionId;
    if (!targetSessionId) {
      return { success: false, error: 'No active session' };
    }

    setIsLoading(true);
    setError(null);

    try {
      stopTimer();
      stopHeartbeat();

      const submission: ExamSubmission = {
        session_id: targetSessionId,
        exam_id: session?.exam_id ?? overrides?.examId ?? '',
        answers,
        duration_taken_seconds: durationSeconds,
        liveness_check_passed: session?.liveness_check_passed ?? false,
        violation_count: 0,
        user_agent: navigator.userAgent,
      };

      const result = await ExamSubmissionService.submit(submission);

      if (result.success) {
        // Defensive: ensure exam_sessions.status flips even if the path that
        // succeeded didn't update it (e.g. an idempotent edge hit on a stale row).
        const persisted = await ExamSessionService.submit(targetSessionId, durationSeconds);
        if (!persisted.success) {
          console.warn('[useExamSession] Fallback session.submit failed:', persisted.error);
        }

        setSession(prev => prev ? {
          ...prev,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          duration_taken_seconds: durationSeconds,
        } : null);
        setLifecycleStatus('submitted');
      } else {
        setError(result.error ?? 'Submission failed');
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useExamSession] Error submitting exam:', err);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [session, stopTimer, stopHeartbeat]);

  return {
    // Session state
    session,
    sessionId,
    lifecycleStatus,
    joinData,
    questions,
    isLoading,
    error,

    // US2 state-machine actions
    joinExam,
    verifyIdentity,
    beginExam,

    // Continue-exam hydration
    loadSession,

    // Legacy session actions
    startSession,
    submitExam,

    // Timer state
    timeElapsed,
    isTimerRunning,
    startTimer,
    stopTimer,
    resetTimer,

    // Heartbeat status
    isHeartbeatActive,
    heartbeatMissedBeats,
  };
}
