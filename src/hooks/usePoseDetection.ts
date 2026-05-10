import { useState, useEffect, useRef, useCallback } from 'react';

interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface PoseDetectionResult {
  landmarks: PoseLandmark[];
  visibility: {
    leftShoulder: number;
    rightShoulder: number;
    leftElbow: number;
    rightElbow: number;
  };
}

interface UsePoseDetectionResult {
  isModelLoaded: boolean;
  isDetecting: boolean;
  poseData: PoseDetectionResult | null;
  frameStatus: 'valid' | 'invalid' | 'idle';
  statusMessage: string;
  startDetection: (videoElement: HTMLVideoElement) => Promise<void>;
  stopDetection: () => void;
  loadModel: () => Promise<void>;
  error: string | null;
  loadingProgress: string;
}

const VISIBILITY_THRESHOLD = 0.05; // Very low threshold for better detection

export const usePoseDetection = (): UsePoseDetectionResult => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [poseData, setPoseData] = useState<PoseDetectionResult | null>(null);
  const [frameStatus, setFrameStatus] = useState<'valid' | 'invalid' | 'idle'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState('');

  const detectorRef = useRef<any>(null);
  const isDetectingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isLandmarkInFrame = (landmark: PoseLandmark | undefined) => {
    if (!landmark) return false;
    return (
      landmark.x >= 0 && landmark.x <= 1 &&
      landmark.y >= 0 && landmark.y <= 1 &&
      (landmark.visibility ?? 1) > VISIBILITY_THRESHOLD
    );
  };

  const checkUpperBodyPose = useCallback((landmarks: PoseLandmark[]): boolean => {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];

    const shouldersVisible = isLandmarkInFrame(leftShoulder) && isLandmarkInFrame(rightShoulder);
    const elbowsVisible = isLandmarkInFrame(leftElbow) && isLandmarkInFrame(rightElbow);

    // Correct pose only when both shoulders and both elbows are visible.
    return shouldersVisible && elbowsVisible;
  }, []);

  const handlePoseResults = useCallback((results: any) => {
    if (!results || !results.poseLandmarks?.length) {
      setFrameStatus('invalid');
      setStatusMessage('⚠ يرجى إرجاع الجسم بالكامل أمام الكاميرا');
      return;
    }

    const landmarks: PoseLandmark[] = results.poseLandmarks;
    const visibility = {
      leftShoulder: landmarks[11]?.visibility ?? 0,
      rightShoulder: landmarks[12]?.visibility ?? 0,
      leftElbow: landmarks[13]?.visibility ?? 0,
      rightElbow: landmarks[14]?.visibility ?? 0
    };

    // Debug logging
    console.log('[Pose] Visibility values:', {
      leftShoulder: visibility.leftShoulder.toFixed(3),
      rightShoulder: visibility.rightShoulder.toFixed(3),
      leftElbow: visibility.leftElbow.toFixed(3),
      rightElbow: visibility.rightElbow.toFixed(3),
      threshold: VISIBILITY_THRESHOLD
    });

    const poseResult: PoseDetectionResult = {
      landmarks,
      visibility
    };

    setPoseData(poseResult);

    const hasCompleteUpperBody = checkUpperBodyPose(landmarks);
    console.log('[Pose] Upper body complete:', hasCompleteUpperBody);

    if (hasCompleteUpperBody) {
      setFrameStatus('valid');
      setStatusMessage('');
    } else {
      setFrameStatus('invalid');
      setStatusMessage('⚠ يرجى إرجاع الجسم بالكامل أمام الكاميرا');
    }
  }, [checkUpperBodyPose]);

  // Load MediaPipe Pose model with better error handling
  const loadModel = useCallback(async () => {
    try {
      if (detectorRef.current) {
        console.log('[Pose] Model already loaded');
        return;
      }

      setLoadingProgress('جاري تحميل نموذج MediaPipe Pose...');
      console.log('[Pose] Starting Pose model loading...');

      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('[Pose] Model loading timeout');
        setLoadingProgress('التحميل يستغرق وقتاً أطول من المتوقع... حاول إعادة تحميل الصفحة');
      }, 30000);

      const poseModule = await import('@mediapipe/pose');
      const { Pose } = poseModule as any;

      setLoadingProgress('تهيئة نموذج الكشف...');
      console.log('[Pose] Initializing detector');

      detectorRef.current = new Pose({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
      });

      detectorRef.current.setOptions({
        modelComplexity: 0, // Use lightest model for better performance
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.3, // Lower confidence threshold
        minTrackingConfidence: 0.3   // Lower tracking threshold
      });
      detectorRef.current.onResults(handlePoseResults);

      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      console.log('[Pose] Model loaded successfully!');
      setIsModelLoaded(true);
      setError(null);
      setLoadingProgress('');
    } catch (err) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error loading pose model';
      console.error('[Pose] Load model error:', err);
      setError(errorMessage);
      setIsModelLoaded(false);
      setLoadingProgress('فشل التحميل - تحقق من الاتصال أو أعد تشغيل الصفحة');
    }
  }, [handlePoseResults]);
  const detectPose = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current || !isDetectingRef.current) return;

    try {
      await detectorRef.current.send({ image: videoRef.current });
    } catch (err) {
      console.error('[Pose] Detection error:', err);
    }

    animationFrameRef.current = requestAnimationFrame(detectPose);
  }, []);

  // Start detection
  const startDetection = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!isModelLoaded || isDetectingRef.current) return;

    try {
      console.log('[Pose] Starting detection');
      videoRef.current = videoElement;
      isDetectingRef.current = true;
      setIsDetecting(true);
      setFrameStatus('idle');

      animationFrameRef.current = requestAnimationFrame(detectPose);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start pose detection';
      console.error('[Pose] Start detection error:', err);
      setError(errorMessage);
      isDetectingRef.current = false;
      setIsDetecting(false);
    }
  }, [isModelLoaded, detectPose]);

  // Stop detection
  const stopDetection = useCallback(() => {
    console.log('[Pose] Stopping detection');
    isDetectingRef.current = false;
    setIsDetecting(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setPoseData(null);
    setFrameStatus('idle');
  }, []);

  // Auto-load model on mount
  useEffect(() => {
    loadModel();

    return () => {
      stopDetection();
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loadModel, stopDetection]);

  return {
    isModelLoaded,
    isDetecting,
    poseData,
    frameStatus,
    statusMessage,
    startDetection,
    stopDetection,
    loadModel,
    error,
    loadingProgress
  };
};
