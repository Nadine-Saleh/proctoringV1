import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

export interface ProctoringStatus {
  camera: boolean;
  faceDetected: boolean;
  multipleFaces: boolean;
  tabActive: boolean;
  modelsLoaded: boolean;
  loading: boolean;
  errorMessage: string | null;
  faceNotDetected: boolean;
  faceTooClose: boolean;
  faceTooFar: boolean;
}

export interface UseProctoringReturn {
  status: ProctoringStatus;
  videoRef: React.RefCallback<HTMLVideoElement>;
  retryCamera: () => void;
  clearError: () => void;
  recordViolation: (violation: { type: string; severity: string; description: string; metadata?: Record<string, unknown> }) => void;
  setViolationCallback: (callback: (violation: { type: string; severity: string; description: string; metadata?: Record<string, unknown> }) => void) => void;
}

export const useProctoring = (isEnabled: boolean = true): UseProctoringReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInitializedRef = useRef(false);
  const hasRequestedPermissionRef = useRef(false);
  const detectionIntervalRef = useRef<any>(null);
  const violationCallbackRef = useRef<((violation: { type: string; severity: string; description: string; metadata?: Record<string, unknown> }) => void) | null>(null);
  const faceNotDetectedCountRef = useRef(0);
  const lastFaceNotDetectedAlertRef = useRef(0);

  const [status, setStatus] = useState<ProctoringStatus>({
    camera: false,
    faceDetected: false,
    multipleFaces: false,
    tabActive: true,
    modelsLoaded: false,
    loading: true,
    errorMessage: null,
    faceNotDetected: false,
    faceTooClose: false,
    faceTooFar: false
  });

  // Violation callback setter (exposed for external use)
  const setViolationCallbackFn = useCallback((callback: (violation: { type: string; severity: string; description: string; metadata?: Record<string, unknown> }) => void) => {
    violationCallbackRef.current = callback;
  }, []);

  // Load face-api models
  const loadModels = useCallback(async () => {
    if (status.modelsLoaded) return true;

    try {
      const MODEL_URL = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      setStatus(prev => ({ ...prev, modelsLoaded: true }));
      return true;
    } catch (err: any) {
      setStatus(prev => ({
        ...prev,
        modelsLoaded: false,
        errorMessage: 'Face detection unavailable. Exam will continue without proctoring.'
      }));
      return false;
    }
  }, [status.modelsLoaded]);

  // Initialize camera
  const startCamera = useCallback(async (element: HTMLVideoElement) => {
    if (isInitializedRef.current || hasRequestedPermissionRef.current) {
      return;
    }
    hasRequestedPermissionRef.current = true;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser does not support camera access');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });

      streamRef.current = stream;
      element.srcObject = stream;

      await new Promise((resolve, reject) => {
        const onVideoReady = () => {
          element.removeEventListener('loadedmetadata', onVideoReady);
          element.removeEventListener('error', onVideoError);
          resolve(true);
        };

        const onVideoError = () => {
          element.removeEventListener('loadedmetadata', onVideoReady);
          element.removeEventListener('error', onVideoError);
          reject(new Error('Video source error'));
        };

        if (element.readyState >= 1) {
          onVideoReady();
        } else {
          element.addEventListener('loadedmetadata', onVideoReady);
          element.addEventListener('error', onVideoError);
        }
      });

      element.muted = true;
      element.playsInline = true;
      await element.play().catch(() => {});

      setStatus(prev => ({ ...prev, camera: true, loading: false }));
      isInitializedRef.current = true;
    } catch (err: any) {
      let msg = 'Unable to access camera. ';
      if (err.name === 'NotAllowedError')
        msg = 'Camera permission denied. Allow access in your browser and refresh.';
      else if (err.name === 'NotFoundError')
        msg = 'No camera found. Connect a camera and refresh.';
      else if (err.name === 'NotReadableError')
        msg = 'Camera in use by another app. Close it and refresh.';
      else msg += err.message;

      setStatus(prev => ({ ...prev, camera: false, loading: false, errorMessage: msg }));
      hasRequestedPermissionRef.current = false;
    }
  }, []);

  // Face detection
  const startFaceDetection = useCallback(() => {
    if (!isEnabled || !status.camera || !status.modelsLoaded || !videoRef.current) {
      return;
    }

    const detectFaces = async () => {
      try {
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          return;
        }

        const detections = await faceapi.detectAllFaces(
          videoRef.current!,
          new faceapi.TinyFaceDetectorOptions()
        );

        const faceCount = detections.length;
        const now = Date.now();

        // Multiple faces detection
        if (faceCount > 1) {
          setStatus(prev => ({ ...prev, multipleFaces: true, faceDetected: true }));
          violationCallbackRef.current?.({
            type: 'multiple_faces',
            severity: 'critical',
            description: `${faceCount} faces detected in frame`,
            metadata: { faceCount }
          });
        } else if (faceCount === 1) {
          setStatus(prev => ({ 
            ...prev, 
            multipleFaces: false, 
            faceDetected: true,
            faceNotDetected: false 
          }));
          faceNotDetectedCountRef.current = 0;
        } else {
          // No face detected
          faceNotDetectedCountRef.current++;
          
          // Only alert after 3 consecutive misses (6 seconds)
          if (faceNotDetectedCountRef.current >= 3 && now - lastFaceNotDetectedAlertRef.current > 30000) {
            setStatus(prev => ({ ...prev, faceDetected: false, faceNotDetected: true }));
            violationCallbackRef.current?.({
              type: 'face_not_detected',
              severity: 'high',
              description: 'No face detected in frame for 6+ seconds',
              metadata: { consecutiveMisses: faceNotDetectedCountRef.current }
            });
            lastFaceNotDetectedAlertRef.current = now;
          } else {
            setStatus(prev => ({ ...prev, faceDetected: false }));
          }
        }

        // Face distance estimation (using detection box size)
        if (faceCount === 1 && detections[0].box) {
          const boxArea = detections[0].box.width * detections[0].box.height;
          const videoArea = videoRef.current!.videoWidth * videoRef.current!.videoHeight;
          const faceRatio = boxArea / videoArea;
          
          // Thresholds based on face occupying screen area
          if (faceRatio > 0.15) {
            setStatus(prev => ({ ...prev, faceTooClose: true, faceTooFar: false }));
            if (now - lastFaceNotDetectedAlertRef.current > 30000) {
              violationCallbackRef.current?.({
                type: 'face_too_close',
                severity: 'medium',
                description: 'Face too close to camera',
                metadata: { faceRatio: Math.round(faceRatio * 100) }
              });
              lastFaceNotDetectedAlertRef.current = now;
            }
          } else if (faceRatio < 0.03) {
            setStatus(prev => ({ ...prev, faceTooClose: false, faceTooFar: true }));
            if (now - lastFaceNotDetectedAlertRef.current > 30000) {
              violationCallbackRef.current?.({
                type: 'face_too_far',
                severity: 'medium',
                description: 'Face too far from camera',
                metadata: { faceRatio: Math.round(faceRatio * 100) }
              });
              lastFaceNotDetectedAlertRef.current = now;
            }
          } else {
            setStatus(prev => ({ ...prev, faceTooClose: false, faceTooFar: false }));
          }
        }
      } catch {
        // Silently ignore detection errors during normal operation
      }
    };

    const timeout = window.setTimeout(() => {
      detectionIntervalRef.current = window.setInterval(detectFaces, 2000);
    }, 1000);

    return () => {
      window.clearTimeout(timeout);
      if (detectionIntervalRef.current) {
        window.clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [isEnabled, status.camera, status.modelsLoaded]);

  // Callback ref for video element
  const setVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      if (element) {
        videoRef.current = element;
        startCamera(element);
      }
    },
    [startCamera]
  );

  // Retry camera
  const retryCamera = useCallback(() => {
    setStatus(prev => ({ ...prev, errorMessage: null, loading: true, camera: false }));
    isInitializedRef.current = false;
    hasRequestedPermissionRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    window.setTimeout(() => {
      if (videoRef.current) {
        startCamera(videoRef.current);
      }
    }, 200);
  }, [startCamera]);

  // Clear error
  const clearError = useCallback(() => {
    setStatus(prev => ({ ...prev, errorMessage: null }));
  }, []);

  // Record violation wrapper
  const recordViolation = useCallback((violation: { type: string; severity: string; description: string; metadata?: Record<string, unknown> }) => {
    violationCallbackRef.current?.(violation);
  }, []);

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Start face detection when ready
  useEffect(() => {
    if (isEnabled && status.camera && status.modelsLoaded) {
      return startFaceDetection();
    }
  }, [isEnabled, status.camera, status.modelsLoaded, startFaceDetection]);

  // Tab visibility tracking
  useEffect(() => {
    if (!isEnabled) return;
    
    const handleVisibility = () => {
      setStatus(prev => ({ ...prev, tabActive: !document.hidden }));
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectionIntervalRef.current) {
        window.clearInterval(detectionIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      isInitializedRef.current = false;
      hasRequestedPermissionRef.current = false;
    };
  }, []);

  return {
    status,
    videoRef: setVideoRef,
    retryCamera,
    clearError,
    recordViolation,
    setViolationCallback: setViolationCallbackFn
  };
};