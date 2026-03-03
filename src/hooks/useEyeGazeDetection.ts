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
}

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

  const log = (msg: string) => console.log('[EyeGaze]', msg);

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
      
      // More sensitive detection for horizontal (side) glances
      const isHorizontalGlance = absX > SIDE_GLANCE_THRESHOLD;
      const isVerticalGlance = absY > LOOKING_AWAY_THRESHOLD;
      
      // If any significant movement from center (including diagonals)
      if (distanceFromCenter > LOOKING_AWAY_THRESHOLD || isHorizontalGlance) {
        // Determine primary direction based on which axis is stronger
        if (absY > absX * 0.7 && isVerticalGlance) {
          // Vertical component is significant
          if (absX > absY * 0.7 || isHorizontalGlance) {
            // Both X and Y are significant - diagonal movement
            const hDir = avgX < 0 ? 'left' : 'right';
            const vDir = avgY < 0 ? 'up' : 'down';
            // Return the dominant direction but mark as looking away
            return absX > absY ? hDir : vDir;
          }
          return avgY < 0 ? 'up' : 'down';
        } else {
          // Horizontal movement (side glance)
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

      const timestamp = new Date().toLocaleTimeString();
      const severityIcon = severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : 'ℹ️';
      console.log(`[${timestamp}] ${severityIcon} [${type}] ${description}`);
    },
    []
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
    if (!faceLandmarkerRef.current || !videoRef.current || !isDetectingRef.current) {
      return;
    }

    try {
      const video = videoRef.current;
      
      // Check if video is ready
      if (video.readyState < 2) {
        animationFrameRef.current = window.setTimeout(detectGaze, 100) as any;
        return;
      }

      const startTime = performance.now();
      const result: FaceLandmarkerResult = faceLandmarkerRef.current.detectForVideo(
        video,
        startTime
      );

      if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        setGazeData(null);
        animationFrameRef.current = requestAnimationFrame(detectGaze);
        return;
      }

      const landmarks = result.faceLandmarks[0];

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
          if (lookingAwayDuration > 2000) {
            console.log('[EyeGaze] 🚨 RECORDING LOOKING_AWAY event after', lookingAwayDuration, 'ms');
            recordSuspiciousEvent(
              'LOOKING_AWAY',
              lookingAwayDuration > 5000 ? 'high' : 'medium',
              `Looking ${gazeDirection} for ${Math.round(lookingAwayDuration / 1000)}s`,
              lookingAwayDuration
            );
            lookingAwayStartTimeRef.current = null;
          } else if (lookingAwayDuration % 500 < 100) {
            // Log every 500ms while looking away
            console.log('[EyeGaze] Still looking away:', Math.round(lookingAwayDuration/1000), 's');
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
    if (modelsLoaded) return;

    try {
      log('Loading Face Landmarker model...');
      setLoading(true);

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
      );

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
      log('✓ Face Landmarker loaded successfully');
      } catch (err: any) {
      log('✗ Model loading error: ' + err.message);
      setError('Failed to load eye tracking models: ' + err.message);
      setModelsLoaded(false);
      setLoading(false);
      }
      }, [modelsLoaded]);


  // Start detection
  const startDetection = useCallback(() => {
    if (!isEnabled) {
      log('⚠️ Detection disabled');
      return;
    }

    if (!videoRef.current) {
      log('⚠️ No video element available');
      return;
    }

    if (!modelsLoaded) {
      log('⚠️ Models not loaded yet');
      return;
    }

    if (isDetectingRef.current) {
      log('⚠️ Already detecting');
      return;
    }

    log('Starting eye gaze detection...');
    isDetectingRef.current = true;
    hasStartedDetectionRef.current = true;
    setIsDetecting(true);
    detectGaze();
  }, [modelsLoaded, detectGaze]);

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
      videoRef.current = element;
      if (element) {
        log('✓ Video element mounted for eye tracking');
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
    clearEvents
  };
};
