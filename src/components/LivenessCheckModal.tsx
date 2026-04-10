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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col" style={{ minHeight: '300px' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <UserCheck className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Liveness Verification</h2>
          </div>
          <p className="text-blue-100 mt-1 text-sm">
            Verify your identity before starting the exam
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Debug Info */}
          {/* <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs font-mono text-yellow-800">
            <strong>Debug:</strong> {debugInfo} | cameraReady: {cameraReady ? 'yes' : 'no'} | video element: {localVideoRef.current ? 'yes' : 'no'}
          </div> */}

          {/* Video Container */}
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4 border-2 border-blue-500">
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
              <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center">
                <div className="text-center text-white p-4">
                  <XCircle className="w-12 h-12 mx-auto mb-2 text-red-400" />
                  <p className="text-base font-semibold mb-1">Camera Error</p>
                  <p className="text-xs text-red-200">{cameraError}</p>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Setting up camera...</p>
                </div>
              </div>
            )}

            {/* Overlay for initial state - only show before camera starts */}
            {!cameraReady && !isChecking && !isPassed && !isFailed && !cameraError && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                <div className="text-center text-white p-4">
                  <Camera className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-base font-semibold mb-1">Camera Preview</p>
                  <p className="text-xs text-gray-300">
                    Position your face in the frame
                  </p>
                </div>
              </div>
            )}

            {/* Show status badge */}
            <div className="absolute top-4 right-4 z-10">
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${isChecking ? 'bg-blue-600 text-white animate-pulse' :
                isPassed ? 'bg-green-600 text-white' :
                  isFailed ? 'bg-red-600 text-white' :
                    'bg-gray-600 text-white'
                }`}>
                {isChecking ? 'CHECKING...' : isPassed ? 'PASSED' : isFailed ? 'FAILED' : 'READY'}
              </div>
            </div>

            {/* Camera indicator */}
            <div className="absolute top-4 left-4 z-10">
              <div className="bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
                Camera Active
              </div>
            </div>

            {isChecking && (
              <>
                {/* Progress overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Face frame guide */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white/50 rounded-lg animate-pulse" />
                </div>

                {/* Status indicator */}
                <div className="absolute top-4 right-4">
                  <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
                    Verifying...
                  </div>
                </div>
              </>
            )}

            {isPassed && (
              <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                <div className="text-center text-white p-4">
                  <CheckCircle className="w-16 h-16 mx-auto mb-3" />
                  <p className="text-xl font-bold mb-1">Verification Successful!</p>
                  <p className="text-xs text-green-100">
                    Your identity has been verified
                  </p>
                </div>
              </div>
            )}

            {isFailed && (
              <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                <div className="text-center text-white p-4">
                  <XCircle className="w-16 h-16 mx-auto mb-3" />
                  <p className="text-xl font-bold mb-1">Verification Failed</p>
                  <p className="text-xs text-red-100">
                    Please try again or contact support
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className={`p-3 rounded-lg mb-4 ${isFailed
            ? 'bg-red-50 border border-red-200'
            : isPassed
              ? 'bg-green-50 border border-green-200'
              : 'bg-blue-50 border border-blue-200'
            }`}>
            <div className="flex items-start space-x-3">
              {isFailed ? (
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              ) : isPassed ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <div className="mt-0.5">
                  {!currentStep ? (
                    <Camera className="w-5 h-5 text-blue-600" />
                  ) : currentStep.type === 'pose' ? (
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                  ) : currentStep.type === 'expression' ? (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Camera className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              )}
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <p className={`font-semibold text-sm ${isFailed ? 'text-red-800' : isPassed ? 'text-green-800' : 'text-blue-800'
                    }`}>
                    {isFailed ? 'Verification Failed' : isPassed ? 'Success' :
                      isChecking ? `Step ${stepIndex + 1} of ${totalSteps}` : 'Ready'}
                  </p>
                  {isChecking && totalSteps > 0 && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      {Math.round(((stepIndex) / totalSteps) * 100)}% Complete
                    </span>
                  )}
                </div>
                <p className={`text-base font-bold mt-1 ${isFailed ? 'text-red-700' : isPassed ? 'text-green-700' : 'text-blue-900'
                  }`}>
                  {instruction}
                </p>
              </div>
            </div>
          </div>

          {/* Requirements */}
          {!isChecking && !isPassed && !isFailed && (
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">Requirements:</h3>
              <ul className="space-y-1 text-xs text-gray-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>Position your face clearly in front of the camera</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>Blink naturally during the verification</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>Move your head slightly as prompted</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>Ensure good lighting on your face</span>
                </li>
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-center space-x-4">
            {!isChecking && !isPassed && !isFailed && (
              <button
                onClick={onStartCheck}
                className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors text-sm"
              >
                <Camera className="w-4 h-4" />
                <span>Start Verification</span>
              </button>
            )}

            {isChecking && (
              <div className="text-center">
                <p className="text-xs text-gray-500">Please wait while we verify your identity...</p>
              </div>
            )}

            {isFailed && (
              <button
                onClick={onRetry}
                className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
            )}

            {isPassed && onContinue && (
              <button
                onClick={onContinue}
                className="flex items-center space-x-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Start Exam</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
