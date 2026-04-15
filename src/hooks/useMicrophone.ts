// src/hooks/useMicrophone.ts
import { useState, useEffect, useRef, useCallback } from 'react';

export interface MicrophoneStatus {
  microphone: boolean;
  recording: boolean;
  loading: boolean;
  errorMessage: string | null;
  permissionGranted: boolean;
  permissionDenied: boolean;
  streamHealthy: boolean;
}

export interface UseMicrophoneReturn {
  status: MicrophoneStatus;
  stream: MediaStream | null;
  isStreamReady: boolean;
  isRecording: boolean;
  streamHealthy: boolean;
  startMicrophone: (forceRestart?: boolean) => Promise<void>;
  stopMicrophone: () => Blob | null;
  retryMicrophone: () => void;
  clearError: () => void;
}

export const useMicrophone = (): UseMicrophoneReturn => {
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isInitializedRef = useRef(false);
  const hasRequestedPermissionRef = useRef(false);

  const [status, setStatus] = useState<MicrophoneStatus>({
    microphone: false,
    recording: false,
    loading: true,
    errorMessage: null,
    permissionGranted: false,
    permissionDenied: false,
    streamHealthy: false
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const log = (msg: string) => console.log('[Microphone]', msg);

  const startMicrophone = useCallback(async (forceRestart?: boolean) => {
    const force = forceRestart ?? false;
    log(`startMicrophone called with force=${force}`);

    // Clean up any existing stream before requesting new one
    if (streamRef.current) {
      log('Stopping existing stream before requesting new one');
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Reset all state for fresh request
    isInitializedRef.current = false;
    hasRequestedPermissionRef.current = false;
    audioChunksRef.current = [];
    
    setStatus({
      microphone: false,
      recording: false,
      loading: true,
      errorMessage: null,
      permissionGranted: false,
      permissionDenied: false,
      streamHealthy: false
    });
    setStream(null);
    setIsStreamReady(false);
    setIsRecording(false);

    hasRequestedPermissionRef.current = true;

    try {
      log('Requesting getUserMedia permission...');
      
      // Check if we're in a secure context
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        throw new Error('Microphone requires HTTPS or localhost. Current: ' + window.location.href);
      }
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser does not support microphone access');
      }

      // Try to query permission state first (if supported)
      let permissionState = 'unknown';
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        permissionState = permission.state;
        log(`Current microphone permission state: ${permissionState}`);
        
        if (permissionState === 'denied') {
          throw new Error('Microphone permission is blocked in browser settings. Please enable it in site settings.');
        }
      } catch (permErr) {
        // Some browsers don't support permissions query, continue anyway
        log('Permission query not supported, proceeding with getUserMedia');
      }

      log('Calling getUserMedia - browser should show permission prompt...');
      
      const streamPromise = navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        },
        video: false
      });

      log('getUserMedia promise created - waiting for user response...');

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Microphone request timed out')), 10000)
      );

      const audioStream = await Promise.race([streamPromise, timeoutPromise]);

      log('✓ Microphone permission granted');
      streamRef.current = audioStream;
      setStream(audioStream);

      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          log(`Recorded chunk: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.start(10000); // 10-second chunks
      setIsRecording(true);
      log('MediaRecorder started');

      setStatus(prev => ({
        ...prev,
        microphone: true,
        permissionGranted: true,
        loading: false,
        streamHealthy: true
      }));
      setIsStreamReady(true);
      isInitializedRef.current = true;
    } catch (err: unknown) {
      const errorName = (err as DOMException)?.name || 'UnknownError';
      let msg = 'Unable to access microphone. ';
      if (errorName === 'NotAllowedError') {
        msg = 'Microphone permission denied. Allow access and retry.';
        setStatus(prev => ({ ...prev, permissionDenied: true }));
      } else if (errorName === 'NotFoundError') {
        msg = 'No microphone found. Connect one and retry.';
      } else if (errorName === 'NotReadableError') {
        msg = 'Microphone in use by another app. Close it and retry.';
      } else {
        msg += (err as Error).message || 'Unknown error';
      }

      setStatus(prev => ({ 
        ...prev, 
        microphone: false, 
        loading: false, 
        errorMessage: msg,
        streamHealthy: false 
      }));
      streamRef.current = null;
      hasRequestedPermissionRef.current = false;
    }
  }, []);

  const stopMicrophone = useCallback((): Blob | null => {
    log('Stopping microphone...');
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setStream(null);
    setIsStreamReady(false);
    setIsRecording(false);

    const blob = audioChunksRef.current.length > 0
      ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
      : null;

    audioChunksRef.current = [];
    isInitializedRef.current = false;
    hasRequestedPermissionRef.current = false;

    setStatus(prev => ({
      ...prev,
      microphone: false,
      recording: false,
      permissionGranted: false,
      permissionDenied: false,
      errorMessage: null
    }));

    log(`Stopped recording. Blob size: ${blob?.size || 0} bytes`);
    return blob;
  }, []);

  const retryMicrophone = useCallback(() => {
    log('Retrying microphone with force restart');
    stopMicrophone();
    setStatus(prev => ({ ...prev, errorMessage: null, loading: true, streamHealthy: false }));
    log('Will start microphone in 500ms - browser should prompt again');
    setTimeout(() => {
      log('Calling startMicrophone(true) now');
      startMicrophone(true);
    }, 500);
  }, [stopMicrophone, startMicrophone]);

  const clearError = useCallback(() => {
    setStatus(prev => ({ ...prev, errorMessage: null }));
  }, []);

  // Stream health monitoring
  useEffect(() => {
    if (!stream || !isRecording) return;

    const checkHealth = () => {
      const streamHealthy = stream.active &&
        stream.getAudioTracks()[0]?.enabled &&
        mediaRecorderRef.current?.state === 'recording';

      setStatus(prev => ({ ...prev, streamHealthy }));

      if (!streamHealthy) {
        log('Stream unhealthy - tracks: ' + JSON.stringify(stream.getAudioTracks().map(t => ({enabled: t.enabled, readyState: t.readyState}))));
      }
    };

    const interval = setInterval(checkHealth, 5000);
    checkHealth(); // Initial check

    return () => {
      clearInterval(interval);
      setStatus(prev => ({ ...prev, streamHealthy: false }));
    };
  }, [stream, isRecording]);

  return {
    status,
    stream,
    isStreamReady,
    isRecording,
    streamHealthy: status.streamHealthy,
    startMicrophone,
    stopMicrophone,
    retryMicrophone,
    clearError
  };
};