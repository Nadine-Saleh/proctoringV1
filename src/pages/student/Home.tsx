import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Clock, FileText, Calendar, ChevronRight, AlertCircle, KeyRound } from 'lucide-react';
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

const getStatusPill = (status: string) => {
  switch (status) {
    case 'in_progress':
      return 'pill pill-success';
    case 'verified':
      return 'pill pill-brand';
    case 'awaiting_verification':
      return 'pill pill-warning';
    case 'submitted':
    case 'auto_submitted':
      return 'pill pill-neutral';
    case 'verification_blocked':
    case 'terminated':
      return 'pill pill-danger';
    default:
      return 'pill pill-neutral';
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
  const location = useLocation();
  const { setCurrentExam } = useApp();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const result = await IdentityVerificationService.listMySessions();
    if (result.success && result.sessions) {
      setSessions(result.sessions);
      setError(null);
    } else if (!result.success) {
      setError(result.error ?? 'Failed to load sessions');
    }
    setLoading(false);
  }, []);

  // Refresh whenever Home is re-navigated to (e.g. returning from /results
  // after submission) so a just-finished session no longer appears active.
  useEffect(() => {
    loadSessions();
  }, [loadSessions, location.key]);

  useEffect(() => {
    const onFocus = () => loadSessions();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadSessions]);

  const activeSessions = sessions.filter(
    (s) => !['submitted', 'auto_submitted', 'terminated'].includes(s.status)
  );
  const pastSessions = sessions.filter((s) =>
    ['submitted', 'auto_submitted', 'terminated'].includes(s.status)
  );

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-1">
              Student Portal
            </div>
            <h1 className="text-3xl font-semibold text-ink-900 tracking-tight2">
              Welcome back
            </h1>
            <p className="text-ink-600 mt-1">Manage and join your scheduled exam sessions.</p>
          </div>
          <Link to="/exam/join" className="btn btn-lg btn-primary">
            <KeyRound className="w-4 h-4" />
            Join exam
          </Link>
        </div>

        <div className="card p-5 mb-8 flex items-start gap-3.5 border-brand-100 bg-brand-50/40">
          <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-brand-900 mb-0.5">Proctoring active</h3>
            <p className="text-sm text-brand-800/80 leading-relaxed">
              All exams are AI-monitored. Ensure your camera is enabled and you're in a quiet,
              well-lit environment before starting.
            </p>
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="card p-6 space-y-4">
                <div className="skeleton h-5 w-24 rounded-full" />
                <div className="skeleton h-6 w-3/4" />
                <div className="space-y-2">
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-4 w-1/3" />
                </div>
                <div className="skeleton h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-3 p-4 bg-danger-50 border border-danger-200 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 text-danger-700 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-danger-800">{error}</p>
          </div>
        )}

        {!loading && activeSessions.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                Active exams
              </h2>
              <span className="text-xs text-ink-500 tabular-nums">
                {activeSessions.length} open
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSessions.map((session) => {
                const isClosed = ['submitted', 'auto_submitted', 'terminated'].includes(
                  session.status
                );
                return (
                  <div
                    key={session.session_id}
                    className="card p-6 hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <span className={getStatusPill(session.status)}>
                        {SESSION_STATUS_LABELS[session.status] ?? session.status}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-ink-900 tracking-tight2 mb-3">
                      {session.exam_title}
                    </h3>
                    <div className="space-y-1.5 mb-5 text-sm text-ink-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-ink-400" />
                        <span>{formatDate(session.exam_starts_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-ink-400" />
                        <span>{session.duration_minutes} minutes</span>
                      </div>
                    </div>
                    <button
                      disabled={isClosed}
                      onClick={() => {
                        if (isClosed) return;
                        setCurrentExam({
                          id: session.exam_id,
                          title: session.exam_title,
                          duration: session.duration_minutes,
                        }as any);
                        navigate(getSessionRoute(session));
                      }}
                      className="btn btn-md btn-primary w-full"
                    >
                      {isClosed
                        ? 'Already submitted'
                        : session.status === 'in_progress'
                        ? 'Continue exam'
                        : 'Continue'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {!loading && pastSessions.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                Past exams
              </h2>
              <span className="text-xs text-ink-500 tabular-nums">
                {pastSessions.length} completed
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastSessions.map((session) => (
                <div
                  key={session.session_id}
                  className="card-flat p-6 hover:shadow-card transition-all"
                >
                  <div className="mb-3">
                    <span className={getStatusPill(session.status)}>
                      {SESSION_STATUS_LABELS[session.status] ?? session.status}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-ink-900 tracking-tight2 mb-3">
                    {session.exam_title}
                  </h3>
                  <div className="space-y-1.5 mb-5 text-sm text-ink-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-ink-400" />
                      <span>{formatDate(session.exam_starts_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-ink-400" />
                      <span>{session.duration_minutes} minutes</span>
                    </div>
                    {session.submitted_at && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-ink-400" />
                        <span>Submitted {formatDate(session.submitted_at)}</span>
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/exam/${session.session_id}/results`}
                    className="btn btn-md btn-secondary w-full"
                  >
                    View results
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && sessions.length === 0 && !error && (
          <div className="card p-12 text-center animate-fade-in-up">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-ink-900 tracking-tight2 mb-1.5">
              No exam sessions yet
            </h2>
            <p className="text-sm text-ink-600 mb-6 max-w-sm mx-auto">
              Join an exam using the access code provided by your instructor to begin.
            </p>
            <Link to="/exam/join" className="btn btn-md btn-primary">
              <KeyRound className="w-4 h-4" />
              Join an exam
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
