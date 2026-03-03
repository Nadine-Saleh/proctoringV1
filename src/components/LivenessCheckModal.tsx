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
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const streamRef = useRef<MediaStream | null>(null);

  const logDebug = (msg: string) => {
    console.log('[LivenessCheckModal]', msg);
    // Don't call setDebugInfo during render - only in effects
  };

  console.log('[LivenessCheckModal] Render - isOpen:', isOpen, 'isChecking:', isChecking, 'isPassed:', isPassed, 'isFailed:', isFailed);

  // Callback ref for video element
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    localVideoRef.current = element;
    console.log('[LivenessCheckModal] Video ref callback:', element ? 'element attached' : 'null');
  }, []);

  // Setup camera when modal opens and video element is ready
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setDebugInfo('Modal open, waiting for video...');

    const setupCamera = async () => {
      try {
        setDebugInfo('Setting up camera...');
        setCameraError(null);

        // Check if getUserMedia is available
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Browser does not support getUserMedia');
        }

        setDebugInfo('Requesting camera permission...');

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
        setDebugInfo('Camera stream obtained');

        // Wait for video element
        if (!localVideoRef.current) {
          throw new Error('Video element not ready');
        }

        setDebugInfo('Attaching stream to video element');
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;

        localVideoRef.current.onloadeddata = () => {
          setDebugInfo('Video loaded');
          if (localVideoRef.current && isMounted) {
            localVideoRef.current.play().then(() => {
              setCameraReady(true);
              setDebugInfo('Camera ready and playing');
            }).catch(err => {
              console.error('[LivenessCheckModal] Play error:', err);
              if (err.name !== 'AbortError') {
                setCameraError('Failed to play video: ' + err.message);
              }
            });
          }
        };

        localVideoRef.current.onerror = (e) => {
          setDebugInfo('Video error occurred');
          setCameraError('Video playback error occurred');
        };

        // Pass ref to parent for face detection
        if (videoRef) {
          videoRef(localVideoRef.current);
          setDebugInfo('Video ref passed to parent');
        }
      } catch (err: any) {
        setDebugInfo('Error: ' + err.message);
        console.error('[LivenessCheckModal] Camera setup error:', err);
        let errorMsg = err.message || 'Failed to access camera';
        if (err.name === 'NotAllowedError') errorMsg = 'Camera permission denied';
        if (err.name === 'NotFoundError') errorMsg = 'No camera found';
        setCameraError(errorMsg);
      }
    };

    setupCamera();

    return () => {
      setDebugInfo('Cleaning up...');
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden" style={{ minHeight: '400px' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-center space-x-3">
            <UserCheck className="w-8 h-8 text-white" />
            <h2 className="text-2xl font-bold text-white">Liveness Verification</h2>
          </div>
          <p className="text-blue-100 mt-2">
            Verify your identity before starting the exam
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Debug Info */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs font-mono text-yellow-800">
            <strong>Debug:</strong> {debugInfo} | cameraReady: {cameraReady ? 'yes' : 'no'} | video element: {localVideoRef.current ? 'yes' : 'no'}
          </div>
          
          {/* Video Container */}
          <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden mb-6 border-2 border-blue-500">
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
                <div className="text-center text-white p-6">
                  <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                  <p className="text-lg font-semibold mb-2">Camera Error</p>
                  <p className="text-sm text-red-200">{cameraError}</p>
                </div>
              </div>
            )}
            
            {/* Loading indicator */}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm">Setting up camera...</p>
                </div>
              </div>
            )}

            {/* Overlay for initial state - only show before camera starts */}
            {!cameraReady && !isChecking && !isPassed && !isFailed && !cameraError && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                <div className="text-center text-white p-6">
                  <Camera className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-semibold mb-2">Camera Preview</p>
                  <p className="text-sm text-gray-300">
                    Position your face in the frame
                  </p>
                </div>
              </div>
            )}

            {/* Show status badge */}
            <div className="absolute top-4 right-4 z-10">
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                isChecking ? 'bg-blue-600 text-white animate-pulse' :
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
                <div className="text-center text-white p-6">
                  <CheckCircle className="w-20 h-20 mx-auto mb-4" />
                  <p className="text-2xl font-bold mb-2">Verification Successful!</p>
                  <p className="text-sm text-green-100">
                    Your identity has been verified
                  </p>
                </div>
              </div>
            )}

            {isFailed && (
              <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                <div className="text-center text-white p-6">
                  <XCircle className="w-20 h-20 mx-auto mb-4" />
                  <p className="text-2xl font-bold mb-2">Verification Failed</p>
                  <p className="text-sm text-red-100">
                    Please try again or contact support
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className={`p-4 rounded-lg mb-6 ${
            isFailed 
              ? 'bg-red-50 border border-red-200' 
              : isPassed 
              ? 'bg-green-50 border border-green-200'
              : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-start space-x-3">
              {isFailed ? (
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              ) : isPassed ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <div className="mt-0.5">
                  {!currentStep ? (
                    <Camera className="w-6 h-6 text-blue-600" />
                  ) : currentStep.type === 'pose' ? (
                    <RefreshCw className="w-6 h-6 text-blue-600" />
                  ) : currentStep.type === 'expression' ? (
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Camera className="w-6 h-6 text-blue-600" />
                  )}
                </div>
              )}
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <p className={`font-semibold ${
                    isFailed ? 'text-red-800' : isPassed ? 'text-green-800' : 'text-blue-800'
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
                <p className={`text-lg font-bold mt-1 ${
                  isFailed ? 'text-red-700' : isPassed ? 'text-green-700' : 'text-blue-900'
                }`}>
                  {instruction}
                </p>
              </div>
            </div>
          </div>

          {/* Requirements */}
          {!isChecking && !isPassed && !isFailed && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Requirements:</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Position your face clearly in front of the camera</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Blink naturally during the verification</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Move your head slightly as prompted</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
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
                className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
              >
                <Camera className="w-5 h-5" />
                <span>Start Verification</span>
              </button>
            )}

            {isChecking && (
              <div className="text-center">
                <p className="text-sm text-gray-500">Please wait while we verify your identity...</p>
              </div>
            )}

            {isFailed && (
              <button
                onClick={onRetry}
                className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Try Again</span>
              </button>
            )}

            {isPassed && onContinue && (
              <button
                onClick={onContinue}
                className="flex items-center space-x-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Start Exam</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
