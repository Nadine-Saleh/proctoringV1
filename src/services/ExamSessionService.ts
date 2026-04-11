// ============================================
// Phase 2: Exam Session Service
// ============================================
// Handles all database operations for exam sessions
// Responsibility: CRUD operations for exam_sessions table

import { supabase } from '../lib/supabase/client';
import type {
  ExamSession,
  CreateExamSessionInput,
  UpdateExamSessionInput,
  ExamSessionSummary,
  ExamSessionStatus,
} from '../types/examSession';

export class ExamSessionService {
  /**
   * Create a new exam session
   */
  static async create(input: CreateExamSessionInput): Promise<{ success: boolean; session?: ExamSession; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .insert({
          exam_id: input.exam_id,
          student_id: input.student_id,
          status: 'in_progress',
          liveness_check_passed: input.liveness_check_passed ?? false,
          liveness_check_data: input.liveness_check_data ?? null,
          user_agent: input.user_agent ?? navigator.userAgent,
          started_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[ExamSessionService] Failed to create session:', error);
        return { success: false, error: error.message };
      }

      return { success: true, session: data as ExamSession };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSessionService] Unexpected error creating session:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get a session by ID
   */
  static async getById(sessionId: string): Promise<{ success: boolean; session?: ExamSession; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('[ExamSessionService] Failed to fetch session:', error);
        return { success: false, error: error.message };
      }

      return { success: true, session: data as ExamSession };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSessionService] Unexpected error fetching session:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Update an exam session
   */
  static async update(sessionId: string, input: UpdateExamSessionInput): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('exam_sessions')
        .update(input as any)
        .eq('id', sessionId);

      if (error) {
        console.error('[ExamSessionService] Failed to update session:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSessionService] Unexpected error updating session:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Submit a session (mark as completed)
   */
  static async submit(sessionId: string, durationSeconds: number): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('exam_sessions')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          duration_taken_seconds: durationSeconds,
        } as any)
        .eq('id', sessionId);

      if (error) {
        console.error('[ExamSessionService] Failed to submit session:', error);
        return { success: false, error: error.message };
      }

      console.log('[ExamSessionService] Session submitted:', sessionId);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSessionService] Unexpected error submitting session:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Flag a session for review
   */
  static async flag(sessionId: string): Promise<{ success: boolean; error?: string }> {
    return this.update(sessionId, { status: 'flagged' });
  }

  /**
   * Invalidate a session
   */
  static async invalidate(sessionId: string): Promise<{ success: boolean; error?: string }> {
    return this.update(sessionId, { status: 'invalidated' });
  }

  /**
   * Get all sessions for a student
   */
  static async getByStudent(studentId: string): Promise<{ success: boolean; sessions?: ExamSession[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ExamSessionService] Failed to fetch student sessions:', error);
        return { success: false, error: error.message };
      }

      return { success: true, sessions: data as ExamSession[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSessionService] Unexpected error fetching sessions:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get all sessions for an exam (instructor view) with student and cheating data
   */
  static async getByExam(examId: string): Promise<{ success: boolean; summaries?: ExamSessionSummary[]; error?: string }> {
    try {
      // Fetch sessions with joined data
      const { data: sessions, error: sessionError } = await supabase
        .from('exam_sessions')
        .select(`
          *,
          users!exam_sessions_student_id_fkey (full_name, email),
          exams!exam_sessions_exam_id_fkey (title, duration_minutes),
          cheating_scores (overall_score, risk_level, total_violations)
        `)
        .eq('exam_id', examId)
        .order('created_at', { ascending: false });

      if (sessionError) {
        console.error('[ExamSessionService] Failed to fetch exam sessions:', sessionError);
        return { success: false, error: sessionError.message };
      }

      // Transform into summary objects
      const summaries: ExamSessionSummary[] = (sessions as any[]).map((row) => ({
        session_id: row.id,
        student_id: row.student_id,
        student_name: row.users?.full_name ?? 'Unknown',
        student_email: row.users?.email ?? '',
        exam_id: row.exam_id,
        exam_title: row.exams?.title ?? 'Unknown Exam',
        status: row.status as ExamSessionStatus,
        started_at: row.started_at,
        submitted_at: row.submitted_at,
        duration_taken_seconds: row.duration_taken_seconds,
        duration_minutes: row.exams?.duration_minutes ?? 0,
        exam_score: null, // Will be populated when grading is implemented
        exam_percentage: null,
        violation_count: row.cheating_scores?.total_violations ?? 0,
        cheating_score: row.cheating_scores?.overall_score ?? null,
        risk_level: row.cheating_scores?.risk_level ?? null,
        liveness_check_passed: row.liveness_check_passed,
      }));

      return { success: true, summaries };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSessionService] Unexpected error fetching exam sessions:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get active (in_progress) session for a student and exam
   */
  static async getActiveSession(studentId: string, examId: string): Promise<{ success: boolean; session?: ExamSession; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('student_id', studentId)
        .eq('exam_id', examId)
        .eq('status', 'in_progress')
        .maybeSingle();

      if (error) {
        console.error('[ExamSessionService] Failed to fetch active session:', error);
        return { success: false, error: error.message };
      }

      return { success: true, session: data as ExamSession | undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSessionService] Unexpected error fetching active session:', err);
      return { success: false, error: message };
    }
  }
}
