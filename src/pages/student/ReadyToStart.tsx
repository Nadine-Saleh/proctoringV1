import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { PlayCircle, Clock, FileText, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { IdentityVerificationService, type JoinExamResponse } from '../../services/IdentityVerificationService';
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

    const result = await IdentityVerificationService.startSession(sessionId);

    if (!result.success || !result.data) {
      setLoading(false);
      const msg = result.error ?? 'Failed to start the exam';
      if (msg.includes('exam_window_closed')) {
        setError('The exam window has closed. Please contact your instructor.');
      } else {
        setError(msg);
      }
      return;
    }

    if (joinData?.exam) {
      setCurrentExam({
        id: joinData.exam.id,
        title: joinData.exam.title,
        description: joinData.exam.description,
        duration: joinData.exam.duration_minutes,
        proctoring_policy: joinData.exam.proctoring_policy,
      });
    }

    navigate(`/exam/${sessionId}`, {
      state: { sessionData: result.data, joinData },
    });
  };

  const exam = joinData?.exam;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center w-14 h-14 bg-green-100 rounded-xl mb-6 mx-auto">
          <ShieldCheck className="w-7 h-7 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">You Are Verified</h1>
        <p className="text-gray-500 text-center mb-8">
          Your identity has been confirmed. Review the exam details below, then begin when ready.
        </p>

        {exam && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
            <h2 className="font-semibold text-gray-900 text-lg">{exam.title}</h2>
            {exam.description && (
              <p className="text-sm text-gray-600">{exam.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>{exam.duration_minutes} minutes</span>
            </div>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex gap-3">
          <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">Before you begin</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>Stay in this browser tab for the entire exam.</li>
              <li>Keep your face visible to the camera at all times.</li>
              <li>The timer starts the moment you click "Begin Exam".</li>
              <li>Camera is inactive on this screen.</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleBegin}
          disabled={loading}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          data-testid="begin-exam-button"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Starting Exam…
            </>
          ) : (
            <>
              <PlayCircle className="w-6 h-6" />
              Begin Exam
            </>
          )}
        </button>
      </div>
    </div>
  );
};
