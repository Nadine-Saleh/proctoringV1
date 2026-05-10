import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { ViolationEventService } from '../../services/ViolationEventService';
import { EvidenceSnippetService } from '../../services/EvidenceSnippetService';
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  Clock,
  Award,
  ShieldAlert,
  Play,
  Edit2,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';

interface ViolationEvent {
  id: string;
  violation_type: string;
  severity: number;
  occurred_at: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  is_reviewed: boolean;
  instructor_note: string | null;
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
  instructor_override_score: number | null;
  instructor_note: string | null;
  calibration_skipped: boolean;
  optimal_distance_cm: number | null;
  distance_tolerance_cm: number | null;
  evidence_package_id: string | null;
  violation_summary: Record<string, { count: number; severity: number }> | null;
}

const formatViolationType = (t: string) =>
  t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const getSeverityColor = (sev: number) => {
  if (sev >= 20) return 'bg-danger-100 text-danger-700 border-danger-200';
  if (sev >= 15) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (sev >= 10) return 'bg-warning-100 text-warning-700 border-warning-200';
  return 'bg-brand-100 text-brand-800 border-brand-200';
};

export const SubmissionDetail = () => {
  const { examId, sessionId } = useParams<{ examId: string; sessionId: string }>();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [playbackUrls, setPlaybackUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Score override state
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Per-violation review state: id → { saving, showNote, noteText }
  const [reviewStates, setReviewStates] = useState<
    Record<string, { saving: boolean; showNote: boolean; noteText: string }>
  >({});

  useEffect(() => {
    if (!examId || !sessionId) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
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

        const { data: events } = await supabase
          .from('violation_events')
          .select(
            'id, violation_type, severity, occurred_at, client_captured_at, description, metadata, is_reviewed, instructor_note, evidence_artifacts(id, storage_path)'
          )
          .eq('session_id', sessionId)
          .order('occurred_at', { ascending: true });

        const evArr = (events as ViolationEvent[] | null) ?? [];
        setViolations(evArr);

        // Init per-violation review state
        const initStates: typeof reviewStates = {};
        for (const ev of evArr) {
          initStates[ev.id] = {
            saving: false,
            showNote: false,
            noteText: ev.instructor_note ?? '',
          };
        }
        setReviewStates(initStates);

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

  const handleToggleReview = async (ev: ViolationEvent) => {
    const newReviewed = !ev.is_reviewed;
    const note = reviewStates[ev.id]?.noteText || undefined;

    setReviewStates(prev => ({
      ...prev,
      [ev.id]: { ...prev[ev.id], saving: true },
    }));

    const result = await ViolationEventService.reviewViolation(ev.id, newReviewed, note);

    if (result.success) {
      setViolations(prev =>
        prev.map(v =>
          v.id === ev.id
            ? { ...v, is_reviewed: newReviewed, instructor_note: note ?? null }
            : v
        )
      );
    }

    setReviewStates(prev => ({
      ...prev,
      [ev.id]: { ...prev[ev.id], saving: false, showNote: false },
    }));
  };

  const handleSaveOverride = async () => {
    if (!sessionId) return;
    const score = overrideScore === '' ? null : parseFloat(overrideScore);
    if (score !== null && (isNaN(score) || score < 0 || score > 100)) {
      setOverrideError('Score must be between 0 and 100.');
      return;
    }

    setOverrideSaving(true);
    setOverrideError(null);

    const result = await ViolationEventService.overrideSubmissionScore(
      sessionId,
      score,
      overrideNote || undefined
    );

    if (result.success) {
      setSubmission(prev =>
        prev
          ? {
              ...prev,
              instructor_override_score: score,
              instructor_note: overrideNote || null,
            }
          : prev
      );
      setShowOverrideForm(false);
      setOverrideScore('');
      setOverrideNote('');
    } else {
      setOverrideError(result.error ?? 'Failed to save override.');
    }

    setOverrideSaving(false);
  };

  const handleRemoveOverride = async () => {
    if (!sessionId) return;
    setOverrideSaving(true);
    const result = await ViolationEventService.overrideSubmissionScore(sessionId, null);
    if (result.success) {
      setSubmission(prev =>
        prev ? { ...prev, instructor_override_score: null, instructor_note: null } : prev
      );
    }
    setOverrideSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-ink-700 font-semibold">{error ?? 'Submission not found'}</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-brand-700 hover:underline text-sm">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const scorePercent =
    submission.auto_graded_max > 0
      ? Math.round((submission.auto_graded_score / submission.auto_graded_max) * 100)
      : 0;

  const effectiveRiskScore =
    submission.instructor_override_score ?? submission.final_cheating_score;
  const isOverridden = submission.instructor_override_score !== null;

  const reviewedCount = violations.filter(v => v.is_reviewed).length;

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-ink-600 hover:text-ink-900 mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to results
        </button>

        <h1 className="text-2xl font-bold text-ink-900 mb-6">Submission Detail</h1>

        {/* Student + grade summary */}
        <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-800 font-semibold">
                {submission.student_name?.charAt(0) ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-ink-900">{submission.student_name ?? 'Unknown'}</p>
                <p className="text-sm text-ink-500">{submission.student_email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <p className="text-xs text-ink-500 mb-1 flex items-center gap-1">
                  <Award className="w-3 h-3" /> Grade
                </p>
                <p className="text-xl font-bold text-ink-900">{scorePercent}%</p>
                <p className="text-xs text-ink-400">
                  {submission.auto_graded_score} / {submission.auto_graded_max} pts
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-ink-500 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Risk Score
                </p>
                <p
                  className={`text-xl font-bold ${
                    effectiveRiskScore >= 70
                      ? 'text-danger-600'
                      : effectiveRiskScore >= 40
                      ? 'text-warning-600'
                      : 'text-success-600'
                  }`}
                >
                  {Math.round(effectiveRiskScore)}
                </p>
                {isOverridden && (
                  <p className="text-xs text-brand-600">
                    overridden from {Math.round(submission.final_cheating_score)}
                  </p>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs text-ink-500 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Submitted
                </p>
                <p className="text-sm font-medium text-ink-700">
                  {new Date(submission.submitted_at).toLocaleString()}
                </p>
                <p className="text-xs text-ink-400">{submission.submit_reason.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Score override panel */}
        <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-ink-900 text-sm">Instructor Risk Score Override</h2>
            <div className="flex gap-2">
              {isOverridden && (
                <button
                  onClick={handleRemoveOverride}
                  disabled={overrideSaving}
                  className="flex items-center gap-1 text-xs text-ink-500 hover:text-danger-600 disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" /> Remove override
                </button>
              )}
              {!showOverrideForm && (
                <button
                  onClick={() => {
                    setOverrideScore(
                      submission.instructor_override_score != null
                        ? String(Math.round(submission.instructor_override_score))
                        : ''
                    );
                    setOverrideNote(submission.instructor_note ?? '');
                    setShowOverrideForm(true);
                  }}
                  className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800"
                >
                  <Edit2 className="w-3 h-3" /> {isOverridden ? 'Edit override' : 'Set override'}
                </button>
              )}
            </div>
          </div>

          {isOverridden && !showOverrideForm && (
            <p className="text-sm text-ink-600">
              Score overridden to{' '}
              <strong>{Math.round(submission.instructor_override_score!)}</strong>
              {submission.instructor_note && (
                <span className="text-ink-400"> — "{submission.instructor_note}"</span>
              )}
            </p>
          )}

          {!isOverridden && !showOverrideForm && (
            <p className="text-xs text-ink-400">
              Final score is {Math.round(submission.final_cheating_score)} (peak during exam). You
              can override it after reviewing the violations below.
            </p>
          )}

          {showOverrideForm && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">
                    New score (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={overrideScore}
                    onChange={e => setOverrideScore(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-28 px-3 py-1.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-700/30 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ink-700 mb-1">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={overrideNote}
                    onChange={e => setOverrideNote(e.target.value)}
                    placeholder="e.g. Reviewed — violations appear accidental"
                    className="w-full px-3 py-1.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-700/30 focus:outline-none"
                  />
                </div>
              </div>
              {overrideError && (
                <p className="text-xs text-danger-600">{overrideError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveOverride}
                  disabled={overrideSaving}
                  className="px-4 py-1.5 rounded-lg bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 disabled:opacity-50"
                >
                  {overrideSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setShowOverrideForm(false)}
                  className="px-4 py-1.5 rounded-lg bg-ink-100 text-ink-700 text-sm font-medium hover:bg-ink-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Calibration notice */}
        {submission.calibration_skipped ? (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <ArrowLeftRight className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800">Calibration skipped</p>
              <p className="text-sm text-orange-700 mt-0.5">
                Distance violations were measured against the default 50 cm ± 20 cm. Discount
                distance-related violations during review.
              </p>
            </div>
          </div>
        ) : submission.optimal_distance_cm != null ? (
          <div className="bg-ink-50 border border-ink-100 rounded-xl p-4 mb-6 flex items-center gap-3">
            <ArrowLeftRight className="w-5 h-5 text-ink-500" />
            <p className="text-sm text-ink-700">
              Distance baseline: <strong>{submission.optimal_distance_cm} cm</strong> ±{' '}
              <strong>{submission.distance_tolerance_cm ?? '?'} cm</strong>
            </p>
          </div>
        ) : null}

        {/* Violation timeline */}
        <div className="bg-white rounded-xl shadow-sm border border-ink-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">
              Violation Timeline ({violations.length})
            </h2>
            {violations.length > 0 && (
              <span className="text-xs text-ink-500">
                {reviewedCount} / {violations.length} reviewed
              </span>
            )}
          </div>

          {violations.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-ink-500">No violations recorded for this session.</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {violations.map(ev => {
                const rs = reviewStates[ev.id] ?? {
                  saving: false,
                  showNote: false,
                  noteText: ev.instructor_note ?? '',
                };

                return (
                  <div
                    key={ev.id}
                    className={`px-6 py-4 transition-colors ${ev.is_reviewed ? 'bg-ink-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getSeverityColor(ev.severity)}`}
                          >
                            {formatViolationType(ev.violation_type)}
                          </span>
                          <span className="text-xs text-ink-400">
                            {new Date(ev.occurred_at).toLocaleTimeString()}
                          </span>
                          {ev.is_reviewed && (
                            <span className="flex items-center gap-1 text-xs text-success-600 font-medium">
                              <CheckCircle className="w-3 h-3" /> Reviewed
                            </span>
                          )}
                        </div>

                        {ev.description && (
                          <p className="text-sm text-ink-600">{ev.description}</p>
                        )}

                        {ev.instructor_note && (
                          <p className="text-xs text-brand-700 mt-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> {ev.instructor_note}
                          </p>
                        )}

                        {/* Note input (shown when adding/editing note) */}
                        {rs.showNote && (
                          <div className="mt-2">
                            <input
                              type="text"
                              value={rs.noteText}
                              onChange={e =>
                                setReviewStates(prev => ({
                                  ...prev,
                                  [ev.id]: { ...prev[ev.id], noteText: e.target.value },
                                }))
                              }
                              placeholder="Add a note (optional)"
                              className="w-full max-w-sm px-3 py-1.5 border border-ink-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-700/30 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
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
                              className="flex items-center gap-1 text-xs text-brand-700 hover:underline"
                            >
                              <Play className="w-3.5 h-3.5" /> View
                            </a>
                          );
                        })}

                        {/* Note toggle */}
                        <button
                          onClick={() =>
                            setReviewStates(prev => ({
                              ...prev,
                              [ev.id]: { ...prev[ev.id], showNote: !prev[ev.id]?.showNote },
                            }))
                          }
                          className="text-ink-400 hover:text-brand-700 p-1 rounded"
                          title="Add/edit note"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        {/* Mark reviewed / unreviewed */}
                        <button
                          onClick={() => handleToggleReview(ev)}
                          disabled={rs.saving}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                            ev.is_reviewed
                              ? 'bg-ink-200 text-ink-600 hover:bg-ink-300'
                              : 'bg-success-100 text-success-700 hover:bg-green-200 border border-success-200'
                          }`}
                        >
                          {rs.saving
                            ? '…'
                            : ev.is_reviewed
                            ? 'Mark unreviewed'
                            : 'Mark reviewed'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
