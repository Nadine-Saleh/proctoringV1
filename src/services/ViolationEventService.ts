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
  if (error) return { data: null, error: error.message };
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
      severity: typeof input.severity === 'number' ? input.severity : 10,
      client_captured_at: input.client_captured_at,
      metadata: (input.metadata ?? {}) as Record<string, unknown>,
    }));

    const { data, error } = await callRecordBatch(sessionId, events);

    if (error || !data) {
      // Persist to IndexedDB for later replay
      for (const ev of events) {
        await idbEnqueue({ sessionId, event: ev }).catch(() => {});
      }
      return { success: false, error: error ?? 'No data returned' };
    }

    return { success: true, events: [], batchResponse: data };
  }

  /**
   * Submit a batch via the RPC and return the full response (score, thresholds, alerts).
   * Used by useViolationTracker to update CheatingScoreTracker.
   */
  static async submitBatch(
    sessionId: string,
    events: BatchEvent[],
    onSuccess?: (res: RecordViolationBatchResponse) => void,
    onOffline?: () => void
  ): Promise<RecordViolationBatchResponse | null> {
    if (!sessionId || events.length === 0) return null;

    const { data, error } = await callRecordBatch(sessionId, events);

    if (error || !data) {
      for (const ev of events) {
        await idbEnqueue({ sessionId, event: ev }).catch(() => {});
      }
      onOffline?.();
      return null;
    }

    onSuccess?.(data);
    return data;
  }

  /**
   * Drain IndexedDB offline queue, grouping by sessionId and replaying via RPC.
   * Call this on reconnect.
   */
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

    // Group by sessionId
    const bySession = new Map<string, Array<{ key: IDBValidKey; event: BatchEvent }>>();
    for (const { key, item } of pending) {
      const arr = bySession.get(item.sessionId) ?? [];
      arr.push({ key, event: item.event });
      bySession.set(item.sessionId, arr);
    }

    for (const [sessionId, entries] of bySession) {
      const events = entries.map(e => e.event);
      const chunks: BatchEvent[][] = [];
      for (let i = 0; i < events.length; i += 50) chunks.push(events.slice(i, i + 50));

      for (const chunk of chunks) {
        const { data, error } = await callRecordBatch(sessionId, chunk);
        if (!error && data) {
          // Delete successfully replayed events from IDB
          for (const { key } of entries.slice(0, chunk.length)) {
            await idbDelete(key).catch(() => {});
          }
          onSuccess?.(data);
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
      return { success: true, events: data as ViolationEvent[] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async getByExam(examId: string): Promise<{ success: boolean; events?: ViolationEvent[]; error?: string }> {
    try {
      const examUuid = ensureUuid(examId, 'exam');
      const { data, error } = await supabase
        .from('violation_events')
        .select('*')
        .eq('exam_id', examUuid)
        .order('occurred_at', { ascending: false });

      if (error) return { success: false, error: error.message };
      return { success: true, events: data as ViolationEvent[] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async getByStudent(studentId: string): Promise<{ success: boolean; events?: ViolationEvent[]; error?: string }> {
    try {
      const studentUuid = ensureUuid(studentId, 'student');
      const { data, error } = await supabase
        .from('violation_events')
        .select('*')
        .eq('student_id', studentUuid)
        .order('occurred_at', { ascending: false });

      if (error) return { success: false, error: error.message };
      return { success: true, events: data as ViolationEvent[] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async update(eventId: string, input: UpdateViolationEventInput): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('violation_events')
        .update(input as any)
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
        .select('violation_type, severity, occurred_at')
        .eq('session_id', sessionId);

      if (error) return { success: false, error: error.message };

      const typeMap = new Map<string, ViolationSummary>();
      for (const event of data as { violation_type: string; severity: number; occurred_at: string }[]) {
        const existing = typeMap.get(event.violation_type);
        if (existing) {
          existing.count++;
          if (new Date(event.occurred_at) > new Date(existing.last_occurrence)) {
            existing.last_occurrence = event.occurred_at;
          }
          if (event.severity > (existing.severity as unknown as number)) {
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
      for (const event of data as { severity: number }[]) {
        const label = event.severity >= 20 ? 'critical' : event.severity >= 15 ? 'high' : event.severity >= 10 ? 'medium' : 'low';
        counts[label] = (counts[label] || 0) + 1;
      }
      return { success: true, counts };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
