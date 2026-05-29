import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { IdentityVerificationService } from '../../services/IdentityVerificationService';
import { useReferenceCapture } from '../../hooks/useReferenceCapture';

export const FaceSetup = () => {
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    status: captureStatus,
    error: captureError,
    captureReference,
  } = useReferenceCapture();

  useEffect(() => {
    const checkExistingReference = async () => {
      const hasReference = await IdentityVerificationService.hasReference();

      if (hasReference) {
        navigate('/', { replace: true });
        return;
      }

      setChecking(false);
      startCamera();
    };

    checkExistingReference();

    return releaseCamera;
  }, []);

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
      setError('Camera access denied. Please allow camera access.');
    }
  };

  const releaseCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;

    setError(null);

    const ok = await captureReference(videoRef.current);

    if (!ok) {
      return;
    }

    releaseCamera();
    navigate('/', { replace: true });
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p>Checking face setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl card p-8 shadow-elevated">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-gradient shadow-elevated mb-5 mx-auto">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>

        <h1 className="text-2xl font-semibold text-ink-900 text-center mb-2">
          Set up face verification
        </h1>

        <p className="text-sm text-ink-600 text-center mb-6">
          This will be saved once and used later to verify your identity before exams.
        </p>

        {(error || captureError) && (
          <div className="flex items-start gap-3 p-3.5 bg-danger-50 border border-danger-200 rounded-lg mb-5">
            <AlertCircle className="w-4 h-4 text-danger-700 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-danger-800">
              {error ?? captureError}
            </p>
          </div>
        )}

        <div className="relative bg-ink-950 rounded-xl overflow-hidden mb-6 aspect-video ring-1 ring-ink-900/60">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]"
          />

          {(captureStatus === 'capturing' || captureStatus === 'processing') && (
            <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center">
              <div className="text-white text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p className="text-sm font-medium">
                  {captureStatus === 'processing' ? 'Saving face reference...' : 'Capturing...'}
                </p>
              </div>
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-56 border-2 border-dashed border-white/55 rounded-full" />
          </div>
        </div>

        <button
          onClick={handleCapture}
          disabled={captureStatus === 'capturing' || captureStatus === 'processing'}
          className="btn btn-lg btn-primary w-full"
        >
          {captureStatus === 'capturing' || captureStatus === 'processing' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              Capture my face
            </>
          )}
        </button>
      </div>
    </div>
  );
};