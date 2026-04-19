import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { VIOLATION_TAXONOMY } from '../types/examSession';
import type { ViolationType } from '../types/examSession';

export interface CanonicalViolation {
  type: ViolationType;
  severity: number;
  client_captured_at: string;
  description: string;
  metadata?: Record<string, unknown>;
}

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
  setCanonicalViolationCallback: (callback: (v: CanonicalViolation) => void) => void;
  captureViolationSnapshot: (options?: { maxWidth?: number; maxHeight?: number; quality?: number }) => Promise<string | null>;
}

function emitCanonical(
  type: ViolationType,
  description: string,
  metadata: Record<string, unknown>,
  canonicalCb: React.MutableRefObject<((v: CanonicalViolation) => void) | null>,
  legacyCb: React.MutableRefObject<((v: { type: string; severity: string; description: string; metadata?: Record<string, unknown> }) => void) | null>
): void {
  const severity = VIOLATION_TAXONOMY[type]?.severity ?? 10;
  const now = new Date().toISOString();

  canonicalCb.current?.({ type, severity, client_captured_at: now, description, metadata });

  // Bridge to legacy callback (string severity)
  const severityLabel =
    severity >= 20 ? 'critical' : severity >= 15 ? 'high' : severity >= 10 ? 'medium' : 'low';
  legacyCb.current?.({ type, severity: severityLabel, description, metadata });
}

