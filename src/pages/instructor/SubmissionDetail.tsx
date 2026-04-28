import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { EvidenceSnippetService } from '../../services/EvidenceSnippetService';
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  Clock,
  Award,
  ShieldAlert,
  Play
} from 'lucide-react';

interface ViolationEvent {
  id: string;
  violation_type: string;
  severity: number;
  occurred_at: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  evidence_artifacts?: Array<{ id: string; storage_path: string }>;
}

interface SubmissionData {
  submission_id: string;
  session_id: string;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
  submit_reason: string;
  grade_status: string;
  auto_graded_score: number;
  auto_graded_max: number;
  final_grade: number | null;
  final_cheating_score: number;
  calibration_skipped: boolean;
  optimal_distance_cm: number | null;
  distance_tolerance_cm: number | null;
  evidence_package_id: string | null;
  violation_summary: Record<string, { count: number; severity: number }> | null;
}

const formatViolationType = (t: string) =>
  t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const getSeverityColor = (sev: number) => {
  if (sev >= 20) return 'bg-red-100 text-red-700 border-red-200';
  if (sev >= 15) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (sev >= 10) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-blue-100 text-blue-700 border-blue-200';
};

export const SubmissionDetail = () => {
  const { examId, sessionId } = useParams<{ examId: string; sessionId: string }>();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [playbackUrls, setPlaybackUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId || !sessionId) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Load submission via list_exam_submissions RPC
        const { data: submissions, error: rpcErr } = await supabase.rpc('list_exam_submissions', {
          p_exam_id: examId,
        });
        if (rpcErr) throw new Error(rpcErr.message);

        const match = (submissions as SubmissionData[] | null)?.find(
          s => s.session_id === sessionId
        );
        if (!match) {
          setError('Submission not found.');
          return;
        }
        setSubmission(match);

        // Load violation events for this session
        const { data: events } = await supabase
          .from('violation_events')
          .select('id, violation_type, severity, occurred_at, client_captured_at, description, metadata, evidence_artifacts(id, storage_path)')
          .eq('session_id', sessionId)
          .order('occurred_at', { ascending: true });

        const evArr = (events as ViolationEvent[] | null) ?? [];
        setViolations(evArr);

        // Resolve signed playback URLs for evidence artifacts
        const paths = evArr
          .flatMap(ev => ev.evidence_artifacts ?? [])
          .map(a => a.storage_path)
          .filter(Boolean);

        if (paths.length > 0) {
          const urls = await EvidenceSnippetService.getPlaybackUrls(paths);
          setPlaybackUrls(urls);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load submission');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [examId, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold">{error ?? 'Submission not found'}</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 hover:underline text-sm">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const scorePercent = submission.auto_graded_max > 0
    ? Math.round((submission.auto_graded_score / submission.auto_graded_max) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to results
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Submission Detail</h1>

        {/* Student + grade summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
                {submission.student_name?.charAt(0) ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{submission.student_name ?? 'Unknown'}</p>
                <p className="text-sm text-gray-500">{submission.student_email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Award className="w-3 h-3" /> Grade</p>
                <p className="text-xl font-bold text-gray-900">{scorePercent}%</p>
                <p className="text-xs text-gray-400">{submission.auto_graded_score} / {submission.auto_graded_max} pts</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Risk Score</p>
                <p className={`text-xl font-bold ${submission.final_cheating_score >= 70 ? 'text-red-600' : submission.final_cheating_score >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
                  {Math.round(submission.final_cheating_score)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Submitted</p>
                <p className="text-sm font-medium text-gray-700">
                  {new Date(submission.submitted_at).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">{submission.submit_reason.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* T084a — Calibration baseline notice */}
        {submission.calibration_skipped ? (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <ArrowLeftRight className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800">Calibration skipped</p>
              <p className="text-sm text-orange-700 mt-0.5">
                Distance violations were measured against the conservative default of 50 cm ± 20 cm.
                Distance-derived violations should be discounted during adjudication (FR-013b / FR-028).
              </p>
            </div>
          </div>
        ) : submission.optimal_distance_cm != null ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <ArrowLeftRight className="w-5 h-5 text-gray-500" />
            <p className="text-sm text-gray-700">
              Distance baseline: <strong>{submission.optimal_distance_cm} cm</strong> ±{' '}
              <strong>{submission.distance_tolerance_cm ?? '?'} cm</strong>
            </p>
          </div>
        ) : null}

        {/* Violation timeline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Violation Timeline ({violations.length})</h2>
          </div>

          {violations.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500">No violations recorded for this session.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {violations.map(ev => (
                <div key={ev.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getSeverityColor(ev.severity)}`}>
                          {formatViolationType(ev.violation_type)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(ev.occurred_at).toLocaleTimeString()}
                        </span>
                      </div>
                      {ev.description && (
                        <p className="text-sm text-gray-600">{ev.description}</p>
                      )}
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {Object.entries(ev.metadata)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    {/* Evidence playback */}
                    {ev.evidence_artifacts?.map(artifact => {
                      const url = playbackUrls.get(artifact.storage_path);
                      if (!url) return null;
                      return (
                        <a
                          key={artifact.id}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline flex-shrink-0"
                        >
                          <Play className="w-3.5 h-3.5" />
                          View
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
