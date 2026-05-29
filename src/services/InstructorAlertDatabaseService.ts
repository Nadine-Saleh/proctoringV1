// ============================================
// Phase 3: Instructor Alert Service
// ============================================
// Handles database operations for instructor alerts
// Responsibility: CRUD operations for instructor_alerts table

import { supabase } from '../lib/supabase/client';
import { ensureUuid } from '../utils/uuid';
import type { ViolationEvent } from '../utils/violationScorer';

export interface InstructorAlert {
  id: string;
  exam_id: string;
  session_id: string;
  student_id: string;
  alert_type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  cheating_score_at_time: number | null;
  title: string;
  message: string;
  violation_summary: Record<string, unknown> | null;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface CreateAlertInput {
  exam_id: string;
  session_id: string;
  student_id: string;
  alert_type?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  cheating_score_at_time?: number | null;
  title: string;
  message: string;
  violation_summary?: Record<string, unknown>;
}

export interface AlertWithStudentInfo {
  id: string;
  student_name: string;
  student_email: string;
  exam_id: string;
  session_id: string;
  student_id: string;
  priority: string;
  cheating_score_at_time: number | null;
  title: string;
  message: string;
  violation_summary: Record<string, unknown> | null;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
  recent_violations?: ViolationEvent[];
}

export class InstructorAlertDatabaseService {
  /**
   * Create a new instructor alert
   */
  static async create(input: CreateAlertInput): Promise<{ success: boolean; alertId?: string; error?: string }> {
    try {
      const examUuid = ensureUuid(input.exam_id, 'exam');
      const studentUuid = ensureUuid(input.student_id, 'student');
      
      const { data, error } = await supabase
        .rpc('create_instructor_alert', {
          p_exam_id: examUuid,
          p_session_id: input.session_id,
          p_student_id: studentUuid,
          p_alert_type: input.alert_type || 'cheating_risk',
          p_priority: input.priority || 'high',
          p_cheating_score_at_time: input.cheating_score_at_time || null,
          p_title: input.title,
          p_message: input.message,
          p_violation_summary: input.violation_summary || {},
        });

      if (error) {
        console.error('[InstructorAlertService] Failed to create alert:', error);
        return { success: false, error: error.message };
      }

      return { success: true, alertId: data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[InstructorAlertService] Unexpected error creating alert:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get unacknowledged alerts for an exam
   */
  static async getUnacknowledgedByExam(
    examId: string,
    limit: number = 50
  ): Promise<{ success: boolean; alerts?: AlertWithStudentInfo[]; error?: string }> {
    try {
      const examUuid = ensureUuid(examId, 'exam');
      const { data, error } = await supabase
        .from('instructor_alerts')
        .select(`
          *,
          users!instructor_alerts_student_id_fkey (full_name, email)
        `)
        .eq('exam_id', examUuid)
        .eq('is_acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[InstructorAlertService] Failed to fetch unacknowledged alerts:', error);
        return { success: false, error: error.message };
      }

      const alerts: AlertWithStudentInfo[] = (data as any[]).map((row) => ({
        id: row.id,
        student_name: row.users?.full_name || 'Unknown',
        student_email: row.users?.email || '',
        exam_id: row.exam_id,
        session_id: row.session_id,
        student_id: row.student_id,
        priority: row.priority,
        cheating_score_at_time: row.cheating_score_at_time,
        title: row.title,
        message: row.message,
        violation_summary: row.violation_summary,
        is_acknowledged: row.is_acknowledged,
        acknowledged_at: row.acknowledged_at,
        created_at: row.created_at,
      }));

      return { success: true, alerts };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[InstructorAlertService] Unexpected error fetching alerts:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get all alerts for an exam (including acknowledged)
   */
  static async getAllByExam(
    examId: string,
    limit: number = 100
  ): Promise<{ success: boolean; alerts?: AlertWithStudentInfo[]; error?: string }> {
    try {
      const examUuid = ensureUuid(examId, 'exam');
      const { data, error } = await supabase
        .from('instructor_alerts')
        .select(`
          *,
          users!instructor_alerts_student_id_fkey (full_name, email)
        `)
        .eq('exam_id', examUuid)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[InstructorAlertService] Failed to fetch all alerts:', error);
        return { success: false, error: error.message };
      }

      const alerts: AlertWithStudentInfo[] = (data as any[]).map((row) => ({
        id: row.id,
        student_name: row.users?.full_name || 'Unknown',
        student_email: row.users?.email || '',
        exam_id: row.exam_id,
        session_id: row.session_id,
        student_id: row.student_id,
        priority: row.priority,
        cheating_score_at_time: row.cheating_score_at_time,
        title: row.title,
        message: row.message,
        violation_summary: row.violation_summary,
        is_acknowledged: row.is_acknowledged,
        acknowledged_at: row.acknowledged_at,
        created_at: row.created_at,
      }));

      return { success: true, alerts };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[InstructorAlertService] Unexpected error fetching alerts:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Acknowledge an alert
   */
  static async acknowledge(
    alertId: string,
    instructorId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .rpc('acknowledge_instructor_alert', {
          p_alert_id: alertId,
          p_instructor_id: instructorId,
        });

      if (error) {
        console.error('[InstructorAlertService] Failed to acknowledge alert:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Alert not found or already acknowledged' };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[InstructorAlertService] Unexpected error acknowledging alert:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get alert count for an exam
   */
  static async countByExam(examId: string): Promise<{
    success: boolean;
    total?: number;
    unacknowledged?: number;
    critical?: number;
    high?: number;
    error?: string;
  }> {
    try {
      const examUuid = ensureUuid(examId, 'exam');
      const { data, error } = await supabase
        .from('instructor_alerts')
        .select('priority, is_acknowledged')
        .eq('exam_id', examUuid);

      if (error) {
        console.error('[InstructorAlertService] Failed to count alerts:', error);
        return { success: false, error: error.message };
      }

      const counts = {
        total: data.length,
        unacknowledged: 0,
        critical: 0,
        high: 0,
      };

      for (const alert of data as { priority: string; is_acknowledged: boolean }[]) {
        if (!alert.is_acknowledged) {
          counts.unacknowledged++;
        }
        if (alert.priority === 'critical') {
          counts.critical++;
        } else if (alert.priority === 'high') {
          counts.high++;
        }
      }

      return { success: true, ...counts };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[InstructorAlertService] Unexpected error counting alerts:', err);
      return { success: false, error: message };
    }
  }
}
