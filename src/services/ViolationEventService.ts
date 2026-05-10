import { supabase } from '../lib/supabase/client';
import { ensureUuid } from '../utils/uuid';
import type {
  ViolationEvent,
  CreateViolationEventInput,
  UpdateViolationEventInput,
  ViolationSummary,
} from '../types/examSession';
import type { RpcScoreResponse } from './CheatingScoreService';

export interface RecordViolationBatchResponse extends RpcScoreResponse {
  accepted: number;
  deduplicated: number;
  rejected: number;
  instructor_alert_raised: boolean;
}

interface PostgrestErrorLike {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface BatchEvent {
  client_event_id: string;
  type: string;
  severity: number;
  client_captured_at: string;
  metadata: Record<string, unknown>;
  evidence?: {
    captured: boolean;
    bucket_path: string;
    content_type: string;
    byte_length: number;
  };
}

// Normalize any severity value to an integer — the DB column is integer.
const toSafeSeverity = (value: any): number => {
  if (typeof value === 'number') return value;
  if (value === 'critical') return 20;
  if (value === 'high') return 15;
  if (value === 'medium') return 10;
  return 5; // 'low' or unknown
};

const IDB_DB_NAME = 'proctoring_offline_queue';
const IDB_STORE   = 'violation_events';

async function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE, { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbEnqueue(item: { sessionId: string; event: BatchEvent }): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbDrain(): Promise<Array<{ key: IDBValidKey; item: { sessionId: string; event: BatchEvent } }>> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const result: Array<{ key: IDBValidKey; item: { sessionId: string; event: BatchEvent } }> = [];
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).openCursor();
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        result.push({ key: cursor.key, item: cursor.value });
        cursor.continue();
      } else {
        db.close();
        resolve(result);
      }
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function idbDelete(key: IDBValidKey): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function callRecordBatch(
  sessionId: string,
  events: BatchEvent[]
): Promise<{ data: RecordViolationBatchResponse | null; error: string | null }> {
  const { data, error } = await supabase.rpc('record_violation_batch', {
    p_session_id: sessionId,
    p_events: events,
  });
  if (error) {
    const typedError = error as PostgrestErrorLike;
    // Inline the message so it's visible in the console without expanding the object.
    // `code` is the Postgres error code; `details`/`hint` contain the constraint or column name.
    console.error(
      `[ViolationEventService] record_violation_batch failed: ${typedError.message}` +
        ` | code=${typedError.code ?? 'n/a'}` +
        ` | details=${typedError.details ?? 'n/a'}` +
        ` | hint=${typedError.hint ?? 'n/a'}` +
        ` | session=${sessionId}` +
        ` | events=${events.length}` +
        ` | sampleType=${events[0]?.type ?? 'n/a'}` +
        ` | sampleSeverity=${events[0]?.severity ?? 'n/a'}`
    );
    return { data: null, error: typedError.message };
  }
  return { data: data as RecordViolationBatchResponse, error: null };
}

export class ViolationEventService {
  static async create(input: CreateViolationEventInput): Promise<{ success: boolean; event?: ViolationEvent; error?: string }> {
    const result = await this.createBatch([input]);
    if (result.success && result.events?.length) {
      return { success: true, event: result.events[0] };
    }
    return { success: false, error: result.error };
  }

  static async createBatch(
    inputs: CreateViolationEventInput[]
  ): Promise<{ success: boolean; events?: ViolationEvent[]; error?: string; batchResponse?: RecordViolationBatchResponse }> {
    if (inputs.length === 0) return { success: true, events: [] };

    const sessionId = inputs[0].session_id;

    const events: BatchEvent[] = inputs.map(input => ({
      client_event_id: input.client_event_id,
      type: input.type as string,
      severity: toSafeSeverity(input.severity),
      client_captured_at: input.client_captured_at,
      metadata: (input.metadata ?? {}) as Record<string, unknown>,
    }));

    const { data, error } = await callRecordBatch(sessionId, events);

    if (error || !data) {
      for (const ev of events) {
        await idbEnqueue({ sessionId, event: ev }).catch(() => {});
      }
      return { success: false, error: error ?? 'No data returned' };
    }

    return { success: true, events: [], batchResponse: data };
  }

