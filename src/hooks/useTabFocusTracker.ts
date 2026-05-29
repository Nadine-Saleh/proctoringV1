import { useEffect, useRef, useCallback } from 'react';
import { VIOLATION_TAXONOMY } from '../types/examSession';

export interface TabFocusViolation {
  type: 'tab_focus_lost';
  severity: number;
  client_captured_at: string;
  duration_ms: number | null;
  metadata: { reason: string };
}

interface UseTabFocusTrackerOptions {
  enabled?: boolean;
  onViolation?: (event: TabFocusViolation) => void;
}

/**
 * T059: Emits tab_focus_lost canonical violation events on
 * visibilitychange (tab hidden) and window blur.
 */
export function useTabFocusTracker({ enabled = true, onViolation }: UseTabFocusTrackerOptions = {}): void {
  const blurStartRef = useRef<number | null>(null);
  const callbackRef = useRef(onViolation);
  callbackRef.current = onViolation;

  const emitViolation = useCallback((reason: string, durationMs: number | null) => {
    if (!callbackRef.current) return;
    callbackRef.current({
      type: 'tab_focus_lost',
      severity: VIOLATION_TAXONOMY.tab_focus_lost.severity,
      client_captured_at: new Date().toISOString(),
      duration_ms: durationMs,
      metadata: { reason },
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurStartRef.current = Date.now();
      } else if (blurStartRef.current !== null) {
        const duration = Date.now() - blurStartRef.current;
        emitViolation('tab_hidden', duration);
        blurStartRef.current = null;
      }
    };

    const handleBlur = () => {
      if (blurStartRef.current === null) {
        blurStartRef.current = Date.now();
      }
    };

    const handleFocus = () => {
      if (blurStartRef.current !== null) {
        const duration = Date.now() - blurStartRef.current;
        emitViolation('window_blur', duration);
        blurStartRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, emitViolation]);
}
