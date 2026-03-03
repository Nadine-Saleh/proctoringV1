import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { LivenessDetectionModule, LivenessStep, LivenessEvent } from '../services/LivenessDetectionModule';

export interface LivenessCheckResult {
  passed: boolean;
  faceVerified: boolean;
  livenessVerified: boolean;
  attempts: number;
  timestamp?: string;
}

export interface UseLivenessCheckReturn {
  isChecking: boolean;
  isPassed: boolean;
  isFailed: boolean;
  progress: number;
  instruction: string;
  currentStep: LivenessStep | null;
  stepIndex: number;
  totalSteps: number;
  result: LivenessCheckResult | null;
  startCheck: () => void;
  resetCheck: () => void;
  videoRef: React.RefCallback<HTMLVideoElement>;
}

const CHECK_DURATION = 30000; // 30 seconds total check time for multiple steps
const FACE_PRESENCE_REQUIRED = 2000; // Face present for at least 2 seconds

export const useLivenessCheck = (): UseLivenessCheckReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const blinkCountRef = useRef<number>(0);
  const movementDirectionsRef = useRef<Set<string>>(new Set());
  const lastFacePositionRef = useRef<{ x: number; y: number } | null>(null);
  const facePresentTimeRef = useRef<number>(0);
  const hasStartedCheckRef = useRef(false);
  const livenessModuleRef = useRef<LivenessDetectionModule | null>(null);

  const [isChecking, setIsChecking] = useState(false);
  const [isPassed, setIsPassed] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [instruction, setInstruction] = useState('Click "Start Verification" to begin');
  const [currentStep, setCurrentStep] = useState<LivenessStep | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [result, setResult] = useState<LivenessCheckResult | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const log = useCallback((msg: string) => console.log('[LivenessCheck]', msg), []);

  // Initialize Liveness Module
  useEffect(() => {
    if (!livenessModuleRef.current) {
      livenessModuleRef.current = new LivenessDetectionModule();
      
      livenessModuleRef.current.on(LivenessEvent.STEP_STARTED, (_event, data) => {
        setCurrentStep(data.step);
        setStepIndex(data.index);
        setTotalSteps(data.total);
        setInstruction(`Step ${data.index + 1}: Please ${data.step.name}`);
      });

      livenessModuleRef.current.on(LivenessEvent.STEP_PASSED, (_event, data) => {
        log(`✓ Step passed: ${data.step.name}`);
      });

      livenessModuleRef.current.on(LivenessEvent.PROGRESS_UPDATED, (_event, _data) => {
        // Individual step progress if needed
      });
    }
  }, [log]);

  // Load face detection models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        log('Loading face detection models...');
        const MODEL_URL = '/models';

        // Wait for faceapi to be ready if needed, though usually it's fine
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        
        setModelsLoaded(true);
        log('✓ Face detection models loaded');
      } catch (err: any) {
        log('✗ Model loading error: ' + err.message);
        setModelsLoaded(false);
      }
    };

    loadModels();
  }, [log]);

  // Clear all intervals
  const clearIntervals = useCallback(() => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (detectionTimerRef.current) {
      window.clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
  }, []);

  // Main liveness check logic
  const performLivenessCheck = useCallback(async () => {
    const element = videoRef.current;
    if (!element) {
      log('✗ No video element available');
      setIsFailed(true);
      setInstruction('Video not ready. Please try again.');
      return;
    }

    if (!faceapi.nets.tinyFaceDetector.isLoaded) {
      log('✗ Face detection models not loaded');
      setIsFailed(true);
      setInstruction('Face detection models not loaded');
      return;
    }

    log('Starting liveness check sequence...');
    setIsChecking(true);
    hasStartedCheckRef.current = true;
    blinkCountRef.current = 0;
    movementDirectionsRef.current = new Set();
    lastFacePositionRef.current = null;
    facePresentTimeRef.current = 0;

    // Initialize module
    if (livenessModuleRef.current) {
      livenessModuleRef.current.initialize();
    }

    const startTime = Date.now();
    let verificationCompleted = false;

    // Progress timer
    timerIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / CHECK_DURATION) * 100, 100);
      setProgress(newProgress);

      if (elapsed >= CHECK_DURATION && isChecking && !verificationCompleted) {
        log('Check timeout');
        handleCompletion(false, 'Verification timed out');
      }
    }, 100);

    const handleCompletion = (passed: boolean, reason?: string) => {
      if (verificationCompleted) return; // Prevent multiple calls
      verificationCompleted = true;
      
      clearIntervals();
      setIsChecking(false);

      const faceVerified = facePresentTimeRef.current > 0 && (Date.now() - facePresentTimeRef.current >= FACE_PRESENCE_REQUIRED);

      const livenessResult: LivenessCheckResult = {
        passed: passed && faceVerified,
        faceVerified,
        livenessVerified: passed,
        attempts: 1,
        timestamp: new Date().toISOString()
      };

      setResult(livenessResult);

      if (passed && faceVerified) {
        setIsPassed(true);
        setIsFailed(false);
        setInstruction('Verification successful! You can now start the exam.');
        log('✓ Liveness check sequence passed');
      } else {
        setIsPassed(false);
        setIsFailed(true);
        setInstruction(reason || 'Verification failed. Please try again.');
        log(`✗ Liveness check sequence failed: ${reason}`);
      }
    };

    // Face detection and module processing loop
    const detectionLoop = async () => {
      if (!hasStartedCheckRef.current || !videoRef.current || verificationCompleted) return;

      try {
        const detections = await faceapi.detectAllFaces(
          element,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceExpressions();

        if (detections.length === 0) {
          // Only update instruction if no face detected for a while
          if (facePresentTimeRef.current === 0) {
            setInstruction('Please position your face in the frame');
          }
        } else if (detections.length > 1) {
          setInstruction('Only one person should be visible');
        } else {
          // Single face detected
          // Track face presence duration
          if (facePresentTimeRef.current === 0) {
            facePresentTimeRef.current = Date.now();
          }

          // Process with liveness module
          if (livenessModuleRef.current) {
            // Map to DetectedFace interface
            const mappedDetections = detections.map(d => ({
              box: {
                x: d.detection.box.x,
                y: d.detection.box.y,
                width: d.detection.box.width,
                height: d.detection.box.height,
              },
              landmarks: d.landmarks,
              expressions: d.expressions
            }));

            livenessModuleRef.current.processFrame(mappedDetections as any);
          }
        }
      } catch (err: any) {
        console.error('[LivenessCheck] Detection error:', err);
      }

      // Schedule next frame
      if (hasStartedCheckRef.current && !verificationCompleted) {
        detectionTimerRef.current = window.setTimeout(detectionLoop, 200) as any;
      }
    };

    // Start detection loop
    detectionLoop();

    // Listen for module events
    if (livenessModuleRef.current) {
      const onComplete = () => {
        log('✓ All liveness steps completed successfully');
        handleCompletion(true, 'All poses verified');
        cleanupModuleListeners();
      };

      const onTimeout = (data?: any) => {
        log(`✗ Step timeout: ${data?.step?.name || 'unknown step'}`);
        handleCompletion(false, `Step "${data?.step?.name || 'current'}" timed out. Please try again.`);
        cleanupModuleListeners();
      };

      const onStepPassed = (data?: any) => {
        log(`✓ Step passed: ${data?.step?.name}`);
      };

      const cleanupModuleListeners = () => {
        if (livenessModuleRef.current) {
          livenessModuleRef.current.off(LivenessEvent.VERIFICATION_COMPLETE, onComplete);
          livenessModuleRef.current.off(LivenessEvent.TIMEOUT_OCCURRED, onTimeout);
          livenessModuleRef.current.off(LivenessEvent.STEP_PASSED, onStepPassed);
        }
      };

      livenessModuleRef.current.on(LivenessEvent.VERIFICATION_COMPLETE, onComplete);
      livenessModuleRef.current.on(LivenessEvent.TIMEOUT_OCCURRED, onTimeout);
      livenessModuleRef.current.on(LivenessEvent.STEP_PASSED, onStepPassed);
    }
  }, [log, clearIntervals]);

  // Start the liveness check
  const startCheck = useCallback(async () => {
    if (hasStartedCheckRef.current) {
      log('Check already in progress');
      return;
    }

    if (!videoRef.current) {
      log('Cannot start check - no video ref');
      setIsFailed(true);
      setInstruction('Camera not ready. Please wait.');
      return;
    }

    try {
      // Reset state
      setIsPassed(false);
      setIsFailed(false);
      setProgress(0);
      setResult(null);
      setInstruction('Starting verification...');

      log('Starting liveness check...');

      // Wait for models to be loaded
      const areModelsLoaded = () => 
        faceapi.nets.tinyFaceDetector.isLoaded && 
        faceapi.nets.faceLandmark68Net.isLoaded && 
        faceapi.nets.faceExpressionNet.isLoaded;

      if (!modelsLoaded || !areModelsLoaded()) {
        log('Waiting for models to load...');
        const waitForModels = window.setInterval(() => {
          if (areModelsLoaded()) {
            window.clearInterval(waitForModels);
            log('Models loaded, starting check');
            performLivenessCheck();
          }
        }, 100);

        // Timeout for model loading
        setTimeout(() => {
          window.clearInterval(waitForModels);
          if (!areModelsLoaded()) {
            log('Models failed to load');
            setIsFailed(true);
            setInstruction('Face detection models failed to load');
          }
        }, 15000);
      } else {
        // Models already loaded, start check
        performLivenessCheck();
      }
    } catch (err: any) {
      log('✗ Liveness check error: ' + err.message);
      setIsFailed(true);
      setInstruction(`Error: ${err.message}`);
    }
  }, [log, modelsLoaded, performLivenessCheck]);

  // Reset the check
  const resetCheck = useCallback(() => {
    log('Resetting liveness check');

    clearIntervals();
    
    if (livenessModuleRef.current) {
      livenessModuleRef.current.reset();
    }

    setIsChecking(false);
    setIsPassed(false);
    setIsFailed(false);
    setProgress(0);
    setInstruction('Click "Start Verification" to begin');
    setCurrentStep(null);
    setStepIndex(0);
    setResult(null);
    hasStartedCheckRef.current = false;
    blinkCountRef.current = 0;
    movementDirectionsRef.current = new Set();
    lastFacePositionRef.current = null;
    facePresentTimeRef.current = 0;
  }, [log, clearIntervals]);

  // Video ref callback
  const setVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      videoRef.current = element;
      if (element) {
        log('✓ Video element mounted for liveness check');
      }
    },
    [log]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearIntervals();
      hasStartedCheckRef.current = false;
      log('Liveness check cleanup complete');
    };
  }, [clearIntervals, log]);

  return {
    isChecking,
    isPassed,
    isFailed,
    progress,
    instruction,
    currentStep,
    stepIndex,
    totalSteps,
    result,
    startCheck,
    resetCheck,
    videoRef: setVideoRef
  };
};
