import { Mic, MicOff, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useMicrophoneContext } from '../context/MicrophoneContext';

interface MicrophonePermissionModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onRetry?: () => void;
  onPermissionGranted?: () => void;
}

// ─── ENFORCES MICROPHONE PERMISSION IN PROCTORING FLOW ───
// Purpose: Mandatory 3rd step before exam start. Blocks progress until mic access granted.
// How: Auto-triggers useMicrophone hook, shows visual states, requires explicit "Start Exam" click.
export const MicrophonePermissionModal = ({
  isOpen,
  onComplete,
  onRetry
}: MicrophonePermissionModalProps) => {
  // WHY: Hook provides all mic state (loading, granted, denied, errors) + controls
  // HOW: useMicrophoneContext provides shared microphone state across components
  const {
    status,
    startMicrophone,
    retryMicrophone
  } = useMicrophoneContext();

  // ─── PERMISSION STATUS LOGIC ──────────────────
  // WHY: React to permission state changes for logging/debugging
  // HOW: Logs when permission granted (proctoring flow milestone)
  useEffect(() => {
    const isPermissionGranted = status.microphone;
    if (isPermissionGranted) {
      console.log('[Modal] Permission granted, showing Start Exam');
    }
  }, [status.microphone]);

  // ─── AUTO-START & CLEANUP ─────────────────────
  // WHY: Seamless UX - mic starts immediately when modal opens (step 3 of proctoring flow)
  // HOW: Start once when modal opens, user controls retry via button
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      // Always force a fresh start when modal opens
      hasAutoStartedRef.current = false;
    }
    
    if (isOpen && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      console.log('[Modal] Auto-starting microphone (first time)');
      // Add a small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        console.log('[Modal] Calling startMicrophone(true)...');
        startMicrophone(true);
      }, 300);
      return () => clearTimeout(timer);
    }

    // Reset ref when modal closes
    if (!isOpen) {
      hasAutoStartedRef.current = false;
    }
  }, [isOpen, startMicrophone]);

  // ─── RENDER CONDITIONS ───────────────────────
  if (!isOpen) return null;

  // WHY: Derived state for conditional UI rendering (loading/success/error states)
  // HOW: Direct destructuring from hook status for performance
  const isPermissionGranted = status.microphone && status.streamHealthy;
  const isPermissionDenied = status.permissionDenied;
  const isError = !!status.errorMessage;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* MODAL HEADER */}
        {/* Purpose: Brand the proctoring step, explain requirement */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Mic className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Microphone Access</h2>
          </div>
          <p className="text-purple-100 mt-1 text-sm">
            Required for proctoring verification
          </p>
        </div>

        {/* MAIN CONTENT */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* AUDIO PREVIEW CONTAINER */}
          {/* Purpose: Visual feedback area (no real audio viz needed - direct stream recording) */}
          {/* How: Status overlays on black canvas, no <audio> element */}
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-6 border-2 border-purple-500">
            {/* Direct MediaRecorder stream - no DOM audio visualization needed */}

            {/* Loading overlay */}
            {status.loading && (
              <div className="absolute inset-0 bg-gradient-to-b from-purple-900/80 to-black/80 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-lg font-semibold mb-2">Requesting microphone access...</p>
                  <p className="text-sm opacity-90">
                    Please allow microphone permission when prompted
                  </p>
                </div>
              </div>
            )}

            {isPermissionGranted && (
              <div className="absolute inset-0 bg-gradient-to-r from-green-900/80 to-emerald-900/80 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 bg-green-500/20 rounded-2xl flex items-center justify-center mb-4 border-4 border-green-500/50">
                  <Mic className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Microphone Active ✓</h3>
                <p className="text-green-100 text-sm mb-6">Click "Start Exam" to continue</p>
                <div className="w-full bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
                    <span className="text-xs font-medium text-green-200">Live Audio</span>
                  </div>
                  <p className="text-xs text-green-100">Permission granted successfully</p>
                </div>
              </div>
            )}

            {isPermissionDenied && (
              <div className="absolute inset-0 bg-gradient-to-b from-red-900/90 to-red-900/80 flex items-center justify-center">
                <div className="text-center text-white p-8 max-w-sm">
                  <MicOff className="w-20 h-20 mx-auto mb-4 text-red-400" />
                  <h3 className="text-2xl font-bold mb-2">Microphone Access Denied</h3>
                  <p className="text-red-100 mb-6">
                    Microphone permission is required for proctoring. 
                    Please enable it in your browser settings.
                  </p>
                </div>
              </div>
            )}

            {isError && !isPermissionDenied && (
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-900/90 to-yellow-900/80 flex items-center justify-center">
                <div className="text-center text-white p-6">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-300" />
                  <p className="text-lg font-semibold mb-2">{status.errorMessage}</p>
                </div>
              </div>
            )}

            {/* Fallback empty state */}
            {!status.loading && !isPermissionGranted && !isError && !isPermissionDenied && (
              <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 flex items-center justify-center">
                <div className="text-center text-gray-300">
                  <MicOff className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-lg font-semibold">No Microphone Detected</p>
                </div>
              </div>
            )}
          </div>

          {/* Status & Instructions */}
          <div className={`p-4 rounded-xl mb-6 ${
            isPermissionGranted ? 'bg-green-50 border-2 border-green-200' :
            isPermissionDenied || isError ? 'bg-red-50 border-2 border-red-200' :
            status.loading ? 'bg-purple-50 border-2 border-purple-200' :
            'bg-gray-50 border-2 border-gray-200'
          }`}>
            <div className="flex items-start space-x-3">
              {isPermissionGranted ? (
                <CheckCircle className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
              ) : isPermissionDenied || isError ? (
                <MicOff className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
              ) : status.loading ? (
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mt-0.5 flex-shrink-0" />
              ) : (
                <MicOff className="w-6 h-6 text-gray-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-semibold text-sm ${
                    isPermissionGranted ? 'text-green-800' :
                    isPermissionDenied || isError ? 'text-red-800' :
                    status.loading ? 'text-purple-800' : 'text-gray-800'
                  }`}>
                    {isPermissionGranted ? 'Microphone Ready' :
                    isPermissionDenied ? 'Permission Denied' :
                    isError ? 'Setup Error' :
                    status.loading ? 'Initializing' : 'Not Ready'}
                  </h3>
                  {isPermissionGranted && (
                    <div className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                      ✓ Verified
                    </div>
                  )}
                </div>
                <p className={`text-sm ${
                  isPermissionGranted ? 'text-green-700' :
                  isPermissionDenied || isError ? 'text-red-700' :
                  'text-gray-700'
                }`}>
                  {isPermissionGranted ? 'High quality audio stream active for proctoring.' :
                  isPermissionDenied ? 'Microphone access blocked. Enable in browser settings.' :
                  isError ? status.errorMessage || 'Unknown error' :
                  status.loading ? 'Please wait while we setup your microphone...' :
                  'Connect a microphone and refresh the page.'}
                </p>
              </div>
            </div>
          </div>

          {/* Requirements List */}
          <div className="mb-6 space-y-2">
            <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center space-x-2">
              <span>Requirements:</span>
            </h4>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span>Click "Allow" when browser asks for microphone permission</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span>Use built-in microphone or headset (no external speakers)</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span>Quiet environment (mute other applications)</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3">
            {isPermissionGranted ? (
              <button
                onClick={() => {
                  onComplete();
                }}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Start Exam</span>
              </button>
            ) : status.loading ? (
              <div className="w-full p-3 text-center bg-purple-100 border-2 border-purple-300 rounded-xl">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-purple-800">Waiting for permission...</span>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    console.log('[Modal] Retry Microphone button clicked');
                    retryMicrophone(); // This already calls startMicrophone(true) internally
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={status.loading}
                >
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Retry Microphone</span>
                </button>
                <button
                  onClick={async () => {
                    console.log('[Modal] Direct mic test - calling getUserMedia...');
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                      console.log('[Modal] Direct test SUCCESS - mic access granted');
                      stream.getTracks().forEach(t => t.stop());
                      alert('Microphone access successful! Browser supports microphone.');
                    } catch (err: any) {
                      console.error('[Modal] Direct test FAILED:', err);
                      alert(`Microphone test failed: ${err.message || err.name}`);
                    }
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <span>Test Microphone Access</span>
                </button>
              </>
            )}

            {isPermissionDenied && (
              <div className="text-center py-4 px-2">
                <p className="text-xs text-gray-500 mb-2">
                  Browser blocked microphone access. Check site settings.
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={onRetry}
                    className="flex-1 px-3 py-2 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded font-medium"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
