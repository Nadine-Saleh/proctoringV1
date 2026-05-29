/**
 * useGazeTracking - React hook for gaze tracking
 *
 * Provides a clean interface to the GazeTrackingEngine with
 * React state management and lifecycle handling.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GazeTrackingEngine,
  GazeSample,
  GazeViolation,
  GazeWarning,
  AttentionMetrics,
  GazeTrackingState,
  GazeTrackingConfig,
} from '../lib/gaze/GazeTrackingEngine';
import { VIOLATION_TAXONOMY } from '../types/examSession';
import type { GazeConfig, ProctoringPolicy } from '../types/examSession';

export type CanonicalGazeEventType = 'gaze_peripheral' | 'gaze_prolonged_away';
export type GazeClassificationZone = 'on_screen' | 'peripheral' | 'away' | 'no_face';

export interface CanonicalGazeViolation {
  type: CanonicalGazeEventType;
  severity: number;
  client_captured_at: string;
  duration_ms: number;
  description: string;
  metadata: {
    zone: GazeClassificationZone;
    angle: number;
    cumulative_min_ms?: number;
    limit_ms?: number;
    over_limit?: boolean;
  };
}

export interface GazeZoneMetrics {
  continuous_ms: number;
  cumulative_ms: number;
}

export interface GazeTrackingAccumulator {
  activeZone: GazeClassificationZone;
  activeZoneStartedAt: number | null;
  lastTimestamp: number | null;
  cumulativeByZone: Record<GazeClassificationZone, number>;
  peripheralSegments: Array<{ start: number; end: number }>;
  awayEventEmitted: boolean;
}

export interface UseGazeTrackingReturn {
  isRunning: boolean;
  isCalibrated: boolean;
  modelsLoaded: boolean;
  currentSample: GazeSample | null;
  currentZone: string;
  metrics: AttentionMetrics;
  violations: GazeViolation[];
  warnings: GazeWarning[];
  warningCount: number;
  warningLevel: number;
  latestWarning: GazeWarning | null;
  zoneMetrics: Record<GazeClassificationZone, GazeZoneMetrics>;
  peripheralCumulativeLastMinuteMs: number;
  start: () => Promise<void>;
  stop: () => void;
  calibrate: () => void;
  updateConfig: (config: Partial<GazeTrackingConfig>) => void;
  clearViolations: () => void;
  clearWarnings: () => void;
  error: string | null;
  videoRef: (element: HTMLVideoElement | null) => void;
}

const DEFAULT_GAZE_CONFIG: GazeConfig = {
  peripheral_max_cumulative_min: 30,
  away_max_continuous_s: 3,
};

export function resolveGazeConfig(policy?: Partial<ProctoringPolicy>): GazeConfig {
  return {
    peripheral_max_cumulative_min:
      policy?.gaze_config?.peripheral_max_cumulative_min ?? DEFAULT_GAZE_CONFIG.peripheral_max_cumulative_min,
    away_max_continuous_s:
      policy?.gaze_config?.away_max_continuous_s ?? DEFAULT_GAZE_CONFIG.away_max_continuous_s,
  };
}

export function createGazeTrackingAccumulator(): GazeTrackingAccumulator {
  return {
    activeZone: 'on_screen',
    activeZoneStartedAt: null,
    lastTimestamp: null,
    cumulativeByZone: {
      on_screen: 0,
      peripheral: 0,
      away: 0,
      no_face: 0,
    },
    peripheralSegments: [],
    awayEventEmitted: false,
  };
}

export function calculatePeripheralCumulativeLastMinute(
  segments: Array<{ start: number; end: number }>,
  now: number,
  activeZone?: GazeClassificationZone,
  activeZoneStartedAt?: number | null,
): number {
  const cutoff = now - 60_000;
  const completed = segments.reduce((total, segment) => {
    const start = Math.max(segment.start, cutoff);
    const end = Math.min(segment.end, now);
    return end > start ? total + (end - start) : total;
  }, 0);

  if (activeZone === 'peripheral' && activeZoneStartedAt != null) {
    return completed + Math.max(0, now - Math.max(activeZoneStartedAt, cutoff));
  }

  return completed;
}

export function stepGazeTrackingAccumulator(
  accumulator: GazeTrackingAccumulator,
  sample: Pick<GazeSample, 'zone' | 'gazeAngle' | 'timestamp'>,
  gazeConfig: GazeConfig,
): {
  accumulator: GazeTrackingAccumulator;
  event?: CanonicalGazeViolation;
  zoneMetrics: Record<GazeClassificationZone, GazeZoneMetrics>;
  peripheralCumulativeLastMinuteMs: number;
} {
  const next = {
    ...accumulator,
    cumulativeByZone: { ...accumulator.cumulativeByZone },
    peripheralSegments: [...accumulator.peripheralSegments],
  };
  const now = sample.timestamp;

  if (next.lastTimestamp != null) {
    const elapsed = Math.max(0, now - next.lastTimestamp);
    next.cumulativeByZone[next.activeZone] += elapsed;
  }

  if (next.activeZoneStartedAt == null) {
    next.activeZone = sample.zone;
    next.activeZoneStartedAt = now;
  }

  let event: CanonicalGazeViolation | undefined;

  if (sample.zone !== next.activeZone && next.activeZoneStartedAt != null) {
    const zoneDuration = Math.max(0, now - next.activeZoneStartedAt);

    if (next.activeZone === 'peripheral' && zoneDuration > 0) {
      next.peripheralSegments.push({ start: next.activeZoneStartedAt, end: now });
      const cumulativeMinMs = calculatePeripheralCumulativeLastMinute(next.peripheralSegments, now);
      event = {
        type: 'gaze_peripheral',
        severity: VIOLATION_TAXONOMY.gaze_looking_away.severity,
        client_captured_at: new Date().toISOString(),
        duration_ms: zoneDuration,
        description: `Peripheral gaze for ${(zoneDuration / 1000).toFixed(1)}s`,
        metadata: {
          zone: 'peripheral',
          angle: sample.gazeAngle,
          cumulative_min_ms: cumulativeMinMs,
          limit_ms: gazeConfig.peripheral_max_cumulative_min * 1000,
          over_limit: cumulativeMinMs >= gazeConfig.peripheral_max_cumulative_min * 1000,
        },
      };
    }

    next.activeZone = sample.zone;
    next.activeZoneStartedAt = now;
    next.awayEventEmitted = false;
  }

  if (
    sample.zone === 'away' &&
    next.activeZoneStartedAt != null &&
    !next.awayEventEmitted
  ) {
    const awayDuration = Math.max(0, now - next.activeZoneStartedAt);
    if (awayDuration >= gazeConfig.away_max_continuous_s * 1000) {
      next.awayEventEmitted = true;
      event = {
        type: 'gaze_prolonged_away',
        severity: VIOLATION_TAXONOMY.gaze_prolonged_away.severity,
        client_captured_at: new Date().toISOString(),
        duration_ms: awayDuration,
        description: `Prolonged away gaze for ${(awayDuration / 1000).toFixed(1)}s`,
        metadata: {
          zone: 'away',
          angle: sample.gazeAngle,
          limit_ms: gazeConfig.away_max_continuous_s * 1000,
          over_limit: awayDuration >= gazeConfig.away_max_continuous_s * 1000,
        },
      };
    }
  }

  next.peripheralSegments = next.peripheralSegments.filter((segment) => segment.end >= now - 60_000);
  next.lastTimestamp = now;

  const zoneMetrics: Record<GazeClassificationZone, GazeZoneMetrics> = {
    on_screen: { continuous_ms: 0, cumulative_ms: next.cumulativeByZone.on_screen },
    peripheral: { continuous_ms: 0, cumulative_ms: next.cumulativeByZone.peripheral },
    away: { continuous_ms: 0, cumulative_ms: next.cumulativeByZone.away },
    no_face: { continuous_ms: 0, cumulative_ms: next.cumulativeByZone.no_face },
  };

  if (next.activeZoneStartedAt != null) {
    zoneMetrics[next.activeZone].continuous_ms = Math.max(0, now - next.activeZoneStartedAt);
  }

  return {
    accumulator: next,
    event,
    zoneMetrics,
    peripheralCumulativeLastMinuteMs: calculatePeripheralCumulativeLastMinute(
      next.peripheralSegments,
      now,
      next.activeZone,
      next.activeZoneStartedAt,
    ),
  };
}

export const useGazeTracking = (
  initialConfig?: Partial<GazeTrackingConfig> & {
    onCanonicalViolation?: (v: CanonicalGazeViolation) => void;
    proctoringPolicy?: Partial<ProctoringPolicy>;
  },
): UseGazeTrackingReturn => {
  const onCanonicalViolationRef = useRef(initialConfig?.onCanonicalViolation);
  const engineConfigRef = useRef(initialConfig);
  const enableCalibrationRef = useRef(initialConfig?.enableCalibration !== false);
  const gazePolicyRef = useRef(resolveGazeConfig(initialConfig?.proctoringPolicy));
  onCanonicalViolationRef.current = initialConfig?.onCanonicalViolation;
  gazePolicyRef.current = resolveGazeConfig(initialConfig?.proctoringPolicy);

  const engineRef = useRef<GazeTrackingEngine | null>(null);
  const trackingAccumulatorRef = useRef<GazeTrackingAccumulator>(createGazeTrackingAccumulator());

  const [state, setState] = useState<GazeTrackingState>({
    isRunning: false,
    isCalibrated: false,
    modelsLoaded: false,
    currentZone: 'on_screen',
    currentSample: null,
    attentionMetrics: {
      totalSessionTime: 0,
      onScreenTime: 0,
      offScreenTime: 0,
      attentionPercentage: 100,
      averageFaceDistance: 0.5,
      blinkRate: 0,
      gazeShifts: 0,
      longestOffScreenPeriod: 0,
    },
    violations: [],
    warnings: [],
    warningCount: 0,
    error: null,
  });

  const [warningLevel, setWarningLevel] = useState(0);
  const [latestWarning, setLatestWarning] = useState<GazeWarning | null>(null);
  const [zoneMetrics, setZoneMetrics] = useState<Record<GazeClassificationZone, GazeZoneMetrics>>({
    on_screen: { continuous_ms: 0, cumulative_ms: 0 },
    peripheral: { continuous_ms: 0, cumulative_ms: 0 },
    away: { continuous_ms: 0, cumulative_ms: 0 },
    no_face: { continuous_ms: 0, cumulative_ms: 0 },
  });
  const [peripheralCumulativeLastMinuteMs, setPeripheralCumulativeLastMinuteMs] = useState(0);

  useEffect(() => {
    const engine = new GazeTrackingEngine(engineConfigRef.current);
    engineRef.current = engine;

    engine.setOnStateChange((newState) => {
      setState(newState);
    });

    engine.setOnWarning((warning) => {
      setLatestWarning(warning);
      setWarningLevel(warning.level);
    });

    engine.initialize();

    return () => {
      engine.shutdown();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sample = state.currentSample;
    if (!sample) return;

    const result = stepGazeTrackingAccumulator(
      trackingAccumulatorRef.current,
      {
        zone: sample.zone as GazeClassificationZone,
        gazeAngle: sample.gazeAngle,
        timestamp: sample.timestamp,
      },
      gazePolicyRef.current,
    );

    trackingAccumulatorRef.current = result.accumulator;
    setZoneMetrics(result.zoneMetrics);
    setPeripheralCumulativeLastMinuteMs(result.peripheralCumulativeLastMinuteMs);

    if (result.event) {
      onCanonicalViolationRef.current?.(result.event);
    }
  }, [state.currentSample]);

  const videoRef = useCallback((element: HTMLVideoElement | null) => {
    if (engineRef.current) {
      engineRef.current.setVideoElement(element);
    }
  }, []);

  const start = useCallback(async () => {
    if (!engineRef.current) return;

    if (enableCalibrationRef.current) {
      engineRef.current.calibrate();
    }

    engineRef.current.start(() => {});
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const calibrate = useCallback(() => {
    engineRef.current?.calibrate();
  }, []);

  const updateConfig = useCallback((config: Partial<GazeTrackingConfig>) => {
    engineRef.current?.updateConfig(config);
  }, []);

  const clearViolations = useCallback(() => {
    if (engineRef.current) {
      setState((prev) => ({ ...prev, violations: [] }));
    }
  }, []);

  const clearWarnings = useCallback(() => {
    if (engineRef.current) {
      setState((prev) => ({ ...prev, warnings: [] }));
      setWarningLevel(0);
      setLatestWarning(null);
    }
  }, []);

  return {
    isRunning: state.isRunning,
    isCalibrated: state.isCalibrated,
    modelsLoaded: state.modelsLoaded,
    currentSample: state.currentSample,
    currentZone: state.currentZone,
    metrics: state.attentionMetrics,
    violations: state.violations,
    warnings: state.warnings,
    warningCount: state.warningCount,
    warningLevel,
    latestWarning,
    zoneMetrics,
    peripheralCumulativeLastMinuteMs,
    start,
    stop,
    calibrate,
    updateConfig,
    clearViolations,
    clearWarnings,
    error: state.error,
    videoRef,
  };
};
