// ============================================
// Phase 3: Cheating Score Service
// ============================================
// Handles cheating score calculation and persistence via Supabase
// Responsibility: Calculate, store, and retrieve cheating scores

import { supabase } from '../lib/supabase/client';
import { ensureUuid } from '../utils/uuid';
import {
  calculateViolationScore,
  getRiskLevel,
  type ViolationEvent as ScorerViolationEvent,
} from '../utils/violationScorer';

export interface CheatingScore {
  id: string;
  session_id: string;
  exam_id: string;
  student_id: string;
  overall_score: number;
  gaze_score: number;
  face_detection_score: number;
  tab_switch_score: number;
  behavioral_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  total_violations: number;
  critical_violations: number;
  attention_score: number | null;
  avg_violation_interval_sec: number | null;
  calculated_at: string;
  last_violation_at: string | null;
  calculation_window_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface CheatingScoreResult {
  success: boolean;
  score?: CheatingScore;
  error?: string;
}

export class CheatingScoreService {
  /**
   * Calculate and persist cheating score for a session using database function
   */
  static async calculateAndPersist(
    sessionId: string,
    windowMinutes: number = 5
  ): Promise<CheatingScoreResult> {
    try {
      // Call database function to calculate score
      const { error } = await supabase.rpc('calculate_cheating_score', {
        p_session_id: sessionId,
        p_window_minutes: windowMinutes,
      });

      if (error) {
        console.error('[CheatingScoreService] Database function failed:', error);
        return { success: false, error: error.message };
      }

      // Fetch the full score record
      const { data: scoreRecord, error: fetchError } = await supabase
        .from('cheating_scores')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (fetchError) {
        console.error('[CheatingScoreService] Failed to fetch score record:', fetchError);
        return { success: false, error: fetchError.message };
      }

      return { success: true, score: scoreRecord as CheatingScore };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[CheatingScoreService] Unexpected error:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get cheating score for a session
   */
  static async getBySession(sessionId: string): Promise<{
    success: boolean;
    score?: CheatingScore;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('cheating_scores')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return { success: true, score: undefined };
        }
        console.error('[CheatingScoreService] Failed to fetch score:', error);
        return { success: false, error: error.message };
      }

      return { success: true, score: data as CheatingScore };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[CheatingScoreService] Unexpected error fetching score:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get cheating scores for an exam (all students)
   */
  static async getByExam(examId: string): Promise<{
    success: boolean;
    scores?: CheatingScore[];
    error?: string;
  }> {
    try {
      const examUuid = ensureUuid(examId, 'exam');
      const { data, error } = await supabase
        .from('cheating_scores')
        .select('*')
        .eq('exam_id', examUuid)
        .order('overall_score', { ascending: false });

      if (error) {
        console.error('[CheatingScoreService] Failed to fetch exam scores:', error);
        return { success: false, error: error.message };
      }

      return { success: true, scores: data as CheatingScore[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[CheatingScoreService] Unexpected error fetching exam scores:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get high-risk sessions for an exam
   */
  static async getHighRiskSessions(
    examId?: string,
    minutesAgo: number = 30
  ): Promise<{
    success: boolean;
    sessions?: Array<{
      session_id: string;
      student_id: string;
      student_name: string;
      student_email: string;
      exam_id: string;
      exam_title: string;
      overall_score: number;
      risk_level: string;
      total_violations: number;
      calculated_at: string;
      recent_violations: any[] | null;
    }>;
    error?: string;
  }> {
    try {
      const examUuid = examId ? ensureUuid(examId, 'exam') : null;
      const { data, error } = await supabase.rpc('get_high_risk_sessions', {
        p_exam_id: examUuid,
        p_minutes_ago: minutesAgo,
      });

      if (error) {
        console.error('[CheatingScoreService] Failed to fetch high-risk sessions:', error);
        return { success: false, error: error.message };
      }

      return { success: true, sessions: data || [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[CheatingScoreService] Unexpected error fetching high-risk sessions:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Calculate score client-side (for real-time updates without DB call)
   * This is useful for immediate UI feedback before persisting to DB
   */
  static calculateClientSide(violations: ScorerViolationEvent[]): {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    shouldAlert: boolean;
  } {
    const result = calculateViolationScore(violations);
    const riskInfo = getRiskLevel(result.score);

    return {
      score: result.score,
      level: result.level,
      shouldAlert: riskInfo.shouldAlert || result.level === 'high' || result.level === 'critical',
    };
  }
}
