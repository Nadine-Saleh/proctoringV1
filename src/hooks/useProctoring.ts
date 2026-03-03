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

  const log = (msg: string) => console.log('[Proctoring]', msg);

  // Load face-api models
  const loadModels = useCallback(async () => {
    if (status.modelsLoaded) return true;

    try {
      log('Loading face detection models...');
      const MODEL_URL = '/models';

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

      // Add a timeout to getUserMedia as it can sometimes hang
      const streamPromise = navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });

      const timeoutPromise = new Promise<never>((_, reject) => 
        window.setTimeout(() => reject(new Error('Camera request timed out')), 10000)
      );

      const stream = await Promise.race([streamPromise, timeoutPromise]);

      log('✓ Camera permission granted');
      streamRef.current = stream;
      element.srcObject = stream;

      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Video stream initialization timed out')), 15000);
        
        const onVideoReady = () => {
          window.clearTimeout(timeout);
          element.removeEventListener('loadedmetadata', onVideoReady);
          element.removeEventListener('error', onVideoError);
          log('✓ Video ready');
          resolve(true);
        };

        const onVideoError = (e: any) => {
          window.clearTimeout(timeout);
          element.removeEventListener('loadedmetadata', onVideoReady);
          element.removeEventListener('error', onVideoError);
          console.error('[Proctoring] Video error event:', e);
          reject(new Error('Video source error'));
        };

        // Check if already ready
        if (element.readyState >= 1) {
          onVideoReady();
        } else {
          element.addEventListener('loadedmetadata', onVideoReady);
          element.addEventListener('error', onVideoError);
        }
      });

      element.muted = true;
      element.playsInline = true;
      try {
        await element.play();
        log('✓ Video playing');
      } catch (playErr: any) {
        console.error('[Proctoring] Play error:', playErr);
        // Sometimes play() fails if the browser thinks it's not user-initiated
        // but we'll try to continue if metadata is loaded
      }

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
      hasRequestedPermissionRef.current = false; // Allow retry
    }
  }, []);

  // Face detection
  const startFaceDetection = useCallback(() => {
    if (!isEnabled || !status.camera || !status.modelsLoaded || !videoRef.current) {
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