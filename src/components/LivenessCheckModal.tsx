import { Camera, CheckCircle, XCircle, RefreshCw, UserCheck } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';

interface LivenessCheckModalProps {
  isOpen: boolean;
  isChecking: boolean;
  isPassed: boolean;
  isFailed: boolean;
  progress: number;
  instruction: string;
  currentStep?: { name: string; type: string } | null;
  stepIndex?: number;
  totalSteps?: number;
  videoRef: React.RefCallback<HTMLVideoElement>;
  onStartCheck: () => void;
  onRetry: () => void;
  onContinue?: () => void;
}

export const LivenessCheckModal = ({
  isOpen,
  isChecking,
  isPassed,
  isFailed,
  progress,
  instruction,
  currentStep,
  stepIndex = 0,
  totalSteps = 0,
  videoRef,
  onStartCheck,
  onRetry,
  onContinue
}: LivenessCheckModalProps) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const streamRef = useRef<MediaStream | null>(null);

  //  const logDebug = (msg: string) => {
  //  console.log('[LivenessCheckModal]', msg);
  // Don't call setDebugInfo during render - only in effects
  // };

  //  console.log('[LivenessCheckModal] Render - isOpen:', isOpen, 'isChecking:', isChecking, 'isPassed:', isPassed, 'isFailed:', isFailed);

  // Callback ref for video element
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    localVideoRef.current = element;
    console.log('[LivenessCheckModal] Video ref callback:', element ? 'element attached' : 'null');
  }, []);

  // Setup camera when modal opens and video element is ready
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const setupCamera = async () => {
      try {
        setCameraError(null);

        // Check if getUserMedia is available
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Browser does not support getUserMedia');
        }

        // Add a timeout to getUserMedia as it can sometimes hang
        const streamPromise = navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Camera request timed out')), 10000)
        );

        const stream = await Promise.race([streamPromise, timeoutPromise]);
        streamRef.current = stream;

        // Wait for video element
        if (!localVideoRef.current) {
          throw new Error('Video element not ready');
        }

        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;

        localVideoRef.current.onloadeddata = () => {
          if (localVideoRef.current && isMounted) {
            localVideoRef.current.play().then(() => {
              setCameraReady(true);
            }).catch(err => {
              console.error('[LivenessCheckModal] Play error:', err);
              if (err.name !== 'AbortError') {
                setCameraError('Failed to play video: ' + err.message);
              }
            });
          }
        };

        localVideoRef.current.onerror = (_e) => {
          setCameraError('Video playback error occurred');
        };

        // Pass ref to parent for face detection
        if (videoRef) {
          videoRef(localVideoRef.current);
        }
      } catch (err: unknown) {
        console.error('[LivenessCheckModal] Camera setup error:', err);
        let errorMsg = err instanceof Error ? err.message : 'Failed to access camera';
        if (err instanceof Error && err.name === 'NotAllowedError') errorMsg = 'Camera permission denied';
        if (err instanceof Error && err.name === 'NotFoundError') errorMsg = 'No camera found';
        setCameraError(errorMsg);
      }
    };

    setupCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      setCameraReady(false);
    };
  }, [isOpen, videoRef, isPassed]);

  if (!isOpen) {
    console.log('[LivenessCheckModal] Not open, returning null');
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card max-w-md max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-brand-gradient px-6 py-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/15 ring-1 ring-white/20 backdrop-blur-sm flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-2xs font-semibold uppercase tracking-wider text-brand-200">
                Step 2 of 3
              </div>
              <h2 className="text-lg font-semibold text-white tracking-tight2">
                Identity Verification
              </h2>
            </div>
          </div>
          <p className="text-brand-100 mt-2.5 text-sm leading-relaxed">
            Quick liveness check to verify it's really you taking the exam.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Video Container */}
          <div className="relative aspect-video bg-ink-950 rounded-xl overflow-hidden mb-5 ring-1 ring-ink-900/60">
            <video
              ref={setVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform scale-x-[-1]"
              style={{ visibility: 'visible', opacity: 1, display: 'block' }}
            />

            {/* Camera error display */}
            {cameraError && (
              <div className="absolute inset-0 bg-danger-950/85 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center text-white p-4">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-danger-500/15 ring-1 ring-danger-500/40 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-danger-300" />
                  </div>
                  <p className="text-sm font-semibold mb-1">Camera error</p>
                  <p className="text-xs text-danger-200">{cameraError}</p>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="relative w-12 h-12 mx-auto mb-3">
                    <div className="absolute inset-0 rounded-full border-2 border-white/15" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-brand-300 animate-spin" />
                  </div>
                  <p className="text-xs font-medium tracking-wide uppercase text-white/80">
                    Setting up camera
                  </p>
                </div>
              </div>
            )}

            {/* Initial state */}
            {!cameraReady && !isChecking && !isPassed && !isFailed && !cameraError && (
              <div className="absolute inset-0 bg-ink-950/40 flex items-center justify-center pointer-events-none">
                <div className="text-center text-white">
                  <Camera className="w-10 h-10 mx-auto mb-2 text-white/60" />
                  <p className="text-sm font-medium">Camera preview</p>
                </div>
              </div>
            )}

            {/* Vignette */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

            {/* Status pill */}
            <div className="absolute top-2.5 right-2.5 z-10">
              <div
                className={`px-2.5 py-1 rounded-md text-2xs font-semibold uppercase tracking-wider backdrop-blur-sm ${
                  isChecking
                    ? 'bg-brand-700/85 text-white animate-pulse-soft'
                    : isPassed
                    ? 'bg-success-600/85 text-white'
                    : isFailed
                    ? 'bg-danger-600/85 text-white'
                    : 'bg-ink-900/70 text-white/90'
                }`}
              >
                {isChecking ? 'Checking…' : isPassed ? 'Passed' : isFailed ? 'Failed' : 'Ready'}
              </div>
            </div>

            {/* Live indicator */}
            <div className="absolute top-2.5 left-2.5 z-10">
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse-soft" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/90">
                  Camera Active
                </span>
              </div>
            </div>

            {isChecking && (
              <>
                {/* Progress overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                  <div
                    className="h-full bg-brand-gradient transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Face frame guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-44 h-52 rounded-2xl ring-2 ring-dashed ring-white/55 animate-pulse-soft">
                    <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white/80 rounded-tl-md" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white/80 rounded-tr-md" />
                    <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white/80 rounded-bl-md" />
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white/80 rounded-br-md" />
                  </div>
                </div>
              </>
            )}

            {isPassed && (
              <div className="absolute inset-0 bg-success-600/40 backdrop-blur-[2px] flex items-center justify-center">
                <div className="text-center text-white p-4 animate-scale-in">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-success-500 ring-4 ring-white/30 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-semibold mb-1 tracking-tight2">Verified</p>
                  <p className="text-xs text-success-50/90">Identity confirmed</p>
                </div>
              </div>
            )}

            {isFailed && (
              <div className="absolute inset-0 bg-danger-600/40 backdrop-blur-[2px] flex items-center justify-center">
                <div className="text-center text-white p-4 animate-scale-in">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-danger-500 ring-4 ring-white/30 flex items-center justify-center">
                    <XCircle className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-semibold mb-1 tracking-tight2">Verification failed</p>
                  <p className="text-xs text-danger-50/90">Try again or contact support</p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div
            className={`p-4 rounded-xl mb-5 border ${
              isFailed
                ? 'bg-danger-50 border-danger-200'
                : isPassed
                ? 'bg-success-50 border-success-200'
                : 'bg-brand-50/60 border-brand-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isFailed
                    ? 'bg-danger-100 text-danger-700'
                    : isPassed
                    ? 'bg-success-100 text-success-700'
                    : 'bg-brand-100 text-brand-700'
                }`}
              >
                {isFailed ? (
                  <XCircle className="w-4 h-4" />
                ) : isPassed ? (
                  <CheckCircle className="w-4 h-4" />
                ) : !currentStep ? (
                  <Camera className="w-4 h-4" />
                ) : currentStep.type === 'pose' ? (
                  <RefreshCw className="w-4 h-4" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-2xs font-semibold uppercase tracking-wider ${
                      isFailed
                        ? 'text-danger-700'
                        : isPassed
                        ? 'text-success-700'
                        : 'text-brand-700'
                    }`}
                  >
                    {isFailed
                      ? 'Verification failed'
                      : isPassed
                      ? 'Success'
                      : isChecking
                      ? `Step ${stepIndex + 1} of ${totalSteps}`
                      : 'Ready'}
                  </p>
                  {isChecking && totalSteps > 0 && (
                    <span className="text-2xs font-mono tabular-nums text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full">
                      {Math.round((stepIndex / totalSteps) * 100)}%
                    </span>
                  )}
                </div>
                <p
                  className={`text-sm font-medium mt-1 ${
                    isFailed
                      ? 'text-danger-900'
                      : isPassed
                      ? 'text-success-900'
                      : 'text-ink-900'
                  }`}
                >
                  {instruction}
                </p>
              </div>
            </div>
          </div>

          {/* Requirements */}
          {!isChecking && !isPassed && !isFailed && (
            <div className="mb-5">
              <h3 className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
                Before you start
              </h3>
              <ul className="space-y-1.5 text-sm text-ink-700">
                {[
                  'Position your face clearly in front of the camera',
                  'Blink naturally during the verification',
                  'Move your head slightly as prompted',
                  'Ensure good lighting on your face',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-success-600 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div>
            {!isChecking && !isPassed && !isFailed && (
              <button onClick={onStartCheck} className="btn btn-md btn-primary w-full">
                <Camera className="w-4 h-4" />
                <span>Start verification</span>
              </button>
            )}

            {isChecking && (
              <div className="text-center text-xs text-ink-500">
                Please wait while we verify your identity…
              </div>
            )}

            {isFailed && (
              <button onClick={onRetry} className="btn btn-md btn-primary w-full">
                <RefreshCw className="w-4 h-4" />
                <span>Try again</span>
              </button>
            )}

            {isPassed && onContinue && (
              <button
                onClick={onContinue}
                className="btn btn-md w-full bg-success-600 text-white shadow-soft hover:bg-success-700"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Start exam</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
