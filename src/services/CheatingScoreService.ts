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

export interface RpcScoreResponse {
  live_cheating_score: number;
  crossed_warning_threshold: boolean;
  crossed_critical_threshold: boolean;
}

export interface ScoreState {
  score: number;
  warningThresholdCrossed: boolean;
  criticalThresholdCrossed: boolean;
}

type ScoreListener = (state: ScoreState) => void;

/**
 * Reactive score tracker for a single exam session.
 * Updated from record_violation_batch RPC responses (T055/T056).
 * Clients MUST NOT compute their own score — this is the authoritative source.
 */
export class CheatingScoreTracker {
  private _score = 0;
  private _warnCrossed = false;
  private _critCrossed = false;
  private _listeners = new Set<ScoreListener>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_policy: { warning_threshold: number; critical_threshold: number; [key: string]: unknown }) {}

  get liveScore(): number { return this._score; }
  get warningThresholdCrossed(): boolean { return this._warnCrossed; }
  get criticalThresholdCrossed(): boolean { return this._critCrossed; }

  updateFromRpcResponse(res: RpcScoreResponse): void {
    this._score = res.live_cheating_score;
    if (res.crossed_warning_threshold) this._warnCrossed = true;
    if (res.crossed_critical_threshold) this._critCrossed = true;

    const state: ScoreState = {
      score: this._score,
      warningThresholdCrossed: this._warnCrossed,
      criticalThresholdCrossed: this._critCrossed,
    };
    this._listeners.forEach(fn => fn(state));
  }

  subscribe(listener: ScoreListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  reset(): void {
    this._score = 0;
    this._warnCrossed = false;
    this._critCrossed = false;
  }
}

export class CheatingScoreService {
  static async calculateAndPersist(
    sessionId: string,
    windowMinutes: number = 5
  ): Promise<CheatingScoreResult> {
    try {
      const { error } = await supabase.rpc('calculate_cheating_score', {
        p_session_id: sessionId,
        p_window_minutes: windowMinutes,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: scoreRecord, error: fetchError } = await supabase
        .from('cheating_scores')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      return { success: true, score: scoreRecord as CheatingScore };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

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
        if (error.code === 'PGRST116') return { success: true, score: undefined };
        return { success: false, error: error.message };
      }

      return { success: true, score: data as CheatingScore };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

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

      if (error) return { success: false, error: error.message };
      return { success: true, scores: data as CheatingScore[] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

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

      if (error) return { success: false, error: error.message };
      return { success: true, sessions: data || [] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

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
