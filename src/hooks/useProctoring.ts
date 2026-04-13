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

export const useProctoring = (isEnabled: boolean = true): UseProctoringReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInitializedRef = useRef(false);
  const hasRequestedPermissionRef = useRef(false);
  const detectionIntervalRef = useRef<any>(null);

  const [status, setStatus] = useState<ProctoringStatus>({
    camera: false,
    faceDetected: false,
    multipleFaces: false,
    tabActive: true,
    modelsLoaded: false,
    loading: true,
    errorMessage: null
  });

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

        setStatus(prev => ({
          ...prev,
          faceDetected: faceCount >= 1,
          multipleFaces: faceCount > 1
        }));
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
    clearError
  };
};