export const useProctoring = (isEnabled: boolean = true): UseProctoringReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInitializedRef = useRef(false);
  const hasRequestedPermissionRef = useRef(false);
  const detectionIntervalRef = useRef<number | null>(null);
  const violationCallbackRef = useRef<((violation: { type: string; severity: string; description: string; metadata?: Record<string, unknown> }) => void) | null>(null);
  const canonicalCallbackRef = useRef<((v: CanonicalViolation) => void) | null>(null);
  const faceNotDetectedCountRef = useRef(0);
  const lastFaceAlertRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraLostRef = useRef(false);

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
    faceTooFar: false,
  });

  const setViolationCallbackFn = useCallback((
    callback: (violation: { type: string; severity: string; description: string; metadata?: Record<string, unknown> }) => void
  ) => {
    violationCallbackRef.current = callback;
  }, []);

  const setCanonicalViolationCallback = useCallback((callback: (v: CanonicalViolation) => void) => {
    canonicalCallbackRef.current = callback;
  }, []);

  const loadModels = useCallback(async () => {
    if (status.modelsLoaded) return true;
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      setStatus(prev => ({ ...prev, modelsLoaded: true }));
      return true;
    } catch {
      setStatus(prev => ({
        ...prev,
        modelsLoaded: false,
        errorMessage: 'Face detection unavailable. Exam will continue without proctoring.',
      }));
      return false;
    }
  }, [status.modelsLoaded]);

  const startCamera = useCallback(async (element: HTMLVideoElement) => {
    if (isInitializedRef.current || hasRequestedPermissionRef.current) return;
    hasRequestedPermissionRef.current = true;
    cameraLostRef.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser does not support camera access');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;
      element.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          element.removeEventListener('loadedmetadata', onReady);
          element.removeEventListener('error', onErr);
          resolve();
        };
        const onErr = () => {
          element.removeEventListener('loadedmetadata', onReady);
          element.removeEventListener('error', onErr);
          reject(new Error('Video source error'));
        };
        if (element.readyState >= 1) onReady();
        else {
          element.addEventListener('loadedmetadata', onReady);
          element.addEventListener('error', onErr);
        }
      });

      element.muted = true;
      element.playsInline = true;
      await element.play().catch(() => {});

      // T058: track when camera stream ends unexpectedly
      stream.getVideoTracks().forEach(track => {
        track.addEventListener('ended', () => {
          if (!cameraLostRef.current) {
            cameraLostRef.current = true;
            setStatus(prev => ({ ...prev, camera: false, errorMessage: 'Camera disconnected' }));
            emitCanonical('camera_unavailable', 'Camera stream ended unexpectedly', {}, canonicalCallbackRef, violationCallbackRef);
          }
        });
      });

      setStatus(prev => ({ ...prev, camera: true, loading: false }));
      isInitializedRef.current = true;
    } catch (err: any) {
      let msg = 'Unable to access camera. ';
      if (err.name === 'NotAllowedError') msg = 'Camera permission denied. Allow access in your browser and refresh.';
      else if (err.name === 'NotFoundError') msg = 'No camera found. Connect a camera and refresh.';
      else if (err.name === 'NotReadableError') msg = 'Camera in use by another app. Close it and refresh.';
      else msg += err.message;

      setStatus(prev => ({ ...prev, camera: false, loading: false, errorMessage: msg }));
      hasRequestedPermissionRef.current = false;

      // T058: emit camera_unavailable on permission/hardware failure
      emitCanonical('camera_unavailable', msg, { error: err.name }, canonicalCallbackRef, violationCallbackRef);
    }
  }, []);

  const startFaceDetection = useCallback(() => {
    if (!isEnabled || !status.camera || !status.modelsLoaded || !videoRef.current) return;

    const detectFaces = async () => {
      try {
        if (!faceapi.nets.tinyFaceDetector.isLoaded) return;

        const detections = await faceapi.detectAllFaces(
          videoRef.current!,
          new faceapi.TinyFaceDetectorOptions()
        );

        const faceCount = detections.length;
        const now = Date.now();

        if (faceCount > 1) {
          // T058: multiple_persons with canonical severity
          setStatus(prev => ({ ...prev, multipleFaces: true, faceDetected: true }));
          emitCanonical(
            'multiple_persons',
            `${faceCount} persons detected in frame`,
            { faceCount },
            canonicalCallbackRef,
            violationCallbackRef
          );
        } else if (faceCount === 1) {
          setStatus(prev => ({ ...prev, multipleFaces: false, faceDetected: true, faceNotDetected: false }));
          faceNotDetectedCountRef.current = 0;
        } else {
          faceNotDetectedCountRef.current++;
          if (faceNotDetectedCountRef.current >= 3 && now - lastFaceAlertRef.current > 30000) {
            setStatus(prev => ({ ...prev, faceDetected: false, faceNotDetected: true }));
            // T058: face_not_visible with canonical severity
            emitCanonical(
              'face_not_visible',
              'No face detected for 6+ seconds',
              { consecutiveMisses: faceNotDetectedCountRef.current },
              canonicalCallbackRef,
              violationCallbackRef
            );
            lastFaceAlertRef.current = now;
          } else {
            setStatus(prev => ({ ...prev, faceDetected: false }));
          }
        }

        // Face distance estimation
        if (faceCount === 1 && detections[0]?.box) {
          const boxArea = detections[0].box.width * detections[0].box.height;
          const videoArea = (videoRef.current?.videoWidth ?? 640) * (videoRef.current?.videoHeight ?? 480);
          const faceRatio = boxArea / videoArea;

          if (faceRatio > 0.15) {
            setStatus(prev => ({ ...prev, faceTooClose: true, faceTooFar: false }));
            if (now - lastFaceAlertRef.current > 30000) {
              emitCanonical('face_too_close', 'Face too close to camera', { faceRatio: Math.round(faceRatio * 100) }, canonicalCallbackRef, violationCallbackRef);
              lastFaceAlertRef.current = now;
            }
          } else if (faceRatio < 0.03) {
            setStatus(prev => ({ ...prev, faceTooClose: false, faceTooFar: true }));
            if (now - lastFaceAlertRef.current > 30000) {
              emitCanonical('face_too_far', 'Face too far from camera', { faceRatio: Math.round(faceRatio * 100) }, canonicalCallbackRef, violationCallbackRef);
              lastFaceAlertRef.current = now;
            }
          } else {
            setStatus(prev => ({ ...prev, faceTooClose: false, faceTooFar: false }));
          }
        }
      } catch {
        // Silently ignore detection errors
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

  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    if (element) {
      videoRef.current = element;
      startCamera(element);
    }
  }, [startCamera]);

  const retryCamera = useCallback(() => {
    setStatus(prev => ({ ...prev, errorMessage: null, loading: true, camera: false }));
    isInitializedRef.current = false;
    hasRequestedPermissionRef.current = false;
    cameraLostRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    window.setTimeout(() => {
      if (videoRef.current) startCamera(videoRef.current);
    }, 200);
  }, [startCamera]);

  const clearError = useCallback(() => {
    setStatus(prev => ({ ...prev, errorMessage: null }));
  }, []);

  const recordViolation = useCallback((violation: { type: string; severity: string; description: string; metadata?: Record<string, unknown> }) => {
    violationCallbackRef.current?.(violation);
  }, []);

  const captureViolationSnapshot = useCallback(async (
    options?: { maxWidth?: number; maxHeight?: number; quality?: number }
  ): Promise<string | null> => {
    try {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return null;

      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
      const canvas = canvasRef.current;

      const maxWidth = options?.maxWidth ?? 320;
      const maxHeight = options?.maxHeight ?? 240;
      const quality = options?.quality ?? 0.6;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const aspectRatio = videoWidth / videoHeight;

      let width = maxWidth;
      let height = maxHeight;
      if (videoWidth / videoHeight > aspectRatio) height = Math.round(width / aspectRatio);
      else width = Math.round(height * aspectRatio);

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  useEffect(() => {
    if (isEnabled && status.camera && status.modelsLoaded) return startFaceDetection();
  }, [isEnabled, status.camera, status.modelsLoaded, startFaceDetection]);

  // Tab visibility tracking
  useEffect(() => {
    if (!isEnabled) return;
    const handleVisibility = () => setStatus(prev => ({ ...prev, tabActive: !document.hidden }));
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isEnabled]);

  // T064: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectionIntervalRef.current) window.clearInterval(detectionIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
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
    setViolationCallback: setViolationCallbackFn,
    setCanonicalViolationCallback,
    captureViolationSnapshot,
  };
};
