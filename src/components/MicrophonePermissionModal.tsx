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
    <div className="modal-backdrop">
      <div className="modal-card max-w-md max-h-[92vh] flex flex-col">
        {/* MODAL HEADER */}
        <div className="bg-brand-gradient px-6 py-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/15 ring-1 ring-white/20 backdrop-blur-sm flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-2xs font-semibold uppercase tracking-wider text-brand-200">
                Step 3 of 3
              </div>
              <h2 className="text-lg font-semibold text-white tracking-tight2">
                Microphone Access
              </h2>
            </div>
          </div>
          <p className="text-brand-100 mt-2.5 text-sm leading-relaxed">
            Audio recording is required for proctoring during the exam.
          </p>
        </div>

        {/* MAIN CONTENT */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* AUDIO PREVIEW CONTAINER */}
          <div className="relative aspect-video bg-ink-950 rounded-xl overflow-hidden mb-5 ring-1 ring-ink-900/60">
            {/* Direct MediaRecorder stream - no DOM audio visualization needed */}

            {/* Loading overlay */}
            {status.loading && (
              <div className="absolute inset-0 bg-ink-950/90 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center text-white px-6">
                  <div className="relative w-14 h-14 mx-auto mb-3">
                    <div className="absolute inset-0 rounded-full border-2 border-white/15" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-brand-300 animate-spin" />
                  </div>
                  <p className="text-sm font-semibold mb-1">Requesting microphone access</p>
                  <p className="text-xs text-white/70">
                    Please allow microphone permission in your browser
                  </p>
                </div>
              </div>
            )}

            {isPermissionGranted && (
              <div className="absolute inset-0 bg-success-700/30 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-success-500/20 ring-2 ring-success-400/50 backdrop-blur-sm flex items-center justify-center">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1 tracking-tight2">
                  Microphone active
                </h3>
                <p className="text-xs text-success-50/85 mb-3">Audio stream healthy</p>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" />
                  <span className="text-2xs font-semibold uppercase tracking-wider text-white/95">
                    Live audio
                  </span>
                </div>
              </div>
            )}

            {isPermissionDenied && (
              <div className="absolute inset-0 bg-danger-900/85 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center text-white p-6 max-w-sm">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-danger-500/20 ring-2 ring-danger-400/40 flex items-center justify-center">
                    <MicOff className="w-7 h-7 text-danger-200" />
                  </div>
                  <h3 className="text-base font-semibold mb-1 tracking-tight2">Access denied</h3>
                  <p className="text-xs text-danger-100/85">
                    Enable microphone access in your browser site settings to continue.
                  </p>
                </div>
              </div>
            )}

            {isError && !isPermissionDenied && (
              <div className="absolute inset-0 bg-warning-900/85 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center text-white p-6">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-warning-300" />
                  <p className="text-sm font-semibold">{status.errorMessage}</p>
                </div>
              </div>
            )}

            {/* Fallback empty state */}
            {!status.loading && !isPermissionGranted && !isError && !isPermissionDenied && (
              <div className="absolute inset-0 bg-ink-950/70 flex items-center justify-center">
                <div className="text-center text-white/70">
                  <MicOff className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm font-medium">No microphone detected</p>
                </div>
              </div>
            )}
          </div>

          {/* Status & Instructions */}
          <div
            className={`p-4 rounded-xl mb-5 border ${
              isPermissionGranted
                ? 'bg-success-50 border-success-200'
                : isPermissionDenied || isError
                ? 'bg-danger-50 border-danger-200'
                : status.loading
                ? 'bg-brand-50 border-brand-200'
                : 'bg-ink-50 border-ink-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isPermissionGranted
                    ? 'bg-success-100 text-success-700'
                    : isPermissionDenied || isError
                    ? 'bg-danger-100 text-danger-700'
                    : status.loading
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-ink-100 text-ink-600'
                }`}
              >
                {isPermissionGranted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : isPermissionDenied || isError ? (
                  <MicOff className="w-4 h-4" />
                ) : status.loading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <MicOff className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    className={`text-2xs font-semibold uppercase tracking-wider ${
                      isPermissionGranted
                        ? 'text-success-700'
                        : isPermissionDenied || isError
                        ? 'text-danger-700'
                        : status.loading
                        ? 'text-brand-700'
                        : 'text-ink-600'
                    }`}
                  >
                    {isPermissionGranted
                      ? 'Microphone ready'
                      : isPermissionDenied
                      ? 'Permission denied'
                      : isError
                      ? 'Setup error'
                      : status.loading
                      ? 'Initializing'
                      : 'Not ready'}
                  </h3>
                  {isPermissionGranted && (
                    <span className="pill pill-success">Verified</span>
                  )}
                </div>
                <p
                  className={`text-sm font-medium mt-1 ${
                    isPermissionGranted
                      ? 'text-success-900'
                      : isPermissionDenied || isError
                      ? 'text-danger-900'
                      : 'text-ink-800'
                  }`}
                >
                  {isPermissionGranted
                    ? 'High-quality audio stream is active for proctoring.'
                    : isPermissionDenied
                    ? 'Microphone access blocked. Enable it in browser settings.'
                    : isError
                    ? status.errorMessage || 'Unknown error'
                    : status.loading
                    ? 'Please wait while we set up your microphone…'
                    : 'Connect a microphone and refresh the page.'}
                </p>
              </div>
            </div>
          </div>

          {/* Requirements List */}
          <div className="mb-5">
            <h4 className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
              Best practices
            </h4>
            <ul className="space-y-1.5 text-sm text-ink-700">
              {[
                'Click "Allow" when your browser prompts you',
                'Use a built-in microphone or headset (no external speakers)',
                'Stay in a quiet environment and mute other applications',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-success-600 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5">
            {isPermissionGranted ? (
              <button
                onClick={() => onComplete()}
                className="btn btn-lg w-full bg-success-600 text-white shadow-soft hover:bg-success-700"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Start exam</span>
              </button>
            ) : status.loading ? (
              <div className="w-full p-3 text-center rounded-lg bg-brand-50 border border-brand-200">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium text-brand-800 uppercase tracking-wider">
                    Waiting for permission
                  </span>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => retryMicrophone()}
                  disabled={status.loading}
                  className="btn btn-md btn-primary w-full"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry microphone</span>
                </button>
                <button
                  onClick={async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false,
                      });
                      stream.getTracks().forEach((t) => t.stop());
                      alert('Microphone access successful — your browser supports it.');
                    } catch (err: any) {
                      alert(`Microphone test failed: ${err.message || err.name}`);
                    }
                  }}
                  className="btn btn-md btn-secondary w-full"
                >
                  <span>Test microphone access</span>
                </button>
              </>
            )}

            {isPermissionDenied && onRetry && (
              <button
                onClick={onRetry}
                className="btn btn-sm btn-ghost w-full"
              >
                Back
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
