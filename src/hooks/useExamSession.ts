// ============================================
// Phase 2: useExamSession Hook
// ============================================
// Manages exam session lifecycle: creation, heartbeat, submission
// Responsibility: React interface for session management

import { useState, useCallback, useRef, useEffect } from 'react';
import { ExamSessionService } from '../services/examSessionService';
import { ExamSubmissionService } from '../services/ExamSubmissionService';
import { SessionHeartbeat } from '../utils/SessionHeartbeat';
import { supabase } from '../lib/supabase/client';
import type {
  ExamSession,
  ExamSubmission,
  ExamSubmissionResult,
  SubmittedAnswer,
} from '../types/examSession';

interface UseExamSessionReturn {
  // Session state
  session: ExamSession | null;
  isLoading: boolean;
  error: string | null;

  // Session actions
  startSession: (examId: string, studentId: string, livenessData?: Record<string, unknown>) => Promise<boolean>;
  submitExam: (answers: SubmittedAnswer[], durationSeconds: number) => Promise<ExamSubmissionResult>;

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopHeartbeat();
    };
  });

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
  }, []);

  /**
   * Submit the exam
   */
  const submitExam = useCallback(async (
    answers: SubmittedAnswer[],
    durationSeconds: number
  ): Promise<ExamSubmissionResult> => {
    if (!session) {
      return { success: false, error: 'No active session' };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Stop timer and heartbeat
      stopTimer();
      stopHeartbeat();

      // Build submission object
      const submission: ExamSubmission = {
        session_id: session.id,
        exam_id: session.exam_id,
        answers,
        duration_taken_seconds: durationSeconds,
        liveness_check_passed: session.liveness_check_passed,
        violation_count: 0, // Will be populated from violation events
        user_agent: navigator.userAgent,
      };

      // Submit
      const result = await ExamSubmissionService.submit(submission);

      if (result.success) {
        // Update local session state
        setSession(prev => prev ? {
          ...prev,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          duration_taken_seconds: durationSeconds,
        } : null);
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
  }, [session]);

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

  /**
   * Start heartbeat for session
   */
  const startHeartbeat = useCallback((sessionId: string) => {
    if (heartbeatRef.current) {
      heartbeatRef.current.stop();
    }

    const heartbeat = new SessionHeartbeat(30000); // 30 second interval
    heartbeat.start(sessionId, {
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

  return {
    // Session state
    session,
    isLoading,
    error,

    // Session actions
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
