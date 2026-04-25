import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Camera, ShieldCheck, AlertCircle, Loader2, RefreshCw, Info } from 'lucide-react';
import { IdentityVerificationService, type JoinExamResponse } from '../../services/IdentityVerificationService';
import { useReferenceCapture } from '../../hooks/useReferenceCapture';
import { supabase } from '../../lib/supabase/client';

type Step = 'privacy' | 'capture' | 'verifying' | 'failed' | 'blocked';

export const VerifyIdentity = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const joinData = (location.state as { joinData?: JoinExamResponse } | null)?.joinData;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>('privacy');
  const [attemptsRemaining, setAttemptsRemaining] = useState(
    joinData?.verification_attempts_remaining ?? 3
  );
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { status: captureStatus, error: captureError, captureReference } =
    useReferenceCapture();

  const requiresCapture = joinData?.requires_reference_capture ?? true;

  // Redirect guard: if session is already past verification, skip to the right screen
  useEffect(() => {
    if (!sessionId) return;
    supabase
      .from('exam_sessions')
      .select('status')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.status === 'in_progress') navigate(`/exam/${sessionId}`, { replace: true });
        else if (data.status === 'submitted' || data.status === 'auto_submitted') navigate(`/exam/${sessionId}/results`, { replace: true });
        else if (data.status === 'verified') navigate(`/exam/${sessionId}/ready`, { replace: true, state: { joinData } });
        else if (data.status === 'verification_blocked') setStep('blocked');
      });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start camera when entering capture or verify step
  useEffect(() => {
    if (step !== 'capture' && step !== 'verifying' && step !== 'failed') {
      releaseCamera();
      return;
    }
    startCamera();
    return releaseCamera;
  }, [step]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setVerifyError('Camera access denied. Please allow camera access and retry.');
    }
  };

  const releaseCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleCaptureReference = async () => {
    if (!videoRef.current) return;
    const ok = await captureReference(videoRef.current);
    if (ok) {
      await handleVerify();
    }
  };

  const handleVerify = async () => {
    if (!videoRef.current || !sessionId) return;
    setIsVerifying(true);
    setVerifyError(null);

    const embedding = await IdentityVerificationService.extractEmbedding(videoRef.current);
    if (!embedding) {
      setIsVerifying(false);
      setVerifyError('No face detected. Position your face in the camera and try again.');
      return;
    }

    const result = await IdentityVerificationService.verifyIdentity(sessionId, embedding);
    setIsVerifying(false);

    if (!result.success || !result.data) {
      setVerifyError(result.error ?? 'Verification failed');
      return;
    }

    const { outcome, blocked, attempts_remaining } = result.data;
    setAttemptsRemaining(attempts_remaining);

    if (blocked) {
      releaseCamera();
      setStep('blocked');
      return;
    }

    if (outcome === 'pass') {
      releaseCamera();
      navigate(`/exam/${sessionId}/ready`, { state: { joinData } });
    } else {
      setStep('failed');
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  if (step === 'privacy') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center px-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center w-14 h-14 bg-blue-100 rounded-xl mb-6 mx-auto">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Identity Verification</h1>
          {joinData && (
            <p className="text-gray-500 text-center mb-6">
              {joinData.exam.title}
            </p>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Privacy notice (FR-032)</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Your camera will be used to verify your identity.</li>
                <li>Only a mathematical face descriptor is stored — never a photo.</li>
                <li>The descriptor cannot be reversed into an image.</li>
                <li>You have {attemptsRemaining} verification attempt{attemptsRemaining !== 1 ? 's' : ''} for this exam.</li>
              </ul>
            </div>
          </div>

          <button
            onClick={() => setStep(requiresCapture ? 'capture' : 'verifying')}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            {requiresCapture ? 'Set Up Face Verification' : 'Start Verification'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'blocked') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Verification Blocked</h2>
          <p className="text-gray-600 mb-6">
            You have exhausted all verification attempts for this exam. Your instructor has been
            notified. Please contact them for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          {step === 'capture' ? 'Capture Your Face' : 'Verify Your Identity'}
        </h1>
        <p className="text-gray-500 text-center mb-6">
          {step === 'capture'
            ? 'Position your face clearly in the frame, then click Capture.'
            : `Position your face in the frame. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`}
        </p>

        {(verifyError || captureError) && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{verifyError ?? captureError}</p>
          </div>
        )}

        <div className="relative bg-gray-900 rounded-xl overflow-hidden mb-6 aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            aria-label="Camera feed for identity verification"
          />
          {(isVerifying || captureStatus === 'capturing' || captureStatus === 'processing') && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>{captureStatus === 'processing' ? 'Processing…' : 'Analyzing face…'}</p>
              </div>
            </div>
          )}
          {/* Face guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-56 border-2 border-white/40 rounded-full opacity-60" />
          </div>
        </div>

        {step === 'capture' && (
          <button
            onClick={handleCaptureReference}
            disabled={captureStatus === 'capturing' || captureStatus === 'processing'}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {captureStatus === 'capturing' || captureStatus === 'processing' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {captureStatus === 'processing' ? 'Saving…' : 'Capturing…'}
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                Capture &amp; Verify
              </>
            )}
          </button>
        )}

        {(step === 'verifying' || step === 'failed') && (
          <button
            onClick={() => handleVerify()}
            disabled={isVerifying}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                {step === 'failed' ? <RefreshCw className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                {step === 'failed' ? 'Retry Verification' : 'Confirm Identity'}
              </>
            )}
          </button>
        )}

        {step === 'failed' && (
          <p className="text-sm text-gray-500 mt-4 text-center">
            Tip: Ensure good lighting and face the camera directly.
          </p>
        )}
      </div>
    </div>
  );
};