  static async submitBatch(
    sessionId: string,
    events: BatchEvent[],
    onSuccess?: (res: RecordViolationBatchResponse) => void,
    onOffline?: () => void
  ): Promise<RecordViolationBatchResponse | null> {
    if (!sessionId || events.length === 0) return null;

    const safeEvents = events.map(e => ({
      ...e,
      severity: toSafeSeverity(e.severity)
    }));

    const { data, error } = await callRecordBatch(sessionId, safeEvents);

    if (error || !data) {
      for (const ev of safeEvents) {
        await idbEnqueue({ sessionId, event: ev }).catch(() => {});
      }
      onOffline?.();
      return null;
    }

    onSuccess?.(data);
    return data;
  }

  static async drainOfflineQueue(
    onSuccess?: (res: RecordViolationBatchResponse) => void
  ): Promise<void> {
    let pending: Array<{ key: IDBValidKey; item: { sessionId: string; event: BatchEvent } }>;
    try {
      pending = await idbDrain();
    } catch {
      return;
    }

    if (pending.length === 0) return;

    const bySession = new Map<string, Array<{ key: IDBValidKey; event: BatchEvent }>>();
    for (const { key, item } of pending) {
      const arr = bySession.get(item.sessionId) ?? [];
      arr.push({ key, event: item.event });
      bySession.set(item.sessionId, arr);
    }

    const PERMANENT_ERRORS = new Set([
      'session_not_found',
      'session_not_owned',
      'session_not_in_progress',
      'exam_window_closed',
      'evidence_policy_violation',
    ]);

    for (const [sessionId, entries] of bySession) {
      const fixedEntries = entries.map(e => ({
        key: e.key,
        event: { ...e.event, severity: toSafeSeverity(e.event.severity) }
      }));
      
      const events = fixedEntries.map(e => e.event);
      const chunks: BatchEvent[][] = [];
      for (let i = 0; i < events.length; i += 50) chunks.push(events.slice(i, i + 50));

      let offset = 0;
      for (const chunk of chunks) {
        const keysForChunk = fixedEntries.slice(offset, offset + chunk.length).map(e => e.key);
        offset += chunk.length;

        const { data, error } = await callRecordBatch(sessionId, chunk);

        if (!error && data) {
          for (const key of keysForChunk) await idbDelete(key).catch(() => {});
          onSuccess?.(data);
        } else if (error && PERMANENT_ERRORS.has(error)) {
          console.warn(
            `[ViolationEventService] Dropping ${chunk.length} queued events for session ${sessionId}: ${error}`
          );
          for (const key of keysForChunk) await idbDelete(key).catch(() => {});
        }
      }
    }
  }

