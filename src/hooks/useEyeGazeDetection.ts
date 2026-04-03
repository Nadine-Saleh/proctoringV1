import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FilesetResolver,
  FaceLandmarker,
  FaceLandmarkerResult
} from '@mediapipe/tasks-vision';

export interface EyeGazeData {
  leftEyeOpen: number;
  rightEyeOpen: number;
  leftPupilPosition: { x: number; y: number } | null;
  rightPupilPosition: { x: number; y: number } | null;
  gazeDirection: 'center' | 'left' | 'right' | 'up' | 'down' | 'looking-away';
  eyeAspectRatio: { left: number; right: number };
  isLookingAway: boolean;
  isBlinking: boolean;
  confidence: number;
}

export interface SuspiciousGazeEvent {
  type: 'LOOKING_AWAY' | 'EXCESSIVE_BLINKING' | 'EYE_CLOSURE' | 'RAPID_EYE_MOVEMENT';
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  duration?: number;
}

export interface UseEyeGazeDetectionReturn {
  gazeData: EyeGazeData | null;
  isDetecting: boolean;
  modelsLoaded: boolean;
  loading: boolean;
  error: string | null;
  suspiciousEvents: SuspiciousGazeEvent[];
  videoRef: React.RefCallback<HTMLVideoElement>;
  startDetection: () => void;
  stopDetection: () => void;
  clearEvents: () => void;
  violationScore: number;
  violationLevel: 'low' | 'medium' | 'high' | 'critical';
  violationHistory: ViolationRecord[];
  setSensitivity: (sensitivity: GazeSensitivity) => void;
}

export type GazeSensitivity = 'low' | 'medium' | 'high' | 'strict';

export interface ViolationRecord {
  id: string;
  timestamp: string;
  type: SuspiciousGazeEvent['type'];
  severity: SuspiciousGazeEvent['severity'];
  score: number;
  description: string;
}

export interface GazeDetectionConfig {
  sensitivity: GazeSensitivity;
  lookingAwayThreshold: number; // milliseconds
  blinkThreshold: number; // EAR value
  sideGlanceThreshold: number;
  rapidMovementCount: number;
  timeWindow: number; // milliseconds for rapid movement detection
}

// Sensitivity presets
const SENSITIVITY_PRESETS: Record<GazeSensitivity, GazeDetectionConfig> = {
  low: {
    sensitivity: 'low',
    lookingAwayThreshold: 3000,
    blinkThreshold: 0.20,
    sideGlanceThreshold: 0.018,
    rapidMovementCount: 7,
    timeWindow: 2000
  },
  medium: {
    sensitivity: 'medium',
    lookingAwayThreshold: 2000,
    blinkThreshold: 0.25,
    sideGlanceThreshold: 0.015,
    rapidMovementCount: 5,
    timeWindow: 2000
  },
  high: {
    sensitivity: 'high',
    lookingAwayThreshold: 1500,
    blinkThreshold: 0.28,
    sideGlanceThreshold: 0.012,
    rapidMovementCount: 4,
    timeWindow: 2500
  },
  strict: {
    sensitivity: 'strict',
    lookingAwayThreshold: 1000,
    blinkThreshold: 0.30,
    sideGlanceThreshold: 0.010,
    rapidMovementCount: 3,
    timeWindow: 3000
  }
};

// Violation scoring weights
const VIOLATION_SCORES = {
  LOOKING_AWAY: { low: 1, medium: 2, high: 3 },
  EXCESSIVE_BLINKING: { low: 1, medium: 2, high: 3 },
  EYE_CLOSURE: { low: 2, medium: 3, high: 5 },
  RAPID_EYE_MOVEMENT: { low: 1, medium: 2, high: 3 }
};

// Violation level thresholds
const VIOLATION_LEVELS = {
  low: 0,
  medium: 5,
  high: 10,
  critical: 20
};

// Thresholds - calibrated for MediaPipe normalized coordinates (0-1)
const BLINK_THRESHOLD = 0.25;
const LOOKING_AWAY_THRESHOLD = 0.015; // Balanced - detect looking away
const SIDE_GLANCE_THRESHOLD = 0.012; // Balanced for left/right

