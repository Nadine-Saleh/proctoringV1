import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Clock, FileText, Calendar, ChevronRight, AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { IdentityVerificationService } from '../../services/IdentityVerificationService';
import { useApp } from '../../context/AppContext';

interface SessionRow {
  session_id: string;
  exam_id: string;
  exam_title: string;
  exam_starts_at: string;
  duration_minutes: number;
  status: string;
  started_at: string | null;
  submitted_at: string | null;
  live_cheating_score: number;
  created_at: string;
}

const SESSION_STATUS_LABELS: Record<string, string> = {
  awaiting_verification: 'Pending Verification',
  verification_blocked: 'Blocked',
  verified: 'Ready to Start',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  auto_submitted: 'Auto Submitted',
  terminated: 'Terminated',
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'in_progress':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'verified':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'awaiting_verification':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'submitted':
    case 'auto_submitted':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'verification_blocked':
    case 'terminated':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getSessionRoute = (session: SessionRow): string => {
  switch (session.status) {
    case 'awaiting_verification':
    case 'verified':
      return `/exam/${session.session_id}/verify`;
    case 'in_progress':
      return `/exam/${session.session_id}`;
    case 'submitted':
    case 'auto_submitted':
      return `/exam/${session.session_id}/results`;
    default:
      return `/exam/${session.session_id}/verify`;
  }
};

export const StudentHome = () => {
  const navigate = useNavigate();
  const { setCurrentExam } = useApp();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const result = await IdentityVerificationService.listMySessions();
      if (result.success && result.sessions) {
        setSessions(result.sessions);
      } else if (!result.success) {
        setError(result.error ?? 'Failed to load sessions');
      }
      setLoading(false);
    };
    load();
  }, []);

  const activeSessions = sessions.filter(
    (s) => !['submitted', 'auto_submitted', 'terminated'].includes(s.status)
  );
  const pastSessions = sessions.filter((s) =>
    ['submitted', 'auto_submitted', 'terminated'].includes(s.status)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome back!</h1>
            <p className="text-lg text-gray-600">Your exam sessions</p>
          </div>
          <Link
            to="/exam/join"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <KeyRound className="w-5 h-5" />
            Join Exam
          </Link>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Proctoring Information</h3>
            <p className="text-sm text-blue-700">
              All exams are monitored using AI proctoring. Ensure your camera is enabled and
              you're in a quiet, well-lit environment before starting.
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && activeSessions.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Exams</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activeSessions.map((session) => (
                <div
                  key={session.session_id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="p-6">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${getStatusColor(session.status)}`}>
                      {SESSION_STATUS_LABELS[session.status] ?? session.status}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{session.exam_title}</h3>
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDate(session.exam_starts_at)}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                        {session.duration_minutes} minutes
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setCurrentExam({
                          id: session.exam_id,
                          title: session.exam_title,
                          duration: session.duration_minutes,
                        });
                        navigate(getSessionRoute(session));
                      }}
                      className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      {session.status === 'in_progress' ? 'Continue Exam' : 'Continue'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && pastSessions.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Past Exams</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pastSessions.map((session) => (
                <div
                  key={session.session_id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden opacity-80"
                >
                  <div className="p-6">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${getStatusColor(session.status)}`}>
                      {SESSION_STATUS_LABELS[session.status] ?? session.status}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{session.exam_title}</h3>
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDate(session.exam_starts_at)}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                        {session.duration_minutes} minutes
                      </div>
                      {session.submitted_at && (
                        <div className="flex items-center text-sm text-gray-600">
                          <FileText className="w-4 h-4 mr-2 text-gray-400" />
                          Submitted {formatDate(session.submitted_at)}
                        </div>
                      )}
                    </div>
                    <Link
                      to={`/exam/${session.session_id}/results`}
                      className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      View Results
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && sessions.length === 0 && !error && (
          <div className="text-center py-16 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-700 mb-2">No exam sessions yet</p>
            <p className="text-sm mb-6">Join an exam using the access code from your instructor.</p>
            <Link
              to="/exam/join"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <KeyRound className="w-5 h-5" />
              Join an Exam
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