  static async getBySession(sessionId: string): Promise<{ success: boolean; events?: ViolationEvent[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('violation_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('client_captured_at', { ascending: true });

      if (error) return { success: false, error: error.message };
      return { success: true, events: (data as ViolationEvent[]).map(normalizeViolationEvent) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async getByExam(examId: string): Promise<{ success: boolean; events?: ViolationEvent[]; error?: string }> {
    try {
      const examUuid = ensureUuid(examId, 'exam');
      const { data: sessions, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('id')
        .eq('exam_id', examUuid);

      if (sessionError) return { success: false, error: sessionError.message };

      const sessionIds = (sessions ?? []).map(session => session.id);
      if (sessionIds.length === 0) return { success: true, events: [] };

      const { data, error } = await supabase
        .from('violation_events')
        .select('*')
        .in('session_id', sessionIds)
        .order('client_captured_at', { ascending: false });

      if (error) return { success: false, error: error.message };
      return { success: true, events: (data as ViolationEvent[]).map(normalizeViolationEvent) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async getByStudent(studentId: string): Promise<{ success: boolean; events?: ViolationEvent[]; error?: string }> {
    try {
      const studentUuid = ensureUuid(studentId, 'student');
      const { data: sessions, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('id')
        .eq('student_id', studentUuid);

      if (sessionError) return { success: false, error: sessionError.message };

      const sessionIds = (sessions ?? []).map(session => session.id);
      if (sessionIds.length === 0) return { success: true, events: [] };

      const { data, error } = await supabase
        .from('violation_events')
        .select('*')
        .in('session_id', sessionIds)
        .order('client_captured_at', { ascending: false });

      if (error) return { success: false, error: error.message };
      return { success: true, events: (data as ViolationEvent[]).map(normalizeViolationEvent) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async update(eventId: string, input: UpdateViolationEventInput): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('violation_events')
        .update(input)
        .eq('id', eventId);

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async getSummaryBySession(sessionId: string): Promise<{ success: boolean; summaries?: ViolationSummary[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('violation_events')
        .select('type, violation_type, severity, client_captured_at, occurred_at')
        .eq('session_id', sessionId);

      if (error) return { success: false, error: error.message };

      const typeMap = new Map<string, ViolationSummary>();
      for (const event of data as Array<{
        type: string | null;
        violation_type: string | null;
        severity: number | string;
        client_captured_at: string | null;
        occurred_at: string | null;
      }>) {
        const violationType = event.type ?? event.violation_type;
        const occurredAt = event.client_captured_at ?? event.occurred_at;
        if (!violationType || !occurredAt) continue;

        const existing = typeMap.get(violationType);
        if (existing) {
          existing.count++;
          if (new Date(occurredAt) > new Date(existing.last_occurrence)) {
            existing.last_occurrence = occurredAt;
          }
          // Handle both number and string severity for display
          const sevNum = typeof event.severity === 'string' 
            ? (event.severity === 'critical' ? 20 : event.severity === 'high' ? 15 : event.severity === 'medium' ? 10 : 5)
            : event.severity;
          if (sevNum > existing.severity) {
            existing.severity = sevNum;
          }
        } else {
          const sevNum = typeof event.severity === 'string' 
            ? (event.severity === 'critical' ? 20 : event.severity === 'high' ? 15 : event.severity === 'medium' ? 10 : 5)
            : event.severity;
          typeMap.set(violationType, {
            violation_type: violationType as ViolationSummary['violation_type'],
            count: 1,
            severity: sevNum,
            first_occurrence: occurredAt,
            last_occurrence: occurredAt,
          });
        }
      }

      return { success: true, summaries: Array.from(typeMap.values()) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async reviewViolation(
    violationId: string,
    isReviewed: boolean,
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('review_violation', {
        p_violation_id: violationId,
        p_is_reviewed: isReviewed,
        p_note: note ?? null,
      });
      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Violation not found' };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async overrideSubmissionScore(
    sessionId: string,
    overrideScore: number | null,
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('override_submission_score', {
        p_session_id: sessionId,
        p_override_score: overrideScore,
        p_note: note ?? null,
      });
      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Submission not found' };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async countBySeverity(sessionId: string): Promise<{ success: boolean; counts?: Record<string, number>; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('violation_events')
        .select('severity')
        .eq('session_id', sessionId);

      if (error) return { success: false, error: error.message };

      const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
      for (const event of data as { severity: number | string }[]) {
        let label: string;
        if (typeof event.severity === 'string') {
          label = event.severity;
        } else {
          label = event.severity >= 20 ? 'critical' : event.severity >= 15 ? 'high' : event.severity >= 10 ? 'medium' : 'low';
        }
        if (label in counts) {
          counts[label] = (counts[label] || 0) + 1;
        }
      }
      return { success: true, counts };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}

function normalizeViolationEvent(event: ViolationEvent): ViolationEvent {
  return {
    ...event,
    type: event.type ?? event.violation_type,
    violation_type: event.violation_type ?? event.type,
    client_captured_at: event.client_captured_at ?? event.occurred_at,
    occurred_at: event.occurred_at ?? event.client_captured_at,
    evidence_image: event.evidence_image ?? null,
    description: event.description ?? '',
  };
}