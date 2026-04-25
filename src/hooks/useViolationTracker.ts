import { useState, useCallback, useRef, useEffect } from 'react';
import { ViolationEventService } from '../services/ViolationEventService';
import { CheatingScoreTracker } from '../services/CheatingScoreService';
import { generateClientEventId } from '../utils/idempotency';
import type {
  ViolationEvent,
  CreateViolationEventInput,
  ViolationSummary,
} from '../types/examSession';

interface UseViolationTrackerReturn {
  violations: ViolationEvent[];
  violationCount: number;
  severityCounts: Record<string, number>;
  liveScore: number;
  warningThresholdCrossed: boolean;
  criticalThresholdCrossed: boolean;
  recordViolation: (input: Omit<CreateViolationEventInput, 'session_id' | 'exam_id' | 'student_id'>) => void;
  syncViolations: () => Promise<void>;
  summary: ViolationSummary[] | null;
  loadSummary: () => Promise<void>;
  isSyncing: boolean;
  syncError: string | null;
  queuedCount: number;
  reset: () => void;
}

const BATCH_INTERVAL_MS = 2000;
const MAX_BATCH_SIZE = 50;

export function useViolationTracker(
  sessionId?: string,
  examId?: string,
  studentId?: string,
  scoreTracker?: CheatingScoreTracker
): UseViolationTrackerReturn {
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [violationCount, setViolationCount] = useState(0);
  const [severityCounts, setSeverityCounts] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<ViolationSummary[] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [liveScore, setLiveScore] = useState(0);
  const [warningThresholdCrossed, setWarningThresholdCrossed] = useState(false);
  const [criticalThresholdCrossed, setCriticalThresholdCrossed] = useState(false);

  const pendingRef = useRef<CreateViolationEventInput[]>([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to score tracker updates
  useEffect(() => {
    if (!scoreTracker) return;
    const unsub = scoreTracker.subscribe(state => {
      setLiveScore(state.score);
      setWarningThresholdCrossed(state.warningThresholdCrossed);
      setCriticalThresholdCrossed(state.criticalThresholdCrossed);
    });
    return unsub;
  }, [scoreTracker]);

  // Drain offline queue on mount
  useEffect(() => {
    ViolationEventService.drainOfflineQueue(res => {
      if (scoreTracker) scoreTracker.updateFromRpcResponse(res);
    }).catch(() => {});
  }, [scoreTracker]);

  // Update counts when violations change
  useEffect(() => {
    setViolationCount(violations.length);
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const v of violations) {
      const label =
        typeof v.severity === 'number'
          ? v.severity >= 20 ? 'critical' : v.severity >= 15 ? 'high' : v.severity >= 10 ? 'medium' : 'low'
          : String(v.severity);
      counts[label] = (counts[label] || 0) + 1;
    }
    setSeverityCounts(counts);
  }, [violations]);

  const recordViolation = useCallback((
    input: Omit<CreateViolationEventInput, 'session_id' | 'exam_id' | 'student_id'>
  ) => {
    if (!sessionId || !examId || !studentId) {
      console.warn('[useViolationTracker] Cannot record violation: missing session/exam/student ID');
      return;
    }

    const clientEventId = generateClientEventId(sessionId);
    const clientCapturedAt = input.occurred_at || new Date().toISOString();

    const type = input.violation_type ?? input.type;
    if (!type) {
      console.warn('[useViolationTracker] Cannot record violation: missing violation type');
      return;
    }

    const fullInput: CreateViolationEventInput = {
      session_id: sessionId,
      client_event_id: clientEventId,
      type,
      client_captured_at: clientCapturedAt,
      metadata: input.metadata ?? {},
      evidence_artifact_id: input.evidence_artifact_id ?? null,
      evidence_image: input.evidence_image ?? null,
      exam_id: examId,
      student_id: studentId,
      violation_type: input.violation_type,
      occurred_at: clientCapturedAt,
      severity: input.severity,
      weight: input.weight,
      description: input.description,
      duration_ms: input.duration_ms,
    };

    const localEvent: ViolationEvent = {
      id: clientEventId,
      session_id: sessionId,
      client_event_id: clientEventId,
      type,
      severity: typeof input.severity === 'number' ? input.severity : 10,
      client_captured_at: clientCapturedAt,
      server_recorded_at: new Date().toISOString(),
      evidence_artifact_id: input.evidence_artifact_id ?? null,
      metadata: input.metadata ?? {},
      created_at: new Date().toISOString(),
      violation_type: type,
      occurred_at: clientCapturedAt,
      description: input.description ?? '',
      duration_ms: input.duration_ms,
      evidence_image: input.evidence_image ?? null,
    };

    setViolations(prev => [...prev, localEvent].slice(-100));
    pendingRef.current.push(fullInput);
    scheduleBatchSend();
  }, [sessionId, examId, studentId]);

  const scheduleBatchSend = useCallback(() => {
    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    // If buffer is at max capacity, flush immediately
    if (pendingRef.current.length >= MAX_BATCH_SIZE) {
      syncViolations();
      return;
    }
    batchTimeoutRef.current = setTimeout(() => { syncViolations(); }, BATCH_INTERVAL_MS);
  }, []);

  const syncViolations = useCallback(async () => {
    if (pendingRef.current.length === 0 || !sessionId) return;

    setIsSyncing(true);
    setSyncError(null);

    const batch = pendingRef.current.splice(0, MAX_BATCH_SIZE);

    try {
      const result = await ViolationEventService.createBatch(batch);

      if (result.success && result.batchResponse) {
        if (scoreTracker) scoreTracker.updateFromRpcResponse(result.batchResponse);
      } else if (!result.success) {
        setQueuedCount(prev => prev + batch.length);
        setSyncError(result.error ?? 'Failed to sync violations');
      }
    } catch (err) {
      setQueuedCount(prev => prev + batch.length);
      setSyncError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSyncing(false);
      if (pendingRef.current.length > 0) scheduleBatchSend();
    }
  }, [sessionId, scoreTracker, scheduleBatchSend]);

  const loadSummary = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await ViolationEventService.getSummaryBySession(sessionId);
      if (result.success && result.summaries) setSummary(result.summaries);
    } catch (err) {
      console.error('[useViolationTracker] Failed to load summary:', err);
    }
  }, [sessionId]);

  const reset = useCallback(() => {
    setViolations([]);
    setViolationCount(0);
    setSeverityCounts({});
    setSummary(null);
    setSyncError(null);
    setLiveScore(0);
    setWarningThresholdCrossed(false);
    setCriticalThresholdCrossed(false);
    pendingRef.current = [];
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pendingRef.current.length > 0) { syncViolations(); }
    };
  }, [syncViolations]);

  return {
    violations,
    violationCount,
    severityCounts,
    liveScore,
    warningThresholdCrossed,
    criticalThresholdCrossed,
    recordViolation,
    syncViolations,
    summary,
    loadSummary,
    isSyncing,
    syncError,
    queuedCount,
    reset,
  };
}
