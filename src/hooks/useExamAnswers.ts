// ============================================
// Phase 2: useExamAnswers Hook
// ============================================
// Manages answer state with local-first architecture
// Responsibility: Answer tracking, sync to server, submission preparation

import { useState, useCallback, useRef } from 'react';
import { StudentAnswerService } from '../services/StudentAnswerService';
import type { SubmittedAnswer } from '../types/examSession';

interface UseExamAnswersReturn {
  // Answer state
  answers: Map<string, number>; // questionId -> selectedOptionIndex
  answeredCount: number;
  totalQuestions: number;
  completionPercentage: number;

  // Time tracking per question
  questionTimes: Map<string, number>; // questionId -> seconds spent
  currentQuestionStartTime: number;

  // Actions
  selectAnswer: (questionId: string, optionIndex: number) => void;
  clearAnswer: (questionId: string) => void;
  setCurrentQuestion: (questionId: string | null) => void;
  getSubmittedAnswers: () => SubmittedAnswer[];

  // Sync
  syncToServer: (sessionId: string) => Promise<void>;
  isSyncing: boolean;
  syncError: string | null;

  // Reset
  reset: () => void;
}

export function useExamAnswers(totalQuestions: number): UseExamAnswersReturn {
  // Local answer state
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [answeredCount, setAnsweredCount] = useState(0);

  // Time tracking
  const [questionTimes, setQuestionTimes] = useState<Map<string, number>>(new Map());
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState(0);
  const currentQuestionIdRef = useRef<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Track dirty answers (need to be synced)
  const dirtyAnswersRef = useRef<Set<string>>(new Set());

  // Debounced auto-sync
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      // Sync will be triggered by the component when sessionId is available
      // This just clears the timeout
    }, 5000);
  }, []);

  // Track start time when question becomes active
  const setCurrentQuestion = useCallback((questionId: string | null) => {
    // Save time spent on previous question
    if (currentQuestionIdRef.current && currentQuestionStartTime > 0) {
      const timeSpent = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
      setQuestionTimes(prev => {
        const updated = new Map(prev);
        const prevTime = updated.get(currentQuestionIdRef.current!) ?? 0;
        updated.set(currentQuestionIdRef.current!, prevTime + timeSpent);
        return updated;
      });
    }

    // Set new question start time
    currentQuestionIdRef.current = questionId;
    if (questionId) {
      setCurrentQuestionStartTime(Date.now());
    } else {
      setCurrentQuestionStartTime(0);
    }
  }, [currentQuestionStartTime]);

  /**
   * Select an answer for a question
   */
  const selectAnswer = useCallback((questionId: string, optionIndex: number) => {
    setAnswers(prev => {
      const updated = new Map(prev);
      const wasAnswered = updated.has(questionId);
      updated.set(questionId, optionIndex);

      // Update answered count if this is a new answer
      if (!wasAnswered) {
        setAnsweredCount(count => count + 1);
      }

      return updated;
    });

    // Mark as dirty for sync
    dirtyAnswersRef.current.add(questionId);

    // Auto-sync after answer (debounced)
    scheduleSync();
  }, [scheduleSync]);

  /**
   * Clear an answer for a question
   */
  const clearAnswer = useCallback((questionId: string) => {
    setAnswers(prev => {
      const updated = new Map(prev);
      const wasAnswered = updated.has(questionId);
      updated.delete(questionId);

      if (wasAnswered) {
        setAnsweredCount(count => Math.max(0, count - 1));
      }

      return updated;
    });

    // Mark as dirty for sync
    dirtyAnswersRef.current.add(questionId);
  }, []);

  /**
   * Get answers in submission format
   */
  const getSubmittedAnswers = useCallback((): SubmittedAnswer[] => {
    const submittedAnswers: SubmittedAnswer[] = [];

    for (const [questionId, _optionIndex] of answers) {
      const timeSpent = questionTimes.get(questionId) ?? null;
      submittedAnswers.push({
        question_id: questionId,
        selected_answer: String(_optionIndex),
        time_spent_seconds: timeSpent,
      });
    }

    return submittedAnswers;
  }, [answers, questionTimes]);

  /**
   * Sync dirty answers to server
   */
  const syncToServer = useCallback(async (sessionId: string) => {
    if (dirtyAnswersRef.current.size === 0) {
      return; // Nothing to sync
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const answersToSync: Array<{
        session_id: string;
        question_id: string;
        selected_answer: string | null;
        time_spent_seconds: number | null;
        answer_order: number;
      }> = [];

      let order = 1;
      for (const questionId of dirtyAnswersRef.current) {
        const optionIndex = answers.get(questionId);
        const timeSpent = questionTimes.get(questionId) ?? null;

        answersToSync.push({
          session_id: sessionId,
          question_id: questionId,
          selected_answer: optionIndex !== undefined ? String(optionIndex) : null,
          time_spent_seconds: timeSpent,
          answer_order: order++,
        });
      }

      const result = await StudentAnswerService.upsertBatch(answersToSync);

      if (!result.success) {
        setSyncError(result.error ?? 'Failed to sync answers');
        console.error('[useExamAnswers] Sync failed:', result.error);
        return;
      }

      // Clear dirty set after successful sync
      dirtyAnswersRef.current.clear();
      console.log('[useExamAnswers] Answers synced successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSyncError(message);
      console.error('[useExamAnswers] Unexpected sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [answers, questionTimes]);

  /**
   * Reset all answer state
   */
  const reset = useCallback(() => {
    setAnswers(new Map());
    setAnsweredCount(0);
    setQuestionTimes(new Map());
    setCurrentQuestionStartTime(0);
    currentQuestionIdRef.current = null;
    dirtyAnswersRef.current.clear();
    setSyncError(null);

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, []);

  // Calculate completion percentage
  const completionPercentage = totalQuestions > 0
    ? (answeredCount / totalQuestions) * 100
    : 0;

  return {
    // Answer state
    answers,
    answeredCount,
    totalQuestions,
    completionPercentage,

    // Time tracking
    questionTimes,
    currentQuestionStartTime,

    // Actions
    selectAnswer,
    clearAnswer,
    setCurrentQuestion,
    getSubmittedAnswers,

    // Sync
    syncToServer,
    isSyncing,
    syncError,

    // Reset
    reset,
  };
}
