import { supabase } from '../lib/supabase/client';

interface Exam {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  duration_minutes: number;
  passing_score: number | null;
  status: 'draft' | 'published' | 'completed' | 'archived';
  instructor_id: string;
  created_at: string;
  published_at: string | null;
}

export class ExamService {
  static async getPublishedExams(): Promise<{ success: boolean; exams?: Exam[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ExamService] Failed to fetch published exams:', error);
        return { success: false, error: error.message };
      }

      return { success: true, exams: data as Exam[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamService] Unexpected error fetching exams:', err);
      return { success: false, error: message };
    }
  }

  static async getExamById(examId: string): Promise<{ success: boolean; exam?: Exam; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (error) {
        console.error('[ExamService] Failed to fetch exam:', error);
        return { success: false, error: error.message };
      }

      return { success: true, exam: data as Exam };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamService] Unexpected error fetching exam:', err);
      return { success: false, error: message };
    }
  }
}
