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
}

export interface UseProctoringReturn {
  status: ProctoringStatus;
  videoRef: React.RefCallback<HTMLVideoElement>;
  retryCamera: () => void;
  clearError: () => void;
}

export const useProctoring = (): UseProctoringReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInitializedRef = useRef(false);
  const hasRequestedPermissionRef = useRef(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<ProctoringStatus>({
    camera: false,
    faceDetected: false,
    multipleFaces: false,
    tabActive: true,
    modelsLoaded: false,
    loading: true,
    errorMessage: null
  });

  const log = (msg: string) => console.log('[Proctoring]', msg);

  // Load face-api models
  const loadModels = useCallback(async () => {
    if (status.modelsLoaded) return true;

    try {
      log('Loading face detection models...');
      const MODEL_URL = '/models';

      const manifestUrl = `${MODEL_URL}/tiny_face_detector_model-weights_manifest.json`;
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Models not found at ${MODEL_URL}`);
      }

      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

      log('✓ Face detection models loaded');
      setStatus(prev => ({ ...prev, modelsLoaded: true }));
      return true;
    } catch (err: any) {
      log('✗ Model loading error: ' + err.message);
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
      log('Starting camera...');

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser does not support camera access');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });

      log('✓ Camera permission granted');
      streamRef.current = stream;
      element.srcObject = stream;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000);
        element.onloadedmetadata = () => {
          clearTimeout(timeout);
          log('✓ Video ready');
          resolve(true);
        };
        element.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video error'));
        };
      });

      element.muted = true;
      element.playsInline = true;
      await element.play();
      log('✓ Video playing');

      setStatus(prev => ({ ...prev, camera: true, loading: false }));
      isInitializedRef.current = true;
    } catch (err: any) {
      log('✗ Camera error: ' + err.message);

      let msg = 'Unable to access camera. ';
      if (err.name === 'NotAllowedError')
        msg = 'Camera permission denied. Allow access in your browser and refresh.';
      else if (err.name === 'NotFoundError')
        msg = 'No camera found. Connect a camera and refresh.';
      else if (err.name === 'NotReadableError')
        msg = 'Camera in use by another app. Close it and refresh.';
      else msg += err.message;

      setStatus(prev => ({ ...prev, camera: false, loading: false, errorMessage: msg }));
    }
  }, []);

  // Face detection
  const startFaceDetection = useCallback(() => {
    if (!status.camera || !status.modelsLoaded || !videoRef.current) {
      return;
    }

    log('Starting face detection...');

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
        const timestamp = new Date().toLocaleTimeString();

        // Console logging
        if (faceCount === 0) {
          console.warn(`[${timestamp}] ⚠️ NO FACE DETECTED`);
          console.log(`[Face Detection] Faces found: ${faceCount}`);
        } else if (faceCount === 1) {
          console.log(`[${timestamp}] ✅ Single face detected (OK)`);
          console.log(`[Face Detection] Faces found: ${faceCount}`);
        } else {
          console.warn(`[${timestamp}] 🚨 MULTIPLE FACES DETECTED: ${faceCount} faces`);
          console.warn(`[${timestamp}] ⚠️ VIOLATION: More than one person in frame`);
          console.log(`[Face Detection] Faces found: ${faceCount}`);
        }

        setStatus(prev => ({
          ...prev,
          faceDetected: faceCount >= 1,
          multipleFaces: faceCount > 1
        }));
      } catch (err: any) {
        console.error(`[${new Date().toLocaleTimeString()}] Detection error:`, err);
      }
    };

    // Start detection after small delay
    const timeout = setTimeout(() => {
      detectionIntervalRef.current = setInterval(detectFaces, 2000);
    }, 1000);

    return () => {
      clearTimeout(timeout);
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [status.camera, status.modelsLoaded]);

  // Callback ref for video element
  const setVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      if (element) {
        log('✓ Video element mounted');
        videoRef.current = element;
        startCamera(element);
      }
    },
    [startCamera]
  );

  // Retry camera
  const retryCamera = useCallback(() => {
    log('Retrying camera...');
    setStatus(prev => ({ ...prev, errorMessage: null, loading: true, camera: false }));
    isInitializedRef.current = false;
    hasRequestedPermissionRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setTimeout(() => {
      if (videoRef.current) {
        startCamera(videoRef.current);
      }
    }, 200);
  }, [startCamera]);

  // Clear error
  const clearError = useCallback(() => {
    setStatus(prev => ({ ...prev, errorMessage: null }));
  }, []);

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Start face detection when ready
  useEffect(() => {
    if (status.camera && status.modelsLoaded) {
      return startFaceDetection();
    }
  }, [status.camera, status.modelsLoaded, startFaceDetection]);

  // Tab visibility tracking
  useEffect(() => {
    const handleVisibility = () => {
      setStatus(prev => ({ ...prev, tabActive: !document.hidden }));
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        log('Camera stream stopped');
      }
      isInitializedRef.current = false;
      hasRequestedPermissionRef.current = false;
    };
  }, []);

  return {
    status,
    videoRef: setVideoRef,
    retryCamera,
    clearError
  };
};