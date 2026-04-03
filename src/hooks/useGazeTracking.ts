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
  GazeTrackingConfig
} from '../lib/gaze/GazeTrackingEngine';

export interface UseGazeTrackingReturn {
  // State
  isRunning: boolean;
  isCalibrated: boolean;
  modelsLoaded: boolean;
  currentSample: GazeSample | null;
  currentZone: string;
  
  // Metrics
  metrics: AttentionMetrics;
  violations: GazeViolation[];
  warnings: GazeWarning[];
  warningCount: number;
  warningLevel: number;
  latestWarning: GazeWarning | null;
  
  // Controls
  start: () => Promise<void>;
  stop: () => void;
  calibrate: () => void;
  updateConfig: (config: Partial<GazeTrackingConfig>) => void;
  clearViolations: () => void;
  clearWarnings: () => void;
  
  // Status
  error: string | null;
  videoRef: (element: HTMLVideoElement | null) => void;
}

export const useGazeTracking = (
  initialConfig?: Partial<GazeTrackingConfig>
): UseGazeTrackingReturn => {
  const engineRef = useRef<GazeTrackingEngine | null>(null);
  const [state, setState] = useState<GazeTrackingState>({
    isRunning: false,
    isCalibrated: false,
    modelsLoaded: false,
    currentZone: 'on-screen',
    currentSample: null,
    attentionMetrics: {
      totalSessionTime: 0,
      onScreenTime: 0,
      offScreenTime: 0,
      attentionPercentage: 100,
      averageFaceDistance: 0.5,
      blinkRate: 0,
      gazeShifts: 0,
      longestOffScreenPeriod: 0
    },
    violations: [],
    warnings: [],
    warningCount: 0,
    error: null
  });

  const [warningLevel, setWarningLevel] = useState(0);
  const [latestWarning, setLatestWarning] = useState<GazeWarning | null>(null);

  // Initialize engine
  useEffect(() => {
    const engine = new GazeTrackingEngine(initialConfig);
    engineRef.current = engine;

    // Set up callbacks
    engine.setOnStateChange((newState) => {
      setState(newState);
    });

    engine.setOnViolation((violation) => {
      console.warn('[GazeTracking] Violation:', violation);
    });

    engine.setOnWarning((warning) => {
      setLatestWarning(warning);
      setWarningLevel(warning.level);
      console.warn('[GazeTracking] Warning:', warning);
    });

    // Initialize
    engine.initialize();

    return () => {
      engine.shutdown();
      engineRef.current = null;
    };
  }, []);

  // Video ref callback
  const videoRef = useCallback((element: HTMLVideoElement | null) => {
    if (engineRef.current) {
      engineRef.current.setVideoElement(element);
    }
  }, []);

  // Start tracking
  const start = useCallback(async () => {
    if (!engineRef.current) return;

    // Auto-calibrate if enabled
    if (initialConfig?.enableCalibration !== false) {
      engineRef.current.calibrate();
    }

    await engineRef.current.startCamera();
    
    engineRef.current.start(() => {
      // Real-time sample callback
      // Additional processing can be done here
    });
  }, []);

  // Stop tracking
  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  // Calibrate
  const calibrate = useCallback(() => {
    engineRef.current?.calibrate();
  }, []);

  // Update config
  const updateConfig = useCallback((config: Partial<GazeTrackingConfig>) => {
    engineRef.current?.updateConfig(config);
  }, []);

  // Clear violations
  const clearViolations = useCallback(() => {
    if (engineRef.current) {
      setState(prev => ({ ...prev, violations: [] }));
    }
  }, []);

  // Clear warnings
  const clearWarnings = useCallback(() => {
    if (engineRef.current) {
      setState(prev => ({ ...prev, warnings: [] }));
      setWarningLevel(0);
      setLatestWarning(null);
    }
  }, []);

  return {
    // State
    isRunning: state.isRunning,
    isCalibrated: state.isCalibrated,
    modelsLoaded: state.modelsLoaded,
    currentSample: state.currentSample,
    currentZone: state.currentZone,
    
    // Metrics
    metrics: state.attentionMetrics,
    violations: state.violations,
    warnings: state.warnings,
    warningCount: state.warningCount,
    warningLevel,
    latestWarning,
    
    // Controls
    start,
    stop,
    calibrate,
    updateConfig,
    clearViolations,
    clearWarnings,
    
    // Status
    error: state.error,
    videoRef
  };
};