// Landmark indices for eyes (MediaPipe Face Landmarker - 478 landmarks)
// Iris landmarks are at indices 468-477 in the full face mesh
const LEFT_EYE_KEY_POINTS = {
  corner: [33, 133], // inner and outer corners
  top: [159, 158], // upper eyelid
  bottom: [144, 145], // lower eyelid
  iris: [468, 469, 470, 471] // iris (LEFT eye iris is 468-471)
};

const RIGHT_EYE_KEY_POINTS = {
  corner: [362, 263], // inner and outer corners
  top: [386, 387], // upper eyelid
  bottom: [374, 380], // lower eyelid
  iris: [473, 474, 475, 476] // iris (RIGHT eye iris is 473-476)
};

export const useEyeGazeDetection = (isEnabled: boolean = true): UseEyeGazeDetectionReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);
  const blinkStartTimeRef = useRef<number | null>(null);
  const lookingAwayStartTimeRef = useRef<number | null>(null);
  const lastGazeDirectionRef = useRef<string>('center');
  const rapidMovementCountRef = useRef<number>(0);
  const rapidMovementTimerRef = useRef<any>(null);
  const hasStartedDetectionRef = useRef(false);
  const lastPupilPositionsRef = useRef<{ left: { x: number; y: number }; right: { x: number; y: number } } | null>(null);

  const [gazeData, setGazeData] = useState<EyeGazeData | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suspiciousEvents, setSuspiciousEvents] = useState<SuspiciousGazeEvent[]>([]);
  const [violationScore, setViolationScore] = useState(0);
  const [violationHistory, setViolationHistory] = useState<ViolationRecord[]>([]);
  const [currentSensitivity, setCurrentSensitivity] = useState<GazeSensitivity>('medium');

  const log = (msg: string) => console.log('[EyeGaze]', msg);

  // Get current sensitivity config
  const getCurrentConfig = useCallback(() => {
    return SENSITIVITY_PRESETS[currentSensitivity];
  }, [currentSensitivity]);

  // Set sensitivity function
  const setSensitivity = useCallback((sensitivity: GazeSensitivity) => {
    setCurrentSensitivity(sensitivity);
    log(`Sensitivity changed to: ${sensitivity}`);
  }, []);

  // Calculate violation level from score
  const getViolationLevel = useCallback((score: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (score >= VIOLATION_LEVELS.critical) return 'critical';
    if (score >= VIOLATION_LEVELS.high) return 'high';
    if (score >= VIOLATION_LEVELS.medium) return 'medium';
    return 'low';
  }, []);

  // Add violation score
  const addViolationScore = useCallback((type: SuspiciousGazeEvent['type'], severity: SuspiciousGazeEvent['severity']) => {
    const score = VIOLATION_SCORES[type][severity] || 1;
    setViolationScore(prev => {
      const newScore = prev + score;
      const newLevel = getViolationLevel(newScore);
      console.log(`[EyeGaze] 📊 Violation score: ${newScore} (${newLevel})`);
      return newScore;
    });

    // Add to history
    const violation: ViolationRecord = {
      id: `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      severity,
      score,
      description: `${type.replace(/_/g, ' ')} - ${severity} severity (+${score} pts)`
    };

    setViolationHistory(prev => {
      const newHistory = [...prev, violation];
      return newHistory.slice(-100); // Keep last 100 violations
    });
  }, [getViolationLevel]);

  // Calculate Eye Aspect Ratio (EAR) for blink detection
  const calculateEAR = useCallback((landmarks: any[], topIndices: number[], bottomIndices: number[], cornerIndices: number[]): number => {
    if (!landmarks || landmarks.length === 0) return 0.3;

    // Get vertical distances (top to bottom)
    let verticalSum = 0;
    const pairs = Math.min(topIndices.length, bottomIndices.length);
    
    for (let i = 0; i < pairs; i++) {
      const top = landmarks[topIndices[i]];
      const bottom = landmarks[bottomIndices[i]];
      if (top && bottom) {
        verticalSum += Math.hypot(top.x - bottom.x, top.y - bottom.y);
      }
    }
    
    const avgVertical = verticalSum / pairs;

    // Get horizontal distance (eye width)
    const leftCorner = landmarks[cornerIndices[0]];
    const rightCorner = landmarks[cornerIndices[1]];
    const horizontal = leftCorner && rightCorner 
      ? Math.hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y)
      : 0.1;

    if (horizontal === 0) return 0.3;
    return avgVertical / horizontal;
  }, []);

  // Calculate iris/pupil position relative to eye center
  const calculatePupilPosition = useCallback(
    (irisLandmarks: any[], eyeLandmarks: any[]): { x: number; y: number } | null => {
      if (!irisLandmarks || irisLandmarks.length < 2) return null;

      // Calculate iris center
      const irisCenter = {
        x: irisLandmarks.reduce((sum, l) => sum + l.x, 0) / irisLandmarks.length,
        y: irisLandmarks.reduce((sum, l) => sum + l.y, 0) / irisLandmarks.length
      };

      // Calculate eye center from corners
      const leftCorner = eyeLandmarks[0];
      const rightCorner = eyeLandmarks[1];
      
      if (!leftCorner || !rightCorner) return null;

      const eyeCenter = {
        x: (leftCorner.x + rightCorner.x) / 2,
        y: (leftCorner.y + rightCorner.y) / 2
      };

      // Return relative position (positive = right/down from center)
      return {
        x: irisCenter.x - eyeCenter.x,
        y: irisCenter.y - eyeCenter.y
      };
    },
    []
  );

  // Determine gaze direction from pupil positions
  const determineGazeDirection = useCallback(
    (leftPupil: { x: number; y: number } | null, rightPupil: { x: number; y: number } | null): EyeGazeData['gazeDirection'] => {
      if (!leftPupil || !rightPupil) {
        console.log('[EyeGaze] No pupil data, returning center');
        return 'center';
      }

      const avgX = (leftPupil.x + rightPupil.x) / 2;
      const avgY = (leftPupil.y + rightPupil.y) / 2;

      // Check specific directions with thresholds
      const absX = Math.abs(avgX);
      const absY = Math.abs(avgY);
      
      // Combined distance from center (for diagonal detection)
      const distanceFromCenter = Math.sqrt(absX * absX + absY * absY);
      
      // Lowered thresholds for better detection
      const isHorizontalGlance = absX > SIDE_GLANCE_THRESHOLD;
      const isVerticalGlance = absY > LOOKING_AWAY_THRESHOLD;
      
      // Debug logging for upward gaze
      if (avgY < -0.005) {
        console.log('[EyeGaze] ⬆️ UPWARD gaze detected! avgY:', avgY.toFixed(4), 'threshold:', LOOKING_AWAY_THRESHOLD);
      }
      
      // Enhanced downward gaze detection (keyboard/phone cheating)
      if (avgY > 0.005) {
        console.log('[EyeGaze] ⬇️ DOWNWARD gaze detected! avgY:', avgY.toFixed(4), 'threshold:', LOOKING_AWAY_THRESHOLD);
      }

      // If any significant movement from center (including diagonals)
      if (distanceFromCenter > LOOKING_AWAY_THRESHOLD || isHorizontalGlance || isVerticalGlance) {
        // Determine primary direction based on which axis is stronger
        if (absY > absX * 0.5) {
          // Vertical movement is dominant - looking up or down
          const direction = avgY < 0 ? 'up' : 'down';
          console.log('[EyeGaze] ⬆️⬇️ Vertical direction:', direction, 'avgY:', avgY.toFixed(4), 'avgX:', avgX.toFixed(4));
          return direction;
        } else if (isHorizontalGlance) {
          // Horizontal movement (side glance)
          const direction = avgX < 0 ? 'left' : 'right';
          console.log('[EyeGaze] ⬅️➡️ Horizontal direction:', direction, 'avgX:', avgX.toFixed(4));
          return direction;
        } else {
          // Small movement - still classify as looking away
          if (absY > absX) {
            return avgY < 0 ? 'up' : 'down';
          }
          return avgX < 0 ? 'left' : 'right';
        }
      }

      return 'center';
    },
    []
  );

  // Record suspicious event
  const recordSuspiciousEvent = useCallback(
    (
      type: SuspiciousGazeEvent['type'],
      severity: SuspiciousGazeEvent['severity'],
      description: string,
      duration?: number
    ) => {
      const event: SuspiciousGazeEvent = {
        type,
        timestamp: new Date().toISOString(),
        severity,
        description,
        duration
      };

      setSuspiciousEvents((prev) => {
        const newEvents = [...prev, event];
        return newEvents.slice(-50);
      });

      // Add violation score
      addViolationScore(type, severity);

      const timestamp = new Date().toLocaleTimeString();
      const severityIcon = severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : 'ℹ️';
      console.log(`[${timestamp}] ${severityIcon} [${type}] ${description}`);
    },
    [addViolationScore]
  );

  // Detect rapid eye movements
  const checkRapidEyeMovement = useCallback((newDirection: string) => {
    if (lastGazeDirectionRef.current !== newDirection && newDirection !== 'center') {
      rapidMovementCountRef.current++;

      if (!rapidMovementTimerRef.current) {
        rapidMovementTimerRef.current = setTimeout(() => {
          if (rapidMovementCountRef.current >= 5) {
            recordSuspiciousEvent(
              'RAPID_EYE_MOVEMENT',
              'medium',
              `Detected ${rapidMovementCountRef.current} rapid eye movements in 2 seconds`,
              2000
            );
          }
          rapidMovementCountRef.current = 0;
          rapidMovementTimerRef.current = null;
        }, 2000);
      }
    }

    lastGazeDirectionRef.current = newDirection;
  }, [recordSuspiciousEvent]);

  // Main detection loop
  const detectGaze = useCallback(async () => {
    if (!faceLandmarkerRef.current) {
      console.warn('[EyeGaze] ⚠️ No face landmarker');
      return;
    }
    
    if (!videoRef.current) {
      console.warn('[EyeGaze] ⚠️ No video element');
      return;
    }
    
    if (!isDetectingRef.current) {
      console.warn('[EyeGaze] ⚠️ Not detecting (isDetectingRef = false)');
      return;
    }

    try {
      const video = videoRef.current;
      
      // Check if video is ready
      if (video.readyState < 2) {
        console.log('[EyeGaze] Video not ready, state:', video.readyState);
        animationFrameRef.current = window.setTimeout(detectGaze, 500) as any;
        return;
      }

      console.log('[EyeGaze] 🔍 Running detection...');
      const startTime = performance.now();
      const result: FaceLandmarkerResult = faceLandmarkerRef.current.detectForVideo(
        video,
        startTime
      );

      console.log('[EyeGaze] Detection result - faces found:', result.faceLandmarks?.length || 0);

      if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        console.log('[EyeGaze] ⚠️ No face detected');
        setGazeData(null);
        animationFrameRef.current = window.setTimeout(detectGaze, 100) as any;
        return;
      }

      const landmarks = result.faceLandmarks[0];
      console.log('[EyeGaze] ✅ Face detected with', landmarks.length, 'landmarks');

      // Extract eye landmarks
      const leftCornerLandmarks = LEFT_EYE_KEY_POINTS.corner.map(i => landmarks[i]).filter(Boolean);
      const leftIrisLandmarks = LEFT_EYE_KEY_POINTS.iris.map(i => landmarks[i]).filter(Boolean);
      
      const rightCornerLandmarks = RIGHT_EYE_KEY_POINTS.corner.map(i => landmarks[i]).filter(Boolean);
      const rightIrisLandmarks = RIGHT_EYE_KEY_POINTS.iris.map(i => landmarks[i]).filter(Boolean);

      // Calculate EAR for blink detection
      const leftEAR = calculateEAR(landmarks, LEFT_EYE_KEY_POINTS.top, LEFT_EYE_KEY_POINTS.bottom, LEFT_EYE_KEY_POINTS.corner);
      const rightEAR = calculateEAR(landmarks, RIGHT_EYE_KEY_POINTS.top, RIGHT_EYE_KEY_POINTS.bottom, RIGHT_EYE_KEY_POINTS.corner);

      // Calculate pupil positions
      const leftPupil = calculatePupilPosition(leftIrisLandmarks, leftCornerLandmarks);
      const rightPupil = calculatePupilPosition(rightIrisLandmarks, rightCornerLandmarks);

      // Debug logging for iris detection
      if (leftIrisLandmarks.length === 0 || rightIrisLandmarks.length === 0) {
        console.warn('[EyeGaze] ⚠️ Iris landmarks not detected! Left:', leftIrisLandmarks.length, 'Right:', rightIrisLandmarks.length);
      }

      // Store for debugging
      if (leftPupil && rightPupil) {
        lastPupilPositionsRef.current = { left: leftPupil, right: rightPupil };
      }

      // Determine gaze direction
      const gazeDirection = determineGazeDirection(leftPupil, rightPupil);
      
      const isBlinking = leftEAR < BLINK_THRESHOLD && rightEAR < BLINK_THRESHOLD;
      const isLookingAway = gazeDirection !== 'center';

      const newGazeData: EyeGazeData = {
        leftEyeOpen: leftEAR,
        rightEyeOpen: rightEAR,
        leftPupilPosition: leftPupil,
        rightPupilPosition: rightPupil,
        gazeDirection,
        eyeAspectRatio: { left: leftEAR, right: rightEAR },
        isLookingAway,
        isBlinking,
        confidence: result.faceLandmarks.length > 0 ? 1 : 0
      };

      setGazeData(newGazeData);

      // Check for suspicious behavior
      const now = Date.now();

      // Blinking detection
      if (isBlinking) {
        if (!blinkStartTimeRef.current) {
          blinkStartTimeRef.current = now;
        } else {
          const blinkDuration = now - blinkStartTimeRef.current;
          if (blinkDuration > 400) { // Reduced threshold
            recordSuspiciousEvent(
              'EYE_CLOSURE',
              'high',
              `Eye closure detected for ${Math.round(blinkDuration)}ms`,
              blinkDuration
            );
            blinkStartTimeRef.current = null;
          }
        }
      } else {
        blinkStartTimeRef.current = null;
      }

      // Looking away detection (2 seconds - balanced)
      if (isLookingAway) {
        if (!lookingAwayStartTimeRef.current) {
          lookingAwayStartTimeRef.current = now;
          console.log('[EyeGaze] Started looking away timer, direction:', gazeDirection);
        } else {
          const lookingAwayDuration = now - lookingAwayStartTimeRef.current;
          
          // Faster detection for looking down (keyboard/phone cheating)
          const threshold = gazeDirection === 'down' ? 1500 : 2000; // 1.5s for down, 2s for others
          
          if (lookingAwayDuration > threshold) {
            console.log('[EyeGaze] 🚨 RECORDING LOOKING_AWAY event after', lookingAwayDuration, 'ms, direction:', gazeDirection);
            recordSuspiciousEvent(
              'LOOKING_AWAY',
              lookingAwayDuration > 5000 ? 'high' : 'medium',
              `Looking ${gazeDirection} for ${Math.round(lookingAwayDuration / 1000)}s${gazeDirection === 'down' ? ' (possible keyboard/phone use)' : ''}`,
              lookingAwayDuration
            );
            lookingAwayStartTimeRef.current = null;
          } else if (lookingAwayDuration % 500 < 100) {
            // Log every 500ms while looking away
            console.log('[EyeGaze] Still looking', gazeDirection, ':', Math.round(lookingAwayDuration/1000), 's');
          }
        }
      } else {
        if (lookingAwayStartTimeRef.current) {
          console.log('[EyeGaze] Looking away stopped before threshold');
        }
        lookingAwayStartTimeRef.current = null;
      }

      // Rapid eye movement detection
      checkRapidEyeMovement(gazeDirection);

      // Delay next detection to reduce CPU/GPU load (10 fps = 100ms)
      animationFrameRef.current = window.setTimeout(detectGaze, 100) as any;
    } catch (err: any) {
      console.error('[EyeGaze] Detection error:', err);
      animationFrameRef.current = window.setTimeout(detectGaze, 500) as any;
    }
  }, [calculateEAR, calculatePupilPosition, determineGazeDirection, checkRapidEyeMovement, recordSuspiciousEvent]);

  // Load Face Landmarker model
  const loadModels = useCallback(async () => {
    if (modelsLoaded) {
      console.log('[EyeGaze] Models already loaded, skipping');
      return;
    }

    try {
      console.log('[EyeGaze] 📦 Loading Face Landmarker model...');
      log('Loading Face Landmarker model...');
      setLoading(true);

      console.log('[EyeGaze] Resolving FilesetResolver...');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
      );
      console.log('[EyeGaze] ✅ FilesetResolver resolved');

      console.log('[EyeGaze] Creating FaceLandmarker...');
      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1
      });

      faceLandmarkerRef.current = faceLandmarker;
      setModelsLoaded(true);
      setLoading(false);
      console.log('[EyeGaze] ✅✅✅ Face Landmarker loaded successfully!');
      log('✓ Face Landmarker loaded successfully');
      } catch (err: any) {
      console.error('[EyeGaze] ❌❌❌ Model loading error:', err);
      log('✗ Model loading error: ' + err.message);
      setError('Failed to load eye tracking models: ' + err.message);
      setModelsLoaded(false);
      setLoading(false);
      }
      }, [modelsLoaded]);


  // Start detection
  const startDetection = useCallback(() => {
    console.log('[EyeGaze] 🚀 startDetection called');
    console.log('[EyeGaze] isEnabled:', isEnabled);
    console.log('[EyeGaze] videoRef.current:', videoRef.current);
    console.log('[EyeGaze] modelsLoaded:', modelsLoaded);
    console.log('[EyeGaze] isDetectingRef.current:', isDetectingRef.current);
    
    if (!isEnabled) {
      log('⚠️ Detection disabled');
      return;
    }

    if (!videoRef.current) {
      log('⚠️ No video element available');
      console.error('[EyeGaze] ❌ Cannot start - no video element');
      return;
    }

    if (!modelsLoaded) {
      log('⚠️ Models not loaded yet');
      console.error('[EyeGaze] ❌ Cannot start - models not loaded');
      return;
    }

    if (isDetectingRef.current) {
      log('⚠️ Already detecting');
      return;
    }

    log('✅ Starting eye gaze detection...');
    isDetectingRef.current = true;
    hasStartedDetectionRef.current = true;
    setIsDetecting(true);
    console.log('[EyeGaze] ✅ Detection started, calling detectGaze...');
    detectGaze();
  }, [modelsLoaded, detectGaze, isEnabled]);

  // Stop detection
  const stopDetection = useCallback(() => {
    log('Stopping eye gaze detection...');
    isDetectingRef.current = false;
    setIsDetecting(false);

    if (animationFrameRef.current) {
      window.clearTimeout(animationFrameRef.current as any);
      animationFrameRef.current = null;
    }

    if (rapidMovementTimerRef.current) {
      clearTimeout(rapidMovementTimerRef.current);
      rapidMovementTimerRef.current = null;
    }
  }, []);

  // Clear events
  const clearEvents = useCallback(() => {
    setSuspiciousEvents([]);
  }, []);

  // Video ref callback
  const setVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      console.log('[EyeGaze] 📹 Video ref callback called:', element ? 'element received' : 'null');
      videoRef.current = element;
      if (element) {
        log('✓ Video element mounted for eye tracking');
        console.log('[EyeGaze] Video element details:', {
          readyState: element.readyState,
          videoWidth: element.videoWidth,
          videoHeight: element.videoHeight,
          srcObject: element.srcObject ? 'present' : 'null'
        });
      }
    },
    []
  );

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
      log('Eye gaze detection cleanup complete');
    };
  }, [stopDetection]);

  return {
    gazeData,
    isDetecting,
    modelsLoaded,
    loading,
    error,
    suspiciousEvents,
    videoRef: setVideoRef,
    startDetection,
    stopDetection,
    clearEvents,
    violationScore,
    violationLevel: getViolationLevel(violationScore),
    violationHistory,
    setSensitivity
  };
};
