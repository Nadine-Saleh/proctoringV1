// ============================================
// Phase 3: useViolationTracker Hook
// ============================================
// Manages violation event tracking with batch submission and offline queue
// Responsibility: Collect violations, batch send to server, handle failures

import { useState, useCallback, useRef, useEffect } from 'react';
import { ViolationEventService } from '../services/ViolationEventService';
import { OfflineQueue } from '../utils/OfflineQueue';
import type {
  ViolationEvent,
  CreateViolationEventInput,
  ViolationSummary,
} from '../types/examSession';

interface UseViolationTrackerReturn {
  // Local violation state
  violations: ViolationEvent[];
  violationCount: number;
  severityCounts: Record<string, number>;

  // Actions
  recordViolation: (input: Omit<CreateViolationEventInput, 'session_id' | 'exam_id' | 'student_id'>) => void;
  syncViolations: () => Promise<void>;

  // Summary
  summary: ViolationSummary[] | null;
  loadSummary: () => Promise<void>;

  // Sync state
  isSyncing: boolean;
  syncError: string | null;
  queuedCount: number;

  // Reset
  reset: () => void;
}

// Batch configuration
const BATCH_INTERVAL_MS = 5000; // Send batch every 5 seconds
const MAX_BATCH_SIZE = 20; // Send max 20 violations at once

export function useViolationTracker(sessionId?: string, examId?: string, studentId?: string): UseViolationTrackerReturn {
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [violationCount, setViolationCount] = useState(0);
  const [severityCounts, setSeverityCounts] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<ViolationSummary[] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);

  // Pending violations waiting for batch send
  const pendingRef = useRef<CreateViolationEventInput[]>([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Offline queue for failed submissions
  const queueRef = useRef<OfflineQueue<CreateViolationEventInput> | null>(null);

  // Initialize offline queue
  useEffect(() => {
    if (!queueRef.current) {
      queueRef.current = new OfflineQueue<CreateViolationEventInput>(
        async (data) => {
          const result = await ViolationEventService.create(data);
          return { success: result.success, error: result.error };
        }
      );

      // Start queue processor
      queueRef.current.start(15000); // Retry every 15 seconds

      setQueuedCount(queueRef.current.size);
    }

    return () => {
      // Stop queue on unmount
      if (queueRef.current) {
        queueRef.current.stop();
      }
    };
  }, []);

  // Update counts when violations change
  useEffect(() => {
    setViolationCount(violations.length);

    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const v of violations) {
      counts[v.severity] = (counts[v.severity] || 0) + 1;
    }
    setSeverityCounts(counts);
  }, [violations]);

  /**
   * Record a violation (adds to local state and batch queue)
   */
  const recordViolation = useCallback((
    input: Omit<CreateViolationEventInput, 'session_id' | 'exam_id' | 'student_id'>
  ) => {
    if (!sessionId || !examId || !studentId) {
      console.warn('[useViolationTracker] Cannot record violation: missing session/exam/student ID');
      return;
    }

    // Create full input
    const fullInput: CreateViolationEventInput = {
      session_id: sessionId,
      exam_id: examId,
      student_id: studentId,
      ...input,
    };

    // Add to local state immediately (for UI feedback)
    const localEvent: ViolationEvent = {
      id: input.violation_type + '_' + Date.now(),
      ...fullInput,
      severity: input.severity ?? 'medium',
      weight: input.weight ?? 1,
      description: input.description ?? null,
      duration_ms: input.duration_ms ?? null,
      metadata: input.metadata ?? {},
      is_reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      created_at: new Date().toISOString(),
    };

    setViolations(prev => [...prev, localEvent].slice(-100)); // Keep last 100

    // Add to pending batch
    pendingRef.current.push(fullInput);

    // Schedule batch send
    scheduleBatchSend();

    console.log(`[useViolationTracker] Violation recorded: ${input.violation_type} (${input.severity})`);
  }, [sessionId, examId, studentId]);

  /**
   * Schedule batch send of pending violations
   */
  const scheduleBatchSend = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    batchTimeoutRef.current = setTimeout(() => {
      syncViolations();
    }, BATCH_INTERVAL_MS);
  }, []);

  /**
   * Send pending violations to server
   */
  const syncViolations = useCallback(async () => {
    if (pendingRef.current.length === 0) {
      return;
    }

    if (!sessionId) {
      console.warn('[useViolationTracker] Cannot sync: no session ID');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    // Get batch to send
    const batch = pendingRef.current.splice(0, MAX_BATCH_SIZE);
    pendingRef.current = [];

    try {
      const result = await ViolationEventService.createBatch(batch);

      if (result.success && result.events) {
        // Replace local events with server events (have real IDs)
        setViolations(prev => {
          const serverIds = new Set(result.events!.map(e => e.violation_type + '_' + new Date(e.occurred_at).getTime()));
          return prev.filter(v => !serverIds.has(v.violation_type + '_' + new Date(v.occurred_at).getTime()))
            .concat(result.events!);
        });

        console.log(`[useViolationTracker] Synced ${result.events.length} violations`);
      } else {
        // Add failed items to offline queue
        if (queueRef.current) {
          for (const item of batch) {
            queueRef.current.enqueue(item);
          }
          setQueuedCount(queueRef.current.size);
        }

        setSyncError(result.error ?? 'Failed to sync violations');
        console.error('[useViolationTracker] Sync failed:', result.error);
      }
    } catch (err) {
      // Add to offline queue on error
      if (queueRef.current) {
        for (const item of batch) {
          queueRef.current.enqueue(item);
        }
        setQueuedCount(queueRef.current.size);
      }

      const message = err instanceof Error ? err.message : 'Unknown error';
      setSyncError(message);
      console.error('[useViolationTracker] Sync error:', err);
    } finally {
      setIsSyncing(false);

      // If there are more pending items, schedule another sync
      if (pendingRef.current.length > 0) {
        scheduleBatchSend();
      }
    }
  }, [sessionId, scheduleBatchSend]);

  /**
   * Load violation summary for the session
   */
  const loadSummary = useCallback(async () => {
    if (!sessionId) return;

    try {
      const result = await ViolationEventService.getSummaryBySession(sessionId);
      if (result.success && result.summaries) {
        setSummary(result.summaries);
      }
    } catch (err) {
      console.error('[useViolationTracker] Failed to load summary:', err);
    }
  }, [sessionId]);

  /**
   * Reset all violation state
   */
  const reset = useCallback(() => {
    setViolations([]);
    setViolationCount(0);
    setSeverityCounts({});
    setSummary(null);
    setSyncError(null);
    pendingRef.current = [];

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, []);

  // Final sync on unmount
  useEffect(() => {
    return () => {
      if (pendingRef.current.length > 0) {
        syncViolations();
      }
    };
  }, [syncViolations]);

  return {
    // Local violation state
    violations,
    violationCount,
    severityCounts,

    // Actions
    recordViolation,
    syncViolations,

    // Summary
    summary,
    loadSummary,

    // Sync state
    isSyncing,
    syncError,
    queuedCount,

    // Reset
    reset,
  };
}
