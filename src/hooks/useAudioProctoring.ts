import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioProctoringEngine } from '../lib/audio/AudioProctoringEngine';

export type SidecarStatus = 'idle' | 'active' | 'degraded';

export interface UseAudioProctoringReturn {
  isActive: boolean;
  sidecarStatus: SidecarStatus;
  flagCount: number;
  softWarning: boolean;
  strongWarning: boolean;
  stopProctoring: () => void;
}

interface Options {
  sessionId: string;
  examId?: string;
  micStream: MediaStream | null;
  isExamActive: boolean;
  suspiciousThreshold?: number;
}

const SOFT_WARNING_DURATION_MS = 5_000;

export function useAudioProctoring({
  sessionId,
  examId,
  micStream,
  isExamActive,
  suspiciousThreshold = 3,
}: Options): UseAudioProctoringReturn {
  const engineRef = useRef<AudioProctoringEngine | null>(null);
  const softTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fix #1: ref for strong warning timer to prevent memory leaks
  const strongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [sidecarStatus, setSidecarStatus] = useState<SidecarStatus>('idle');
  const [flagCount, setFlagCount] = useState(0);
  const [softWarning, setSoftWarning] = useState(false);
  const [strongWarning, setStrongWarning] = useState(false);

  const clearSoftTimer = useCallback(() => {
    if (softTimerRef.current !== null) {
      clearTimeout(softTimerRef.current);
      softTimerRef.current = null;
    }
  }, []);

  // Fix #1: clear previous strong timer before creating a new one
  const clearStrongTimer = useCallback(() => {
    if (strongTimerRef.current !== null) {
      clearTimeout(strongTimerRef.current);
      strongTimerRef.current = null;
    }
  }, []);

  const triggerSoftWarning = useCallback(() => {
    setSoftWarning(true);
    clearSoftTimer();
    softTimerRef.current = setTimeout(() => setSoftWarning(false), SOFT_WARNING_DURATION_MS);
  }, [clearSoftTimer]);

  const stopProctoring = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setIsActive(false);
    setSidecarStatus('idle');
    clearSoftTimer();
    clearStrongTimer(); // Fix #1
  }, [clearSoftTimer, clearStrongTimer]);

  useEffect(() => {
    // Fix #7: guard against missing examId
    if (!isExamActive || !micStream || !examId) return;

    // Fix #2: cancelled flag prevents state updates after unmount
    let cancelled = false;

    const engine = new AudioProctoringEngine(sessionId, examId);
    engineRef.current = engine;

    const unsub = engine.on(event => {
      if (cancelled) return; // Fix #2
      if (event.type === 'normal_speech') {
        triggerSoftWarning();
      } else if (event.type === 'suspicious_speech') {
        setFlagCount(engine.flagCount);
        triggerSoftWarning();
        if (engine.flagCount >= suspiciousThreshold) {
          // Fix #1: clear previous strong timer before setting a new one
          clearStrongTimer();
          setStrongWarning(true);
          strongTimerRef.current = setTimeout(() => {
            if (!cancelled) setStrongWarning(false);
          }, SOFT_WARNING_DURATION_MS);
        }
      } else if (event.type === 'degraded') {
        setSidecarStatus('degraded');
      } else if (event.type === 'recovered') {
        // Fix #3: return sidebar to green after network recovery
        setSidecarStatus('active');
      }
    });

    engine.start(micStream).then(() => {
      if (cancelled) return; // Fix #2
      setIsActive(true);
      setSidecarStatus('active');
    }).catch(() => {
      if (cancelled) return; // Fix #2
      setSidecarStatus('degraded');
    });

    return () => {
      cancelled = true; // Fix #2: prevent any further state updates
      unsub();
      engine.stop(); // Fix #6: idempotent, safe to call even if stopProctoring already called it
      clearSoftTimer();
      clearStrongTimer(); // Fix #1
    };
  }, [sessionId, examId, micStream, isExamActive, suspiciousThreshold, triggerSoftWarning, clearSoftTimer, clearStrongTimer]);

  return { isActive, sidecarStatus, flagCount, softWarning, strongWarning, stopProctoring };
}
