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
      <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg card p-8 shadow-elevated animate-fade-in-up">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-gradient shadow-elevated mb-5 mx-auto">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>

          <h1 className="text-2xl font-semibold text-ink-900 text-center tracking-tight2 mb-1">
            Identity verification
          </h1>
          {joinData && (
            <p className="text-sm text-ink-600 text-center mb-6">
              {joinData.exam.title}
            </p>
          )}

          <div className="rounded-xl bg-brand-50/50 border border-brand-100 p-4 mb-6 flex gap-3">
            <Info className="w-4 h-4 text-brand-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-brand-900 space-y-2">
              <p className="text-2xs font-semibold uppercase tracking-wider text-brand-700">
                Privacy notice
              </p>
              <ul className="list-disc list-inside space-y-1 text-brand-800/85 text-sm leading-relaxed">
                <li>Your camera is used to verify your identity.</li>
                <li>Only a mathematical face descriptor is stored — never a photo.</li>
                <li>The descriptor cannot be reversed into an image.</li>
                <li>
                  You have <span className="font-semibold tabular-nums">{attemptsRemaining}</span>{' '}
                  verification attempt{attemptsRemaining !== 1 ? 's' : ''} for this exam.
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={() => setStep(requiresCapture ? 'capture' : 'verifying')}
            className="btn btn-lg btn-primary w-full"
          >
            <Camera className="w-4 h-4" />
            {requiresCapture ? 'Set up face verification' : 'Start verification'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'blocked') {
    return (
      <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center px-4">
        <div className="w-full max-w-md card p-8 text-center ring-1 ring-danger-200 animate-fade-in-up">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-danger-50 ring-1 ring-danger-200 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-danger-600" />
          </div>
          <h2 className="text-xl font-semibold text-ink-900 tracking-tight2 mb-2">
            Verification blocked
          </h2>
          <p className="text-sm text-ink-600">
            You have exhausted all verification attempts. Your instructor has been notified —
            please contact them for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl card p-8 shadow-elevated animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-ink-900 text-center tracking-tight2 mb-1">
          {step === 'capture' ? 'Capture your face' : 'Verify your identity'}
        </h1>
        <p className="text-sm text-ink-600 text-center mb-6">
          {step === 'capture'
            ? 'Position your face clearly in the frame, then capture.'
            : `Position your face in the frame. ${attemptsRemaining} attempt${
                attemptsRemaining !== 1 ? 's' : ''
              } remaining.`}
        </p>

        {(verifyError || captureError) && (
          <div className="flex items-start gap-3 p-3.5 bg-danger-50 border border-danger-200 rounded-lg mb-5 animate-slide-down">
            <AlertCircle className="w-4 h-4 text-danger-700 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-danger-800">{verifyError ?? captureError}</p>
          </div>
        )}

        <div className="relative bg-ink-950 rounded-xl overflow-hidden mb-6 aspect-video ring-1 ring-ink-900/60">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]"
            aria-label="Camera feed for identity verification"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

          {(isVerifying || captureStatus === 'capturing' || captureStatus === 'processing') && (
            <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center">
              <div className="text-white text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-300" />
                <p className="text-sm font-medium">
                  {captureStatus === 'processing' ? 'Processing…' : 'Analyzing face…'}
                </p>
              </div>
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-56 border-2 border-dashed border-white/55 rounded-full" />
          </div>

          <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse-soft" />
            <span className="text-2xs font-semibold uppercase tracking-wider text-white/90">
              Live
            </span>
          </div>
        </div>

        {step === 'capture' && (
          <button
            onClick={handleCaptureReference}
            disabled={captureStatus === 'capturing' || captureStatus === 'processing'}
            className="btn btn-lg btn-primary w-full"
          >
            {captureStatus === 'capturing' || captureStatus === 'processing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {captureStatus === 'processing' ? 'Saving…' : 'Capturing…'}
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Capture &amp; verify
              </>
            )}
          </button>
        )}

        {(step === 'verifying' || step === 'failed') && (
          <button
            onClick={() => handleVerify()}
            disabled={isVerifying}
            className="btn btn-lg btn-primary w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                {step === 'failed' ? (
                  <RefreshCw className="w-4 h-4" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                {step === 'failed' ? 'Retry verification' : 'Confirm identity'}
              </>
            )}
          </button>
        )}

        {step === 'failed' && (
          <p className="text-xs text-ink-500 mt-4 text-center">
            Tip: ensure good lighting and face the camera directly.
          </p>
        )}
      </div>
    </div>
  );
};
