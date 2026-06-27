import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  PlayCircle,
  Clock,
  FileText,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Camera,
} from 'lucide-react';
import {
  IdentityVerificationService,
  type JoinExamResponse,
} from '../../services/IdentityVerificationService';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase/client';

export const ReadyToStart = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentExam } = useApp();

  const joinData = (location.state as { joinData?: JoinExamResponse } | null)
    ?.joinData;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect guard: route to the correct screen based on actual session status
  useEffect(() => {
    if (!sessionId) return;

    supabase
      .from('exam_sessions')
      .select('status')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => {
        if (!data) return;

        if (data.status === 'in_progress') {
          navigate(`/exam/${sessionId}`, { replace: true });
        } else if (
          data.status === 'submitted' ||
          data.status === 'auto_submitted'
        ) {
          navigate(`/exam/${sessionId}/results`, { replace: true });
        } else if (data.status === 'awaiting_verification') {
          navigate(`/exam/${sessionId}/verify`, {
            replace: true,
            state: { joinData },
          });
        } else if (data.status === 'verification_blocked') {
          navigate(`/exam/${sessionId}/verify`, {
            replace: true,
            state: { joinData },
          });
        }
      });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    startCamera();

    return releaseCamera;
  }, []);

  const startCamera = async () => {
    try {
      setCameraLoading(true);
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('Camera access denied. Please allow camera access before starting the exam.');
    } finally {
      setCameraLoading(false);
    }
  };

  const releaseCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleBegin = async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      if (!videoRef.current) {
        setError('Camera is not ready. Please wait and try again.');
        setLoading(false);
        return;
      }

      // Final identity check before entering the exam.
      // This prevents a different person from replacing the verified student.
      const embedding = await IdentityVerificationService.extractEmbedding(
        videoRef.current
      );

      if (!embedding) {
        setError(
          'Final identity check failed. Please make sure exactly one clear face is visible.'
        );
        setLoading(false);
        return;
      }

      const result = await IdentityVerificationService.verifyIdentity(
        sessionId,
        embedding
      );

      console.log('Final identity check result:', result);

      if (!result.success || !result.data) {
        setError(result.error ?? 'Final identity check failed.');
        setLoading(false);
        return;
      }

      if (result.data.blocked) {
        setError('Verification blocked. You have exhausted all attempts.');
        setLoading(false);
        return;
      }

      if (result.data.outcome !== 'pass') {
        setError(
          `Final identity check failed. Attempts remaining: ${result.data.attempts_remaining}`
        );
        setLoading(false);
        return;
      }

      if (joinData?.exam) {
        setCurrentExam({
          id: joinData.exam.id,
          title: joinData.exam.title,
          description: joinData.exam.description,
          duration: joinData.exam.duration_minutes,
          proctoring_policy: joinData.exam.proctoring_policy,
        } as any);
      }

      releaseCamera();

      // start_exam_session is called inside Exam.tsx after distance calibration.
      navigate(`/exam/${sessionId}`, {
        state: { joinData },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start the exam. Please try again.'
      );
      setLoading(false);
    }
  };

  const exam = joinData?.exam;

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg card p-8 shadow-elevated animate-fade-in-up">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-success-50 ring-1 ring-success-200 mb-5 mx-auto">
          <ShieldCheck className="w-6 h-6 text-success-600" />
        </div>

        <h1 className="text-2xl font-semibold text-ink-900 text-center tracking-tight2 mb-1">
          You're verified
        </h1>

        <p className="text-sm text-ink-600 text-center mb-7">
          Your identity has been confirmed. A final face check will run before
          entering the exam.
        </p>

        {exam && (
          <div className="panel p-5 mb-5">
            <div className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-1">
              Exam
            </div>

            <h2 className="text-lg font-semibold text-ink-900 tracking-tight2">
              {exam.title}
            </h2>

            {exam.description && (
              <p className="text-sm text-ink-600 mt-2 leading-relaxed">
                {exam.description}
              </p>
            )}

            <div className="flex items-center gap-2 text-sm text-ink-700 mt-3 pt-3 border-t border-ink-100">
              <Clock className="w-4 h-4 text-ink-500" />
              <span>
                <span className="font-semibold tabular-nums">
                  {exam.duration_minutes}
                </span>{' '}
                minutes
              </span>
            </div>
          </div>
        )}

        <div className="relative bg-ink-950 rounded-xl overflow-hidden mb-5 aspect-video ring-1 ring-ink-900/60">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]"
            aria-label="Camera feed for final identity check"
          />

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-44 h-52 border-2 border-dashed border-white/55 rounded-full" />
          </div>

          {(cameraLoading || loading) && (
            <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center">
              <div className="text-white text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-300" />
                <p className="text-sm font-medium">
                  {loading ? 'Running final identity check…' : 'Starting camera…'}
                </p>
              </div>
            </div>
          )}

          <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse-soft" />
            <span className="text-2xs font-semibold uppercase tracking-wider text-white/90">
              Live
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-warning-50 border border-warning-200 p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-warning-100 text-warning-700 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>

            <div className="text-sm text-warning-900">
              <p className="text-2xs font-semibold uppercase tracking-wider text-warning-700 mb-1.5">
                Before you begin
              </p>

              <ul className="space-y-1 text-warning-900/85 leading-relaxed">
                <li>• Stay in this browser tab for the entire exam.</li>
                <li>• Keep your face visible to the camera at all times.</li>
                <li>• Only the registered student can start the exam.</li>
                <li>
                  • The timer starts the moment you pass the final identity check.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-3.5 bg-danger-50 border border-danger-200 rounded-lg mb-5">
            <AlertCircle className="w-4 h-4 text-danger-700 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-danger-800">{error}</p>
          </div>
        )}

        <button
          onClick={handleBegin}
          disabled={loading || cameraLoading}
          className="btn btn-xl btn-primary w-full text-base"
          data-testid="begin-exam-button"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Checking identity…
            </>
          ) : (
            <>
              {cameraLoading ? (
                <Camera className="w-5 h-5" />
              ) : (
                <PlayCircle className="w-5 h-5" />
              )}
              {cameraLoading ? 'Starting camera…' : 'Begin exam'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};