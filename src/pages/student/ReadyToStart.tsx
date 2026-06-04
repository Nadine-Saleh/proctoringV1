import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { PlayCircle, Clock, FileText, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import type { JoinExamResponse } from '../../services/IdentityVerificationService';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase/client';

export const ReadyToStart = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentExam } = useApp();
  const joinData = (location.state as { joinData?: JoinExamResponse } | null)?.joinData;

  const [loading, setLoading] = useState(false);
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
        if (data.status === 'in_progress') navigate(`/exam/${sessionId}`, { replace: true });
        else if (data.status === 'submitted' || data.status === 'auto_submitted') navigate(`/exam/${sessionId}/results`, { replace: true });
        else if (data.status === 'awaiting_verification') navigate(`/exam/${sessionId}/verify`, { replace: true, state: { joinData } });
      });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBegin = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);

    if (joinData?.exam) {
      setCurrentExam({
        id: joinData.exam.id,
        title: joinData.exam.title,
        description: joinData.exam.description,
        duration: joinData.exam.duration_minutes,
        proctoring_policy: joinData.exam.proctoring_policy,
      }as any);
    }

    // start_exam_session is called inside Exam.tsx after distance calibration (T040a / FR-013a).
    navigate(`/exam/${sessionId}`, {
      state: { joinData },
    });
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
          Your identity has been confirmed. Review the details below, then begin when ready.
        </p>

        {exam && (
          <div className="panel p-5 mb-5">
            <div className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-1">
              Exam
            </div>
            <h2 className="text-lg font-semibold text-ink-900 tracking-tight2">{exam.title}</h2>
            {exam.description && (
              <p className="text-sm text-ink-600 mt-2 leading-relaxed">{exam.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-ink-700 mt-3 pt-3 border-t border-ink-100">
              <Clock className="w-4 h-4 text-ink-500" />
              <span>
                <span className="font-semibold tabular-nums">{exam.duration_minutes}</span> minutes
              </span>
            </div>
          </div>
        )}

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
                <li>• The timer starts the moment you press <em>Begin exam</em>.</li>
                <li>• Camera is inactive on this screen.</li>
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
          disabled={loading}
          className="btn btn-xl btn-primary w-full text-base"
          data-testid="begin-exam-button"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting exam…
            </>
          ) : (
            <>
              <PlayCircle className="w-5 h-5" />
              Begin exam
            </>
          )}
        </button>
      </div>
    </div>
  );
};
