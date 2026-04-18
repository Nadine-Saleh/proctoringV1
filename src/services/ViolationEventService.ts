// ============================================
// Phase 3: Violation Event Service
// ============================================
// Handles all database operations for violation events
// Responsibility: CRUD operations for violation_events table

import { supabase } from '../lib/supabase/client';
import { ensureUuid } from '../utils/uuid';
import type {
  ViolationEvent,
  CreateViolationEventInput,
  UpdateViolationEventInput,
  ViolationSummary,
} from '../types/examSession';

// Default weights for violation types
const DEFAULT_WEIGHTS: Record<string, number> = {
  // Gaze violations
  'gaze_looking_away': 2,
  'gaze_sustained_away': 5,
  'gaze_prolonged_away': 8,
  // Eye behavior
  'eye_closure': 6,
  'excessive_blinking': 3,
  'rapid_eye_movement': 4,
  // Face detection
  'face_not_detected': 5,
  'multiple_faces': 10,
  'face_too_close': 3,
  'face_too_far': 3,
  // Tab/Window
  'tab_switch': 3,
  'tab_switch_prolonged': 7,
  'window_minimize': 5,
  // Head pose
  'head_pose_extreme': 6,
  'head_pose_moderate': 3,
  // Device/Environment
  'phone_detected': 10,
  'headphones_detected': 8,
  // Pattern-based
  'answer_pattern_suspicious': 7,
  'ip_address_change': 8,
};

export class ViolationEventService {
  /**
   * Insert a single violation event
   */
  static async create(input: CreateViolationEventInput): Promise<{ success: boolean; event?: ViolationEvent; error?: string }> {
    try {
      const examUuid = ensureUuid(input.exam_id as string, 'exam');
      const studentUuid = ensureUuid(input.student_id as string, 'student');

      const { data, error } = await supabase
        .from('violation_events')
        .insert({
          session_id: input.session_id,
          client_event_id: input.client_event_id,
          type: input.type,
          severity: typeof input.severity === 'number' ? input.severity : 10, // Phase 2 uses smallint
          client_captured_at: input.client_captured_at,
          metadata: input.metadata ?? {},
          evidence_artifact_id: input.evidence_artifact_id ?? null,
          evidence_image: input.evidence_image ?? null,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[ViolationEventService] Failed to create event:', error);
        return { success: false, error: error.message };
      }

      return { success: true, event: data as ViolationEvent };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ViolationEventService] Unexpected error creating event:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Batch insert multiple violation events
   */
  static async createBatch(inputs: CreateViolationEventInput[]): Promise<{ success: boolean; events?: ViolationEvent[]; error?: string }> {
    try {
      const records = inputs.map(input => ({
        session_id: input.session_id,
        client_event_id: input.client_event_id,
        type: input.type,
        severity: typeof input.severity === 'number' ? input.severity : 10,
        client_captured_at: input.client_captured_at,
        metadata: input.metadata ?? {},
        evidence_artifact_id: input.evidence_artifact_id ?? null,
        evidence_image: input.evidence_image ?? null,
      }));

      const { data, error } = await supabase
        .from('violation_events')
        .insert(records as any)
        .select();

      if (error) {
        console.error('[ViolationEventService] Failed to batch insert events:', error);
        return { success: false, error: error.message };
      }

      return { success: true, events: data as ViolationEvent[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ViolationEventService] Unexpected error batch inserting events:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get all violations for a session
   */
  static async getBySession(sessionId: string): Promise<{ success: boolean; events?: ViolationEvent[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('violation_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('client_captured_at', { ascending: true });

      if (error) {
        console.error('[ViolationEventService] Failed to fetch session violations:', error);
        return { success: false, error: error.message };
      }

      return { success: true, events: data as ViolationEvent[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ViolationEventService] Unexpected error fetching violations:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get violations for an exam (instructor view)
   */
  static async getByExam(examId: string): Promise<{ success: boolean; events?: ViolationEvent[]; error?: string }> {
    try {
      const examUuid = ensureUuid(examId, 'exam');
      const { data, error } = await supabase
        .from('violation_events')
        .select('*')
        .eq('exam_id', examUuid)
        .order('occurred_at', { ascending: false });

      if (error) {
        console.error('[ViolationEventService] Failed to fetch exam violations:', error);
        return { success: false, error: error.message };
      }

      return { success: true, events: data as ViolationEvent[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ViolationEventService] Unexpected error fetching exam violations:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get violations for a specific student
   */
  static async getByStudent(studentId: string): Promise<{ success: boolean; events?: ViolationEvent[]; error?: string }> {
    try {
      const studentUuid = ensureUuid(studentId, 'student');
      const { data, error } = await supabase
        .from('violation_events')
        .select('*')
        .eq('student_id', studentUuid)
        .order('occurred_at', { ascending: false });

      if (error) {
        console.error('[ViolationEventService] Failed to fetch student violations:', error);
        return { success: false, error: error.message };
      }

      return { success: true, events: data as ViolationEvent[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ViolationEventService] Unexpected error fetching student violations:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Update a violation event (for review)
   */
  static async update(eventId: string, input: UpdateViolationEventInput): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('violation_events')
        .update(input as any)
        .eq('id', eventId);

      if (error) {
        console.error('[ViolationEventService] Failed to update event:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ViolationEventService] Unexpected error updating event:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Get violation summary for a session (grouped by type)
   */
  static async getSummaryBySession(sessionId: string): Promise<{ success: boolean; summaries?: ViolationSummary[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('violation_events')
        .select('violation_type, severity, occurred_at')
        .eq('session_id', sessionId);

      if (error) {
        console.error('[ViolationEventService] Failed to fetch violation summary:', error);
        return { success: false, error: error.message };
      }

      // Group by violation type
      const typeMap = new Map<string, ViolationSummary>();

      for (const event of data as { violation_type: string; severity: string; occurred_at: string }[]) {
        const existing = typeMap.get(event.violation_type);

        if (existing) {
          existing.count++;
          if (new Date(event.occurred_at) > new Date(existing.last_occurrence)) {
            existing.last_occurrence = event.occurred_at;
          }
          // Upgrade severity if this event is more severe
          const severityOrder = ['low', 'medium', 'high', 'critical'];
          if (severityOrder.indexOf(event.severity) > severityOrder.indexOf(existing.severity)) {
            existing.severity = event.severity as any;
          }
        } else {
          typeMap.set(event.violation_type, {
            violation_type: event.violation_type as any,
            count: 1,
            severity: event.severity as any,
            first_occurrence: event.occurred_at,
            last_occurrence: event.occurred_at,
          });
        }
      }

      return { success: true, summaries: Array.from(typeMap.values()) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ViolationEventService] Unexpected error fetching summary:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Count violations by severity for a session
   */
  static async countBySeverity(sessionId: string): Promise<{ success: boolean; counts?: Record<string, number>; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('violation_events')
        .select('severity')
        .eq('session_id', sessionId);

      if (error) {
        console.error('[ViolationEventService] Failed to count violations:', error);
        return { success: false, error: error.message };
      }

      const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
      for (const event of data as { severity: string }[]) {
        counts[event.severity] = (counts[event.severity] || 0) + 1;
      }

      return { success: true, counts };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ViolationEventService] Unexpected error counting violations:', err);
      return { success: false, error: message };
    }
  }
}
