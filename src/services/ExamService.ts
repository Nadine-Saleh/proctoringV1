import { supabase } from '../lib/supabase/client';
import type { ProctoringPolicy } from '../types/examSession';

export interface Exam {
  id: string;
  instructor_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  duration?: number;
  status: 'draft' | 'published' | 'closed';
  proctoring_policy: ProctoringPolicy;
  access_code: string | null;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateExamInput {
  title: string;
  starts_at: string;
  duration_minutes: number;
  description?: string;
  proctoring_policy?: ProctoringPolicy;
}

interface UpdateExamInput {
  title?: string;
  description?: string;
  starts_at?: string;
  duration_minutes?: number;
  proctoring_policy?: ProctoringPolicy;
}

export class ExamService {
  /**
   * Create a new exam in draft status.
   */
  static async createExam(
    input: CreateExamInput
  ): Promise<{ success: boolean; examId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('create_exam', {
        p_title: input.title,
        p_starts_at: input.starts_at,
        p_duration_minutes: input.duration_minutes,
        p_proctoring_policy: input.proctoring_policy || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, examId: data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Update exam details (draft only).
   */
  static async updateExam(
    examId: string,
    input: UpdateExamInput
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('update_exam', {
        p_exam_id: examId,
        p_title: input.title || null,
        p_starts_at: input.starts_at || null,
        p_duration_minutes: input.duration_minutes || null,
        p_proctoring_policy: input.proctoring_policy || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Publish an exam (generates unique access code).
   */
  static async publishExam(
    examId: string
  ): Promise<{ success: boolean; accessCode?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('publish_exam', {
        p_exam_id: examId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, accessCode: data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Close an exam (invalidates access code).
   */
  static async closeExam(examId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('close_exam', {
        p_exam_id: examId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get exam details by ID.
   */
  static async getExamById(examId: string): Promise<{ success: boolean; exam?: Exam; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, exam: data as Exam };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * List all exams for the current instructor.
   */
  static async listMyExams(): Promise<{ success: boolean; exams?: Exam[]; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('list_my_exams');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, exams: data as Exam[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Save questions for an exam (replaces existing questions).
   */
  static async saveQuestions(
    examId: string,
    questions: Array<{
      question_text: string;
      options: string[];
      correct_answer_index: number;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: deleteError } = await supabase
        .from('exam_questions')
        .delete()
        .eq('exam_id', examId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      const rows = questions.map((q, idx) => ({
        exam_id: examId,
        question_text: q.question_text,
        options: q.options,
        correct_answer: String(q.correct_answer_index),
        position: idx + 1,
      }));

      const { error } = await supabase.from('exam_questions').insert(rows);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get questions for an exam.
   */
  static async getQuestions(examId: string) {
    try {
      const { data, error } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', examId)
        .order('position', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, questions: data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}
