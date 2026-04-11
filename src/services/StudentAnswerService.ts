// ============================================
// Phase 2: Student Answer Service
// ============================================
// Handles all database operations for student answers
// Responsibility: CRUD operations for student_answers table

import { supabase } from '../lib/supabase/client';
import type {
  StudentAnswer,
  CreateStudentAnswerInput,
  UpdateStudentAnswerInput,
} from '../types/examSession';

export class StudentAnswerService {
  /**
   * Create or update an answer (upsert)
   */
  static async upsert(input: CreateStudentAnswerInput): Promise<{ success: boolean; answer?: StudentAnswer; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('student_answers')
        .upsert({
          session_id: input.session_id,
          question_id: input.question_id,
          selected_answer: input.selected_answer ?? null,
          time_spent_seconds: input.time_spent_seconds ?? null,
          answer_order: input.answer_order ?? null,
        } as any, {
          onConflict: 'session_id,question_id',
        })
        .select()
        .single();

      if (error) {
        console.error('[StudentAnswerService] Failed to upsert answer:', error);
        return { success: false, error: error.message };
      }

      return { success: true, answer: data as StudentAnswer };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[StudentAnswerService] Unexpected error upserting answer:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Batch upsert multiple answers
   */
  static async upsertBatch(inputs: CreateStudentAnswerInput[]): Promise<{ success: boolean; answers?: StudentAnswer[]; error?: string }> {
    try {
      const records = inputs.map(input => ({
        session_id: input.session_id,
        question_id: input.question_id,
        selected_answer: input.selected_answer ?? null,
        time_spent_seconds: input.time_spent_seconds ?? null,
        answer_order: input.answer_order ?? null,
      }));

      const { data, error } = await supabase
        .from('student_answers')
        .upsert(records as any, {
          onConflict: 'session_id,question_id',
        })
        .select();

      if (error) {
        console.error('[StudentAnswerService] Failed to batch upsert answers:', error);
        return { success: false, error: error.message };
      }

      return { success: true, answers: data as StudentAnswer[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[StudentAnswerService] Unexpected error batch upserting answers:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get all answers for a session
   */
  static async getBySession(sessionId: string): Promise<{ success: boolean; answers?: StudentAnswer[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('student_answers')
        .select('*')
        .eq('session_id', sessionId)
        .order('answer_order', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('[StudentAnswerService] Failed to fetch answers:', error);
        return { success: false, error: error.message };
      }

      return { success: true, answers: data as StudentAnswer[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[StudentAnswerService] Unexpected error fetching answers:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Update a single answer
   */
  static async update(answerId: string, input: UpdateStudentAnswerInput): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('student_answers')
        .update(input as any)
        .eq('id', answerId);

      if (error) {
        console.error('[StudentAnswerService] Failed to update answer:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[StudentAnswerService] Unexpected error updating answer:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Update answer by session and question (convenience method)
   */
  static async updateByQuestion(
    sessionId: string,
    questionId: string,
    input: UpdateStudentAnswerInput
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('student_answers')
        .update(input as any)
        .eq('session_id', sessionId)
        .eq('question_id', questionId);

      if (error) {
        console.error('[StudentAnswerService] Failed to update answer by question:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[StudentAnswerService] Unexpected error updating answer:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Delete all answers for a session
   */
  static async deleteBySession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('student_answers')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        console.error('[StudentAnswerService] Failed to delete answers:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[StudentAnswerService] Unexpected error deleting answers:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get answer count for a session
   */
  static async countBySession(sessionId: string): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const { count, error } = await supabase
        .from('student_answers')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      if (error) {
        console.error('[StudentAnswerService] Failed to count answers:', error);
        return { success: false, error: error.message };
      }

      return { success: true, count: count ?? 0 };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[StudentAnswerService] Unexpected error counting answers:', err);
      return { success: false, error: message };
    }
  }
}
